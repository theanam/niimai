import { CANDIDATE_SERVICES, createBleClient, requestPrinter } from './ble';
import { findPrinterType, identifyPrinter, marklifeModel, PRINTER_CATALOG, type CatalogEntry, type PrinterFamily, type PrinterType } from './catalog';
import { CAT_RX, CAT_SERVICE, CAT_TX, CatPrinterClient } from './cat';
import { ESCPOS_ALT_SERVICE, ESCPOS_ALT_WRITE, ESCPOS_SERVICE, ESCPOS_WRITE, EscPosPrinterClient } from './escpos';
import { MARKLIFE_CONTROL, MARKLIFE_NOTIFY, MARKLIFE_SERVICE, MARKLIFE_WRITE, MarklifePrinterClient } from './marklife';
import { TSPL_NOTIFY, TSPL_SERVICE, TSPL_WRITE, TsplPrinterClient } from './tspl';
import { webTransport } from './thermal';
import type { ClientLike } from './client';
import { RoutedClient } from './routed';

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

const PRINTER_TYPE_NAMES: Record<PrinterFamily, string> = { escpos: 'receipt printer', tspl: 'label printer', cat: 'cat printer', marklife: 'Marklife printer' };

/** The client for a known or hand-picked thermal printer, over the service its family uses; null when the printer lacks it. */
async function thermalClient(device: BluetoothDevice, server: BluetoothRemoteGATTServer, services: string[], entry: CatalogEntry): Promise<ClientLike | null> {
  const { family, model } = entry;
  if (family === 'marklife') {
    const marklife = marklifeModel(entry);
    if (!marklife || !services.includes(MARKLIFE_SERVICE)) return null;
    return new MarklifePrinterClient(await webTransport(device, server, { service: MARKLIFE_SERVICE, write: MARKLIFE_WRITE, notify: MARKLIFE_NOTIFY, control: MARKLIFE_CONTROL }), marklife);
  }
  if (family === 'cat') {
    return services.includes(CAT_SERVICE) ? new CatPrinterClient(await webTransport(device, server, { service: CAT_SERVICE, write: CAT_TX, notify: CAT_RX }), model) : null;
  }
  if (family === 'tspl') {
    return services.includes(TSPL_SERVICE) ? new TsplPrinterClient(await webTransport(device, server, { service: TSPL_SERVICE, write: TSPL_WRITE, notify: TSPL_NOTIFY }), model) : null;
  }
  const fixed = services.includes(ESCPOS_SERVICE)
    ? { service: ESCPOS_SERVICE, write: ESCPOS_WRITE }
    : services.includes(ESCPOS_ALT_SERVICE)
      ? { service: ESCPOS_ALT_SERVICE, write: ESCPOS_ALT_WRITE }
      : null;
  // A printer on a known service may still write through another characteristic: any writable one will do.
  const transport = fixed && (await webTransport(device, server, fixed).catch(() => null));
  if (transport) return new EscPosPrinterClient(transport, model);
  const channel = await writeChannel(server, services);
  return channel ? new EscPosPrinterClient(await webTransport(device, server, channel), model) : null;
}

/** NIIMBOT printers offer one of these; a printer with neither cannot be one. */
const NIIMBOT_SERVICES = CANDIDATE_SERVICES.slice(0, 2);
/** A receipt printer matched by its services: its head's width is unknown until the paper says. */
const RECEIPT: CatalogEntry = { family: 'escpos', model: { prefix: '', confidence: 'medium', generic: true } };
const CAT = findPrinterType('cat')!;

/**
 * What an unknown printer that did not answer as a NIIMBOT is, by its
 * services: the cat service makes it a cat printer, and any other serial
 * service outside NIIMBOT's a receipt printer. Null when it offers only
 * NIIMBOT services, or nothing to print through: those stay NIIMBOT's.
 */
export function byServices(services: string[]): CatalogEntry | null {
  if (services.includes(CAT_SERVICE)) return CAT;
  return services.some((s) => CANDIDATE_SERVICES.includes(s) && !NIIMBOT_SERVICES.includes(s)) ? RECEIPT : null;
}

/**
 * Whether an unknown printer gets the NIIMBOT handshake before its services
 * decide: true (the default) for every name, false for none, or a function of
 * the Bluetooth name. Printers named like a NIIMBOT always get it, since they
 * cannot connect without it. Skipping it keeps receipt printers from printing
 * its bytes as text, but an unknown NIIMBOT offering only NIIMBOT services
 * then fails to connect.
 */
export type NiimbotHandshake = boolean | ((deviceName: string | undefined) => boolean);

/** A family a printer was matched as by its services. */
export type MatchedFamily = 'escpos' | 'cat';
/** Printers matched by their services, by Bluetooth name. */
export type MatchedPrinters = Record<string, MatchedFamily>;

/**
 * Clears out the NIIMBOT tries a receipt printer took as text: FS . leaves
 * Chinese character mode, so no half character swallows what follows; two
 * line feeds print what is left in the buffer, even after a dangling byte;
 * ESC @ resets the printer.
 */
