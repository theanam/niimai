/**
 * Label and receipt printers on a USB cable that show up as standard USB
 * printers (interface class 7), which Web Serial cannot see. They take the
 * same TSPL or ESC/POS bytes as over Bluetooth, through WebUSB. NIIMBOT
 * printers show up as serial ports and keep using Web Serial.
 */
import { cableClient, findPrinterType, identifyUsbPrinter, type CatalogEntry, type PrinterFamily, type PrinterType } from './catalog';
import { supportsUsb } from './client';
import type { ThermalTransport } from './thermal';
import { RoutedClient } from './routed';

export const USB_PRINTER_CLASS = 7;

/** USB moves data far faster than Bluetooth and paces itself, so writes are large and back to back. */
const USB_PACE = { chunkMs: 0, pauseMs: 100 };
const USB_CHUNK = 4096;
/** Label printers may not send "OK" over USB; a status query after this long tells a fault from a quiet printer. */
const USB_ACK_TIMEOUT_MS = 5_000;

/**
 * The fields of an IEEE 1284 device ID, keys in capitals:
 * "MFG:ACME;COMMAND SET:TSC/ESC/POS;MODEL:CC390;" → { MFG, 'COMMAND SET', MODEL }.
 */
export function parseDeviceId(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of text.split(';')) {
    const at = part.indexOf(':');
    if (at > 0) fields[part.slice(0, at).trim().toUpperCase()] = part.slice(at + 1).trim();
  }
  return fields;
}

/** The printer languages a device ID names, TSPL first: label printers often take ESC/POS as well. */
export function familiesFromDeviceId(text: string): PrinterFamily[] {
  const id = parseDeviceId(text);
  const commands = id.CMD ?? id['COMMAND SET'] ?? '';
  const families: PrinterFamily[] = [];
  if (/\b(TSPL2?|TSC)\b/i.test(commands)) families.push('tspl');
  if (/ESC\/?POS|\bEPSON\b/i.test(commands)) families.push('escpos');
  return families;
}

const isPrinter = (device: USBDevice) =>
  device.configuration?.interfaces.some((i) => i.alternates.some((a) => a.interfaceClass === USB_PRINTER_CLASS)) ??
  // Devices not yet opened show no configuration; the chooser only lists printers anyway.
  true;

/** USB printers this site may already use that are plugged in. */
export async function rememberedUsbPrinters(): Promise<USBDevice[]> {
  if (!supportsUsb()) return [];
  return (await navigator.usb.getDevices().catch(() => [])).filter(isPrinter);
}

/** Opens a USB printer and claims its printer interface. Also reads the printer's device ID. */
export async function usbTransport(device: USBDevice): Promise<{ transport: ThermalTransport; deviceId: string }> {
  await device.open();
  if (!device.configuration) await device.selectConfiguration(1);
  const iface = device.configuration!.interfaces.find((i) => i.alternates.some((a) => a.interfaceClass === USB_PRINTER_CLASS));
  if (!iface) throw new Error(`${device.productName ?? 'This device'} is not a USB printer`);
  const alt = iface.alternates.find((a) => a.interfaceClass === USB_PRINTER_CLASS)!;
  await device.claimInterface(iface.interfaceNumber);
  if (alt.alternateSetting !== 0) await device.selectAlternateInterface(iface.interfaceNumber, alt.alternateSetting);
  const out = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
  const back = alt.endpoints.find((e) => e.direction === 'in' && e.type === 'bulk');
  if (!out) throw new Error(`${device.productName ?? 'This printer'} has no way to send it data`);

  // GET_DEVICE_ID: interface in the high byte of the index, alternate setting in the low byte.
  const deviceId = await device
    .controlTransferIn({ requestType: 'class', recipient: 'interface', request: 0, value: 0, index: (iface.interfaceNumber << 8) | alt.alternateSetting }, 1024)
    .then((r) => (r.data ? new TextDecoder().decode(new Uint8Array(r.data.buffer, r.data.byteOffset + 2, Math.max(0, r.data.byteLength - 2))) : ''))
    .catch(() => '');

  const notify: ((d: Uint8Array) => void)[] = [];
  const gone: (() => void)[] = [];
  let open = true;
  // Replies (TSPL's "OK", status bytes) arrive on the bulk in endpoint; read it until the device closes.
  if (back) {
    void (async () => {
      while (open) {
        const r = await device.transferIn(back.endpointNumber, back.packetSize).catch(() => null);
        if (!r) break;
        if (r.data?.byteLength) notify.forEach((fn) => fn(new Uint8Array(r.data!.buffer.slice(r.data!.byteOffset, r.data!.byteOffset + r.data!.byteLength))));
      }
    })();
  }
  const onUnplug = (e: USBConnectionEvent) => {
    if (e.device !== device) return;
    open = false;
    navigator.usb.removeEventListener('disconnect', onUnplug);
    gone.forEach((fn) => fn());
  };
  navigator.usb.addEventListener('disconnect', onUnplug);

  return {
    deviceId,
    transport: {
      name: device.productName || undefined,
      chunkBytes: USB_CHUNK,
      write: async (chunk) => {
        const r = await device.transferOut(out.endpointNumber, chunk.slice());
        if (r.status !== 'ok') throw new Error('The printer did not take the data');
      },
      onNotify: (fn) => notify.push(fn),
      onDisconnect: (fn) => gone.push(fn),
      disconnect: async () => {
        open = false;
        navigator.usb.removeEventListener('disconnect', onUnplug);
        await device.releaseInterface(iface.interfaceNumber).catch(() => {});
        await device.close().catch(() => {});
      },
    },
  };
}

const PRINTER_TYPE_NAMES: Record<PrinterFamily, string> = { escpos: 'receipt printer', tspl: 'label printer', cat: 'cat printer' };

/**
 * The USB printer behind the USB button for label and receipt printers. A
 * printer this site already uses connects straight away when it is the only
 * one plugged in; otherwise the browser lists USB printers. The printer's
 * language comes from the catalog, then from the type picked under Advanced
 * when the printer speaks it (or does not say), then from the device ID the
 * printer reports.
 */
export class UsbPrinter extends RoutedClient {
  private fallback: PrinterType | null = null;

  unrecognisedAs(typeId: string | null) {
    this.fallback = findPrinterType(typeId);
  }

  async connect() {
    const remembered = await rememberedUsbPrinters();
    const device = remembered.length === 1 ? remembered[0] : await navigator.usb.requestDevice({ filters: [{ classCode: USB_PRINTER_CLASS }] });
    const { transport, deviceId } = await usbTransport(device);
    const name = device.productName || 'This printer';
    const families = familiesFromDeviceId(deviceId);
    const picked = this.fallback && (!families.length || families.includes(this.fallback.family)) ? this.fallback : null;
    const entry: CatalogEntry | null =
      identifyUsbPrinter(device) ?? picked ?? (families.length ? { family: families[0], model: { prefix: '', confidence: 'medium', generic: true } } : null);
    if (!entry) {
      await transport.disconnect();
      throw new Error(`${name} did not say which printer language it speaks. Pick its type under Advanced and connect again.`);
    }
    this.inner = cableClient(entry, transport, USB_PACE, USB_ACK_TIMEOUT_MS);
    if (!this.inner) {
      await transport.disconnect();
      throw new Error(`A ${PRINTER_TYPE_NAMES[entry.family]} cannot print over USB`);
    }
    return this.inner.connect();
  }
}
