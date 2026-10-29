import { createBleClient, requestPrinter } from './ble';
import { CAT_MODELS, CAT_RX, CAT_SERVICE, CAT_TX, CatPrinterClient, catModelFor } from './cat';
import { ESCPOS_MODELS, ESCPOS_SERVICE, ESCPOS_WRITE, EscPosPrinterClient, escposModelFor } from './escpos';
import { webTransport } from './thermal';
import type { ClientLike } from './client';

type Lib = typeof import('@mmote/niimbluelib');

/**
 * The Bluetooth printer behind the Connect button. One chooser lists NIIMBOT
 * printers and the known extra thermal printers. A known cat printer offering
 * AE30 gets the cat client, a known ESC/POS printer offering 18F0 the ESC/POS
 * client, and everything else the NIIMBOT client exactly as before.
 */
export class BluetoothPrinter implements ClientLike {
  private inner: ClientLike | null = null;

  constructor(private lib: () => Promise<Lib>) {}

  private get client(): ClientLike {
    if (!this.inner) throw new Error('Not connected');
    return this.inner;
  }

  async connect() {
    const device = await requestPrinter([...CAT_MODELS, ...ESCPOS_MODELS].map((m) => m.prefix));
    const cat = catModelFor(device.name);
    const escpos = escposModelFor(device.name);
    if ((cat || escpos) && device.gatt) {
      const server = await device.gatt.connect();
      const services = (await server.getPrimaryServices().catch(() => [])).map((s) => s.uuid);
      if (cat && services.includes(CAT_SERVICE)) {
        this.inner = new CatPrinterClient(await webTransport(device, server, { service: CAT_SERVICE, write: CAT_TX, notify: CAT_RX }), cat);
      } else if (escpos && services.includes(ESCPOS_SERVICE)) {
        this.inner = new EscPosPrinterClient(await webTransport(device, server, { service: ESCPOS_SERVICE, write: ESCPOS_WRITE }), escpos);
      }
      if (this.inner) return this.inner.connect();
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
