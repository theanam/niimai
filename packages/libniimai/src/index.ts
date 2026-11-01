/**
 * libniimai: connect to NIIMBOT, TSPL, ESC/POS and cat printers from the
 * browser over Web Bluetooth or Web Serial, and print a canvas on them.
 */
/// <reference types="web-bluetooth" preserve="true" />
/// <reference types="w3c-web-serial" preserve="true" />
import { BluetoothPrinter } from './bluetooth';
import type { ClientLike, ConnectionKind } from './client';
import { MockClient } from './mock';
import { PrinterService, type ClientFactory } from './service';

// niimbluelib loads only when it is needed, so pages that never meet a NIIMBOT stay light.
const niimbot = () => import('@mmote/niimbluelib');

/**
 * A client for one kind of connection. Bluetooth finds the printer family
 * from the device the user picks; serial is NIIMBOT only; demo is a printer
 * in memory.
 */
export async function createClient(kind: ConnectionKind): Promise<ClientLike> {
  if (kind === 'demo') return new MockClient();
  if (kind === 'bluetooth') return new BluetoothPrinter(niimbot);
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

export { PrinterService, DEMO_NAME, friendlyError, fitToPrinthead, shiftCanvas } from './service';
export type { ClientFactory, PageSource, PrinterState, PrinterStatus, PrintOffset, PrintOptions } from './service';

export { detectPlatform, supportsBluetooth, supportsSerial, unsupportedReason } from './client';
export type { ClientLike, ConnectionKind, Platform, PrintTaskLike } from './client';

export { correctTask, findManualProfile, inkOutsideHead, MANUAL_PROFILES, printheadCrop, printheadMm, resolveProfile } from './profiles';
export type { LabelSize, PrintDirection, PrinterProfile } from './profiles';

export { effectivePaper, labelTypeOf, PAPER_TYPES, paperFromLabelType, paperName } from './paper';
export type { PaperType } from './paper';

export { BluetoothPrinter } from './bluetooth';
export { describeBleError } from './ble';
export { DEMO_META, MockClient } from './mock';

export { modelFor, THERMAL_DEFAULT_SIZE, THERMAL_HEAD_DOTS, THERMAL_HEAD_MM, THERMAL_SIZES, ThermalPrinterClient, webTransport } from './thermal';
export type { Confidence, Pace, ThermalModel, ThermalTransport } from './thermal';

export { CAT_MODELS, CAT_UNSUPPORTED, CatPrinterClient, catModelFor, printJob as catJob } from './cat';
export type { CatModel } from './cat';
export { ESCPOS_MODELS, EscPosPrinterClient, escposJob, escposModelFor } from './escpos';
export { TSPL_MODELS, TSPL_SIZES, TsplPrinterClient, tsplJob, tsplModelFor } from './tspl';
