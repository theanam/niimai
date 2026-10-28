import { LABEL_PRESETS, type LabelSize } from '../doc/model';
import { TEMPLATE_SIZES } from '../templates';
import KNOWN from './known-rolls.json';
import { printheadMm, type PrinterProfile } from './profiles';
import type { PrinterStatus } from './service';

/**
 * NIIMBOT roll barcodes (read from the roll's RFID tag) and their label size.
 * Most printers do not report the size, so known rolls fill it in. Add rolls
 * here as `"barcode": { "widthMm": 40, "heightMm": 12 }`.
 */
export const KNOWN_ROLLS = KNOWN as Record<string, LabelSize>;

export interface RollState {
  /** Null while the size is unknown. */
  size: LabelSize | null;
  /** Identifies the roll, so the size is applied once per roll. */
  key: string | null;
  /** A roll is loaded but its size has to come from the user. */
  needsSize: boolean;
}

/**
 * Works out the loaded roll's size: what the printer reports, then sizes the
 * user saved for this roll, then the built-in table of known rolls.
 */
export function resolveRoll(label: PrinterStatus['label'], saved: Record<string, LabelSize>, known: Record<string, LabelSize> = KNOWN_ROLLS): RollState {
  if (!label) return { size: null, key: null, needsSize: false };
  if (label.widthMm && label.heightMm) {
    const size = { widthMm: label.widthMm, heightMm: label.heightMm };
    return { size, key: label.barcode ?? `${size.widthMm}x${size.heightMm}`, needsSize: false };
  }
  if (!label.barcode) return { size: null, key: null, needsSize: false };
  const size = saved[label.barcode] ?? known[label.barcode] ?? null;
  return { size, key: label.barcode, needsSize: !size };
}

export const sameSize = (a: LabelSize, b: LabelSize): boolean =>
  a.widthMm === b.widthMm && a.heightMm === b.heightMm && (a.tailMm ?? 0) === (b.tailMm ?? 0);

/**
 * Roll sizes worth offering for a printer: the ones whose edge across the
 * printhead suits its width. Labels run a little wider than the printable
 * area, so the limit allows some slack.
 */
export function sizesForPrinter(profile: PrinterProfile | null): LabelSize[] {
  const all = [...LABEL_PRESETS, ...TEMPLATE_SIZES].filter((s, i, list) => list.findIndex((o) => sameSize(o, s)) === i);
  const sorted = all.sort((a, b) => a.heightMm - b.heightMm || a.widthMm - b.widthMm);
  if (!profile) return sorted;
  const head = printheadMm(profile);
  const across = (s: LabelSize) => (profile.printDirection === 'left' ? s.heightMm : s.widthMm);
  return sorted.filter((s) => across(s) <= head * 1.3 && across(s) >= head * 0.5);
}
