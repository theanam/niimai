/**
 * libniimai: connect to NIIMBOT, TSPL, ESC/POS and cat printers from the
 * browser over Web Bluetooth, Web Serial or WebUSB, and print a canvas on them.
 */
/// <reference types="web-bluetooth" preserve="true" />
/// <reference types="w3c-web-serial" preserve="true" />
/// <reference types="w3c-web-usb" preserve="true" />
import { BluetoothPrinter } from './bluetooth';
import type { ClientLike, ConnectionKind } from './client';
import { MockClient } from './mock';
import { PrinterService, type ClientFactory } from './service';
import { UsbPrinter } from './usb';

// niimbluelib loads only when it is needed, so pages that never meet a NIIMBOT stay light.
const niimbot = () => import('@mmote/niimbluelib');

/**
 * A client for one kind of connection. Bluetooth finds the printer family
 * from the device the user picks; serial is NIIMBOT only; usb is for label
 * and receipt printers that show up as standard USB printers; demo is a
 * printer in memory.
 */
export async function createClient(kind: ConnectionKind): Promise<ClientLike> {
  if (kind === 'demo') return new MockClient();
  if (kind === 'bluetooth') return new BluetoothPrinter(niimbot);
  if (kind === 'usb') return new UsbPrinter();
  const lib = await niimbot();
  return new lib.NiimbotSerialClient() as unknown as ClientLike;
}

export interface CreatePrinterOptions {
  /**
   * Makes the client for each connection. Defaults to createClient; wrap it
   * to change one kind of connection and keep the others.
   */
  createClient?: ClientFactory;
}

/** A ready printer service: connect, watch its status, print canvases. */
export function createPrinter(options: CreatePrinterOptions = {}): PrinterService {
  return new PrinterService(options.createClient ?? createClient, async (canvas, direction) =>
    (await niimbot()).ImageEncoder.encodeCanvas(canvas, 0, direction),
  );
}

export { PrinterService, DEMO_NAME, friendlyError, fitToPrinthead, rotateCanvas, shiftCanvas } from './service';
export type { ClientFactory, PageSource, PrinterState, PrinterStatus, PrintOffset, PrintOptions, Rotation } from './service';

export { connectErrorTopic, detectBrowser, detectPlatform, supportIssue, supportsBluetooth, supportsSerial, supportsUsb, unsupportedReason } from './client';
export type { BrowserEnv, BrowserInfo, BrowserName, ClientLike, ConnectionKind, OperatingSystem, Platform, PrintTaskLike, SetupTopic, SupportIssue } from './client';

export { correctTask, findManualProfile, inkOutsideHead, MANUAL_PROFILES, printheadCrop, printheadMm, resolveProfile } from './profiles';
export type { LabelSize, PrintDirection, PrinterProfile } from './profiles';

export { effectivePaper, labelTypeOf, PAPER_TYPES, paperFromLabelType, paperName } from './paper';
export type { PaperType } from './paper';

export { findPrinterType, identifyPrinter, identifyUsbPrinter, PRINTER_CATALOG, PRINTER_TYPES } from './catalog';
export type { CatalogEntry, PrinterFamily, PrinterType } from './catalog';

export { BluetoothPrinter, byServices, type MatchedFamily, type MatchedPrinters } from './bluetooth';
export { familiesFromDeviceId, parseDeviceId, rememberedUsbPrinters, UsbPrinter, usbTransport, USB_PRINTER_CLASS } from './usb';
export { describeBleError } from './ble';
export { DEMO_META, MockClient } from './mock';

export { modelFor, THERMAL_DEFAULT_SIZE, THERMAL_HEAD_DOTS, THERMAL_HEAD_MM, THERMAL_SIZES, ThermalPrinterClient, webTransport } from './thermal';
export type { Confidence, Pace, ThermalModel, ThermalTransport } from './thermal';

export { CAT_MODELS, CAT_UNSUPPORTED, CatPrinterClient, catFeed, catModelFor, printJob as catJob } from './cat';
export type { CatModel } from './cat';
export { ESCPOS_MODELS, EscPosPrinterClient, escposFeed, escposJob, escposModelFor } from './escpos';
export { TSPL_MODELS, TSPL_SIZES, TsplPrinterClient, tsplJob, tsplModelFor } from './tspl';
