import type { ConnectionInfo, NiimbotAbstractClient } from '@mmote/niimbluelib';

type Lib = typeof import('@mmote/niimbluelib');

/** The standard NIIMBOT service, followed by serial-over-BLE services common on budget printers. */
export const CANDIDATE_SERVICES = [
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // NIIMBOT
  '0000e0ff-3c17-d293-8e48-14fe2e4da212', // NIIMBOT B21 C2B (model id 771), channel ffe1
  '0000ae30-0000-1000-8000-00805f9b34fb', // AE30 printer UART
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 style
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb', // generic printer
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip transparent UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
];

/** Name prefixes of NIIMBOT printers; the chooser lists only these. */
export const NAME_PREFIXES = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'M', 'N', 'P', 'S', 'T', 'Z'];

interface CharLike {
  uuid: string;
  properties: { notify: boolean; indicate?: boolean; write: boolean; writeWithoutResponse: boolean };
}

export interface ServiceLike<C extends CharLike = CharLike> {
  uuid: string;
  getCharacteristics(): Promise<C[]>;
}

export interface Channel<C extends CharLike = CharLike> {
  write: C;
  notify: C;
}

/**
 * Picks the characteristics to talk through. A single characteristic that both
 * notifies and accepts writes wins (the NIIMBOT layout); otherwise a write and
 * a notify characteristic from the same service are paired.
 */
export async function pickChannel<C extends CharLike>(services: ServiceLike<C>[]): Promise<Channel<C> | null> {
  const all: { service: string; chars: C[] }[] = [];
  for (const service of services) all.push({ service: service.uuid, chars: await service.getCharacteristics() });

  const canWrite = (c: C) => c.properties.writeWithoutResponse || c.properties.write;
  const canNotify = (c: C) => c.properties.notify || !!c.properties.indicate;

  for (const { chars } of all) {
    const both = chars.find((c) => c.properties.writeWithoutResponse && c.properties.notify);
    if (both) return { write: both, notify: both };
  }
  for (const { chars } of all) {
    const write = chars.find(canWrite);
    const notify = chars.find(canNotify);
    if (write && notify) return { write, notify };
  }
  return null;
}

/** Turns Chrome's terse GATT errors into something a person can act on. */
export function describeBleError(err: unknown, found: string[] = []): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/no services found/i.test(msg) || (found.length === 0 && /characteristic/i.test(msg))) {
    return new Error('This printer uses an unknown Bluetooth service. See Help → Printer not recognised.');
  }
  if (/characteristic/i.test(msg)) return new Error(`No usable channel. Services: ${found.join(', ')}`);
  return err instanceof Error ? err : new Error(msg);
}

/**
 * A Web Bluetooth client that accepts more service layouts than niimbluelib's
 * own, which only knows the standard NIIMBOT service. The protocol handling
 * (packets, negotiation, heartbeat) is inherited unchanged.
 */
export function createBleClient(lib: Lib): NiimbotAbstractClient {
  class FlexibleBleClient extends lib.NiimbotAbstractClient {
    private server?: BluetoothRemoteGATTServer;
    private channel?: Channel<BluetoothRemoteGATTCharacteristic>;

    async connect(): Promise<ConnectionInfo> {
      await this.disconnect();
      const device = await navigator.bluetooth.requestDevice({
        filters: [...NAME_PREFIXES.map((namePrefix) => ({ namePrefix })), { services: [CANDIDATE_SERVICES[0]] }],
        optionalServices: CANDIDATE_SERVICES,
      });
      if (!device.gatt) throw new Error('Device has no GATT server');

      const onDisconnect = () => {
        this.server = undefined;
        this.channel = undefined;
        this.emit('disconnect', new lib.DisconnectEvent());
        device.removeEventListener('gattserverdisconnected', onDisconnect);
      };
      device.addEventListener('gattserverdisconnected', onDisconnect);

      const server = await device.gatt.connect();
      let found: string[] = [];
      try {
        const services = await server.getPrimaryServices();
        found = services.map((s) => s.uuid);
        console.info('[niimai] services', found);
        const channel = await pickChannel(services);
        if (!channel) throw new Error('Suitable characteristic not found');
        console.info('[niimai] channel', channel.write.uuid, channel.notify.uuid);
        channel.notify.addEventListener('characteristicvaluechanged', (e) => {
          const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
          if (value) this.processRawPacket(value);
        });
        await channel.notify.startNotifications();
        this.server = server;
        this.channel = channel;
      } catch (err) {
        server.disconnect();
        throw describeBleError(err, found);
      }

      await this.negotiateAndGetPrinterInfo(() => this.disconnect());
      const result: ConnectionInfo = {
        deviceName: device.name,
        result: this.printerInfo.connectResult ?? lib.ConnectResult.FirmwareErrors,
      };
      this.emit('connect', new lib.ConnectEvent(result));
      return result;
    }

    isConnected(): boolean {
      return !!this.server && !!this.channel;
    }

    async disconnect(): Promise<void> {
      this.stopHeartbeat();
      this.server?.disconnect();
      this.server = undefined;
      this.channel = undefined;
    }

    async sendRaw(data: Uint8Array, force?: boolean): Promise<void> {
      const send = async () => {
        const c = this.channel?.write;
        if (!c) throw new Error('Channel is closed');
        await lib.Utils.sleep(this.packetIntervalMs);
        const buf = data.slice().buffer;
        if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(buf);
        else await c.writeValueWithResponse(buf);
        this.emit('rawpacketsent', new lib.RawPacketSentEvent(data));
      };
      if (force) await send();
      else await this.mutex.runExclusive(send);
    }

    getType() {
      return 'bluetooth' as const;
    }
  }
  return new FlexibleBleClient();
}