const FLUSH = Uint8Array.from([0x1c, 0x2e, 0x0a, 0x0a, 0x1b, 0x40]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The printer's GATT server again after a failed attempt dropped the link, giving it a moment between tries. */
async function reconnect(device: BluetoothDevice): Promise<BluetoothRemoteGATTServer | null> {
  for (let i = 1; i <= 3; i++) {
    await sleep(RETRY_MS * i);
    const server = await device.gatt?.connect().catch(() => null);
    if (server) return server;
  }
  return null;
}

/** The pause before another try, growing with each one. */
export const RETRY_MS = 250;

/** The name starts like one of niimbluelib's NIIMBOT models ("D110-…", "B21_…"). */
function looksNiimbot(lib: Lib, name: string | undefined): boolean {
  const token = name?.split(/[-_ ]/)[0].toUpperCase();
  return !!token && !!lib.modelsLibrary?.some((m) => m.model.split('_')[0] === token);
}

/**
 * The Bluetooth printer behind the Connect button. One chooser lists NIIMBOT
 * printers and the known extra thermal printers. A known cat printer offering
 * AE30 gets the cat client; a known ESC/POS printer the ESC/POS client, over
 * 18F0, the shared E781 service (as Xprinters use), or any serial service
 * with a writable characteristic; a known TSPL label printer offering 18F0
 * the TSPL client; a known Marklife printer offering FF00 the Marklife
 * client; and everything else the NIIMBOT client exactly as before.
 * Known names never overlap, so each printer matches one client at most.
 */
export class BluetoothPrinter extends RoutedClient {
  constructor(private lib: () => Promise<Lib>) {
    super();
  }

  /** The kind of printer to treat an unrecognised one as; null leaves it to NIIMBOT. */
  private fallback: PrinterType | null = null;

  unrecognisedAs(typeId: string | null) {
    this.fallback = findPrinterType(typeId);
  }

  /** Printers matched by their services before, by Bluetooth name: they skip the NIIMBOT handshake. */
  private remembered: MatchedPrinters = {};
  /** What the printer connected now was matched as by its services, if it was. */
  matchedAs: MatchedFamily | undefined;

  rememberMatches(matches: MatchedPrinters) {
    this.remembered = matches;
  }

  /** See NiimbotHandshake. */
  private handshake: NiimbotHandshake = true;

  niimbotHandshake(policy: NiimbotHandshake) {
    this.handshake = policy;
  }

  async connect() {
    this.matchedAs = undefined;
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
    // Matched by its services before, after NIIMBOT failed it twice: it goes straight to that client, sending no NIIMBOT bytes it would print.
    const before = !entry && device.name && !looksNiimbot(lib, device.name) ? this.remembered[device.name] : undefined;
    if (before && device.gatt) {
      const server = await device.gatt.connect();
      const services = (await server.getPrimaryServices().catch(() => [])).map((s) => s.uuid);
      const client = await thermalClient(device, server, services, before === 'cat' ? CAT : RECEIPT).catch(() => null);
      if (client) {
        this.inner = client;
        this.matchedAs = before;
        return client.connect();
      }
    }
    // Unknown names the app keeps from the handshake go straight to their services.
    const skip = !entry && !looksNiimbot(lib, device.name) && !(typeof this.handshake === 'function' ? this.handshake(device.name) : this.handshake);
    if (skip && device.gatt) return this.byItsServices(device, await device.gatt.connect().catch(() => null), null);
    this.inner = createBleClient(lib, device) as unknown as ClientLike;
    try {
      return await this.inner.connect();
    } catch (err) {
      // A NIIMBOT by name, or a known printer missing its service, keeps its own error, exactly as before.
      if (looksNiimbot(lib, device.name) || entry) throw err;
      return this.unknown(device, err);
    }
  }

  /**
   * An unknown name that failed its first NIIMBOT try. NIIMBOT goes first
   * again, so an unknown NIIMBOT that missed one handshake still gets its
   * own client; only after a second miss do its services decide, and a
   * printer offering only NIIMBOT services is never handed to another client.
   */
  private async unknown(device: BluetoothDevice, first: unknown) {
    await sleep(RETRY_MS);
    try {
      return await this.inner!.connect();
    } catch {
      // Still no NIIMBOT answer: what it offers says what else it is.
    }
    return this.byItsServices(device, await reconnect(device), first);
  }

  /** Connects the client the printer's services point to; `first` is the NIIMBOT error, if it had the handshake. */
  private async byItsServices(device: BluetoothDevice, server: BluetoothRemoteGATTServer | null, first: unknown) {
    const services = server ? (await server.getPrimaryServices().catch(() => [])).map((s) => s.uuid) : [];
    console.info('[niimai] services', device.name, services);
    const guess = byServices(services);
    const client = server && guess ? await thermalClient(device, server, services, guess).catch(() => null) : null;
    if (client) {
      this.inner = client;
      const info = await client.connect();
      this.matchedAs = guess!.family === 'cat' ? 'cat' : 'escpos';
      // The NIIMBOT tries sat in its buffer as text: print them out now, apart from the first label.
      if (this.matchedAs === 'escpos' && first !== null) await (client as unknown as { send(b: Uint8Array): Promise<void> }).send(FLUSH).catch(() => {});
      return info;
    }
    if (first !== null) console.warn('[niimai] connect failed', device.name, first);
    if (!services.length) throw new Error(`${device.name ?? 'This printer'} offers no print service niimai knows. See Help → Printer not recognised.`);
    throw new Error(`Could not connect to ${device.name ?? 'this printer'}. Pick its type under Advanced and connect again.`);
  }
}
