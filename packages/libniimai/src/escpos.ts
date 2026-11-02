/**
 * ESC/POS mini printers: 58 mm Bluetooth receipt printers such as the MP583
 * (YAEN MPT-II). They take standard raster images (GS v 0) over the 18F0
 * printer service. See thermal.ts for what they share with other extras.
 */
import { modelFor, packRows, shownName, THERMAL_HEAD_DOTS, ThermalPrinterClient, type Pace, type ThermalModel, type ThermalTransport } from './thermal';

export const ESCPOS_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
export const ESCPOS_WRITE = '00002af1-0000-1000-8000-00805f9b34fb';
/** The serial service many budget printers offer, Xprinter among them; NIIMBOT printers use it too. */
export const ESCPOS_ALT_SERVICE = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
export const ESCPOS_ALT_WRITE = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';

/**
 * Models known to take ESC/POS raster images, by Bluetooth name. "tested":
 * printed with niimai on real hardware. "high": supported by several
 * open-source printer projects. "medium": the name is reported by one or two
 * of them, untested here. Names from receipt-printer projects such as
 * WebBluetoothReceiptPrinter and bitbank2/Thermal_Printer; see
 * docs/thermal-printers.md for sources. Most of these printers share one
 * Bluetooth module, so its services tell nothing apart: the name decides.
 */
// A model's prefix is the name it shows and the key its saved settings live under, so existing entries never change it.
export const ESCPOS_MODELS: ThermalModel[] = [
  { prefix: 'MP583', confidence: 'tested', note: 'Sold as YAEN MPT-II' },
  { prefix: 'MPT-II', confidence: 'high', note: 'Stock module name on many 58 mm printers' },
  { prefix: 'MP58', confidence: 'medium' },
  { prefix: 'MP210', confidence: 'medium' },
  { prefix: 'MTP-II', confidence: 'high', note: 'Stock module name on many 58 mm printers' },
  { prefix: 'MTP-2', confidence: 'medium' },
  { prefix: 'MPT-3', confidence: 'medium', note: '80 mm', headDots: 576 },
  { prefix: 'MTP-3', confidence: 'medium', note: '80 mm', headDots: 576 },
  { prefix: 'PT-210', confidence: 'high', brand: 'Goojprt PT-210' },
  { prefix: 'PT210', confidence: 'medium', brand: 'Goojprt PT-210' },
  { prefix: 'GOJRPT', confidence: 'medium', brand: 'Goojprt' },
  { prefix: 'Gojprt', confidence: 'medium', brand: 'Goojprt' },
  { prefix: 'PT-200', confidence: 'medium' },
  { prefix: 'RPP02', confidence: 'high', brand: 'Rongta RPP02N', note: 'Also sold as EPPOS EP58 Plus' },
  { prefix: 'RPP300', confidence: 'medium', brand: 'Rongta RPP300', note: '80 mm', headDots: 576 },
  { prefix: 'ZJ-58', confidence: 'medium', brand: 'Zjiang' },
  { prefix: 'TM-P', confidence: 'medium', brand: 'Epson TM-P series' },
  { prefix: 'XP-P323B', confidence: 'medium', brand: 'Xprinter XP-P323B', note: '80 mm', headDots: 576 },
  { prefix: 'XP-', confidence: 'medium', brand: 'other Xprinters', generic: true },
  // Many budget printers keep their Bluetooth module's stock name: the Xprinter XP-58IIL shows as "Printer001".
  { prefix: 'Printer', confidence: 'tested', brand: 'Xprinter XP-58IIL, HOIN, Gprinter', note: 'Stock module name', generic: true },
  { prefix: 'printer', confidence: 'medium', note: 'Stock module name', generic: true },
  { prefix: 'BlueTooth Printer', confidence: 'medium', note: 'Stock module name: Zjiang POS-5805 and others', generic: true },
  { prefix: '58Printer', confidence: 'medium', note: 'Stock module name', generic: true },
];

export const escposModelFor = (name: string | undefined): ThermalModel | null => modelFor(ESCPOS_MODELS, name);

/** Rows per raster command; small bands keep the printer's buffer from overflowing. */
const BAND = 24;
/** Dots fed between copies. */
const GAP_DOTS = 24;
/** Lines fed after the last copy, so the print clears the tear bar. */
const FEED_LINES = 4;

/** Rows for an ESC/POS printer: leftmost dot in the highest bit, centred on a head `head` dots wide. */
export const encodeRows = (data: ArrayLike<number>, width: number, height: number, head = THERMAL_HEAD_DOTS): Uint8Array[] =>
  packRows(data, width, height, 'msb', head);

/**
 * ESC @, then each copy as GS v 0 bands with a gap between, then a feed past
 * the tear bar. With `gapDots`, for labels with gaps, every label is followed
 * by exactly that feed, so the next print starts on the next label.
 */
export function escposJob(rows: Uint8Array[], copies: number, gapDots?: number): Uint8Array {
  const out: number[] = [0x1b, 0x40];
  const rowBytes = rows[0]?.length ?? THERMAL_HEAD_DOTS / 8;
  for (let c = 0; c < copies; c++) {
    if (c > 0) out.push(...escposFeed(gapDots ?? GAP_DOTS));
    for (let i = 0; i < rows.length; i += BAND) {
      const band = rows.slice(i, i + BAND);
      out.push(0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, band.length & 0xff, band.length >> 8);
      for (const row of band) out.push(...row);
    }
  }
  if (gapDots === undefined) out.push(0x1b, 0x64, FEED_LINES);
  else out.push(...escposFeed(gapDots));
  return Uint8Array.from(out);
}

/**
 * Moves the paper forward by `dots`: line feeds with the line spacing set to
 * the distance (ESC 3 n, LF), then the default spacing back (ESC 2). The
 * MP583 ignores ESC J, the usual dot feed, but takes line feeds. These
 * printers have no reverse feed.
 */
export function escposFeed(dots: number): Uint8Array {
  const out: number[] = [];
  for (let left = Math.round(dots); left > 0; left -= 255) out.push(0x1b, 0x33, Math.min(255, left), 0x0a);
  if (out.length) out.push(0x1b, 0x32);
  return Uint8Array.from(out);
}

/**
 * An ESC/POS printer: the shared thermal client with raster commands. These
 * printers send no flow control, so writes are paced. Heat settings vary by
 * vendor, so darkness is left to the printer.
 */
export class EscPosPrinterClient extends ThermalPrinterClient {
  protected readonly densityLevels = 1;
  protected readonly modelName: string;
  protected readonly headDots: number;

  constructor(
    transport: ThermalTransport,
    readonly model: ThermalModel | null,
    pace: Pace = { chunkMs: 30, pauseMs: 100 },
  ) {
    super(transport, pace, 100);
    this.modelName = shownName(model, transport, 'Thermal printer');
    this.headDots = model?.headDots ?? THERMAL_HEAD_DOTS;
  }

  protected encodeRows(data: ArrayLike<number>, width: number, height: number) {
    return encodeRows(data, width, height, this.headDots);
  }

  protected job(rows: Uint8Array[], _density: number, copies: number, _labelType: number, gapDots?: number) {
    return escposJob(rows, copies, gapDots);
  }

  /** These printers cannot sense the paper, so the user lines it up by hand. */
  async feedPaper(dots: number): Promise<void> {
    if (dots < 0) throw new Error('This printer cannot move the paper back');
    await this.send(escposFeed(dots));
  }
}
