/**
 * ESC/POS mini printers: 58 mm Bluetooth receipt printers such as the MP583
 * (YAEN MPT-II). They take standard raster images (GS v 0) over the 18F0
 * printer service. See thermal.ts for what they share with other extras.
 */
import { modelFor, packRows, THERMAL_HEAD_DOTS, ThermalPrinterClient, type Pace, type ThermalModel, type ThermalTransport } from './thermal';

export const ESCPOS_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
export const ESCPOS_WRITE = '00002af1-0000-1000-8000-00805f9b34fb';

/**
 * Models known to take ESC/POS raster images over 18F0. "tested": printed
 * with niimai on real hardware. "medium": the same chipset and service are
 * widely reported, untested here.
 */
export const ESCPOS_MODELS: ThermalModel[] = [
  { prefix: 'MP583', confidence: 'tested', note: 'Sold as YAEN MPT-II' },
  { prefix: 'MPT-II', confidence: 'high' },
  { prefix: 'MP58', confidence: 'medium' },
  { prefix: 'MTP-II', confidence: 'medium' },
  { prefix: 'PT-210', confidence: 'medium' },
  { prefix: 'PT-200', confidence: 'medium' },
  { prefix: 'RPP02', confidence: 'medium' },
  { prefix: 'ZJ-58', confidence: 'medium' },
];

export const escposModelFor = (name: string | undefined): ThermalModel | null => modelFor(ESCPOS_MODELS, name);

const ROW_BYTES = THERMAL_HEAD_DOTS / 8;
/** Rows per raster command; small bands keep the printer's buffer from overflowing. */
const BAND = 24;
/** Dots fed between copies. */
const GAP_DOTS = 24;
/** Lines fed after the last copy, so the print clears the tear bar. */
const FEED_LINES = 4;

/** Rows for an ESC/POS printer: leftmost dot in the highest bit. */
export const encodeRows = (data: ArrayLike<number>, width: number, height: number): Uint8Array[] => packRows(data, width, height, 'msb');

/** ESC @, then each copy as GS v 0 bands with a gap between, then a feed. */
export function escposJob(rows: Uint8Array[], copies: number): Uint8Array {
  const out: number[] = [0x1b, 0x40];
  for (let c = 0; c < copies; c++) {
    if (c > 0) out.push(0x1b, 0x4a, GAP_DOTS);
    for (let i = 0; i < rows.length; i += BAND) {
      const band = rows.slice(i, i + BAND);
      out.push(0x1d, 0x76, 0x30, 0x00, ROW_BYTES & 0xff, ROW_BYTES >> 8, band.length & 0xff, band.length >> 8);
      for (const row of band) out.push(...row);
    }
  }
  out.push(0x1b, 0x64, FEED_LINES);
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

  constructor(
    transport: ThermalTransport,
    readonly model: ThermalModel | null,
    pace: Pace = { chunkMs: 30, pauseMs: 100 },
  ) {
    super(transport, pace, 100);
    this.modelName = model?.prefix ?? (transport.name || 'Thermal printer');
  }

  protected encodeRows(data: ArrayLike<number>, width: number, height: number) {
    return encodeRows(data, width, height);
  }

  protected job(rows: Uint8Array[], _density: number, copies: number) {
    return escposJob(rows, copies);
  }
}
