import { CANDIDATE_SERVICES, createBleClient, requestPrinter } from './ble';
import { findPrinterType, identifyPrinter, PRINTER_CATALOG, type CatalogEntry, type PrinterFamily, type PrinterType } from './catalog';
import { CAT_RX, CAT_SERVICE, CAT_TX, CatPrinterClient } from './cat';
import { ESCPOS_ALT_SERVICE, ESCPOS_ALT_WRITE, ESCPOS_SERVICE, ESCPOS_WRITE, EscPosPrinterClient } from './escpos';
import { TSPL_NOTIFY, TSPL_SERVICE, TSPL_WRITE, TsplPrinterClient } from './tspl';
import { webTransport } from './thermal';
import type { ClientLike } from './client';

type Lib = typeof import('@mmote/niimbluelib');

/**
 * A writable characteristic on one of the serial services budget printers
 * offer, for ESC/POS printers on none of the known layouts.
 */
async function writeChannel(server: BluetoothRemoteGATTServer, services: string[]): Promise<{ service: string; write: string } | null> {
  for (const service of CANDIDATE_SERVICES) {
    if (!services.includes(service) || service === CAT_SERVICE) continue;
    const chars = await server
      .getPrimaryService(service)
      .then((s) => s.getCharacteristics())
      .catch(() => []);
    const write = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
    if (write) return { service, write: write.uuid };
  }
  return null;
}

const PRINTER_TYPE_NAMES: Record<PrinterFamily, string> = { escpos: 'receipt printer', tspl: 'label printer', cat: 'cat printer' };

/** The client for a known or hand-picked thermal printer, over the service its family uses; null when the printer lacks it. */
async function thermalClient(device: BluetoothDevice, server: BluetoothRemoteGATTServer, services: string[], { family, model }: CatalogEntry): Promise<ClientLike | null> {
  if (family === 'cat') {
    return services.includes(CAT_SERVICE) ? new CatPrinterClient(await webTransport(device, server, { service: CAT_SERVICE, write: CAT_TX, notify: CAT_RX }), model) : null;
  }
  if (family === 'tspl') {
    return services.includes(TSPL_SERVICE) ? new TsplPrinterClient(await webTransport(device, server, { service: TSPL_SERVICE, write: TSPL_WRITE, notify: TSPL_NOTIFY }), model) : null;
  }
  const channel = services.includes(ESCPOS_SERVICE)
    ? { service: ESCPOS_SERVICE, write: ESCPOS_WRITE }
    : services.includes(ESCPOS_ALT_SERVICE)
      ? { service: ESCPOS_ALT_SERVICE, write: ESCPOS_ALT_WRITE }
      : await writeChannel(server, services);
  return channel ? new EscPosPrinterClient(await webTransport(device, server, channel), model) : null;
}

/** The name starts like one of niimbluelib's NIIMBOT models ("D110-…", "B21_…"). */
function looksNiimbot(lib: Lib, name: string | undefined): boolean {
  const token = name?.split(/[-_ ]/)[0].toUpperCase();
  return !!token && lib.modelsLibrary.some((m) => m.model.split('_')[0] === token);
}

/**
 * The Bluetooth printer behind the Connect button. One chooser lists NIIMBOT
 * printers and the known extra thermal printers. A known cat printer offering
 * AE30 gets the cat client; a known ESC/POS printer the ESC/POS client, over
 * 18F0, the shared E781 service (as Xprinters use), or any serial service
 * with a writable characteristic; a known TSPL label printer offering 18F0
 * the TSPL client; and everything else the NIIMBOT client exactly as before.
 * Known names never overlap, so each printer matches one client at most.
 */
export class BluetoothPrinter implements ClientLike {
  private inner: ClientLike | null = null;

  constructor(private lib: () => Promise<Lib>) {}

  private get client(): ClientLike {
    if (!this.inner) throw new Error('Not connected');
    return this.inner;
  }

  /** The kind of printer to treat an unrecognised one as; null leaves it to NIIMBOT. */
  private fallback: PrinterType | null = null;

  unrecognisedAs(typeId: string | null) {
    this.fallback = findPrinterType(typeId);
  }

  async connect() {
    // With a type picked for unrecognised printers, the chooser lists every device, whatever its name.
    const device = await requestPrinter(
      PRINTER_CATALOG.map((e) => e.model.prefix),
      !!this.fallback,
    );
    const known = identifyPrinter(device.name);
    // A hand-picked type is only for printers that are neither known nor named like a NIIMBOT: a NIIMBOT always keeps its own client.
    const fallback = !known && this.fallback && !looksNiimbot(await this.lib(), device.name) ? this.fallback : null;
    const entry = known ?? fallback;
    if (entry && device.gatt) {
      const server = await device.gatt.connect();
      const services = (await server.getPrimaryServices().catch(() => [])).map((s) => s.uuid);
      this.inner = await thermalClient(device, server, services, entry);
      if (this.inner) return this.inner.connect();
      // A printer set to a type by hand that lacks its service should say so, not fall to NIIMBOT.
      if (!known) throw new Error(`${device.name ?? 'This printer'} does not offer a ${PRINTER_TYPE_NAMES[entry.family]} service`);
    }
    const lib = await this.lib();
    this.inner = createBleClient(lib, device) as unknown as ClientLike;
    try {
      return await this.inner.connect();
    } catch (err) {
      if (looksNiimbot(lib, device.name)) throw err;
      throw new Error(`${device.name ?? 'This printer'} did not answer as a NIIMBOT. If it is another kind, pick its type under Advanced and connect again.`);
    }
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

  get rollKey() {
    return this.inner?.rollKey?.bind(this.inner);
  }

  get feedPaper() {
    return this.inner?.feedPaper?.bind(this.inner);
  }

  get feedsBack() {
    return this.inner?.feedsBack;
  }
}
