import { createBleClient, requestPrinter } from './ble';
import { CAT_MODELS, CAT_SERVICE, CatPrinterClient, catModelFor, webCatTransport } from './cat';
import type { ClientLike } from './client';

type Lib = typeof import('@mmote/niimbluelib');

/**
 * The Bluetooth printer behind the Connect button. One chooser lists NIIMBOT
 * printers and known cat printers; a known cat printer that offers the AE30
 * service gets the cat client, and everything else the NIIMBOT client exactly
 * as before.
 */
export class BluetoothPrinter implements ClientLike {
  private inner: ClientLike | null = null;

  constructor(private lib: () => Promise<Lib>) {}

  private get client(): ClientLike {
    if (!this.inner) throw new Error('Not connected');
    return this.inner;
  }

  async connect() {
    const device = await requestPrinter(CAT_MODELS.map((m) => m.prefix));
    const cat = catModelFor(device.name);
    if (cat && device.gatt) {
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices().catch(() => []);
      if (services.some((s) => s.uuid === CAT_SERVICE)) {
        this.inner = new CatPrinterClient(await webCatTransport(device, server), cat);
        return this.inner.connect();
      }
    }
    this.inner = createBleClient(await this.lib(), device) as unknown as ClientLike;
    return this.inner.connect();
  }

  async disconnect() {
    await this.inner?.disconnect();
  }

  isConnected() {
    return !!this.inner?.isConnected();
  }

  on(event: string, fn: (e: any) => void) {
    return this.client.on(event, fn);
  }

  off(event: string, fn: (e: any) => void) {
    return this.inner?.off(event, fn);
  }

  getPrinterInfo() {
    return this.inner?.getPrinterInfo() ?? {};
  }

  getModelMetadata() {
    return this.inner?.getModelMetadata();
  }

  getPrintTaskType() {
    return this.inner?.getPrintTaskType();
  }

  getRfidInfo() {
    return this.inner?.getRfidInfo() ?? {};
  }

  fetchRfidInfo() {
    return this.client.fetchRfidInfo();
  }

  startHeartbeat() {
    this.inner?.startHeartbeat();
  }

  stopHeartbeat() {
    this.inner?.stopHeartbeat();
  }

  isHeartbeatStarted() {
    return !!this.inner?.isHeartbeatStarted?.();
  }

  get protocol() {
    return this.client.protocol;
  }

  get encodePage() {
    return this.inner?.encodePage?.bind(this.inner);
  }
}
