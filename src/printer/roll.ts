import { LABEL_PRESETS, type LabelSize } from '../doc/model';
import { TEMPLATE_SIZES } from '../templates';
import { THERMAL_SIZES } from './thermal';
import KNOWN from './known-rolls.json';
import type { PaperType } from './paper';
import { printheadMm, type PrinterProfile } from './profiles';
import type { PrinterStatus } from './service';

/** A NIIMBOT roll identified by the barcode on its RFID tag. */
export interface KnownRoll extends LabelSize {
  /** Product name, e.g. "RP15×30 white". */
  name: string;
  paper?: PaperType;
}

/**
 * NIIMBOT roll barcodes and their label size. The tag's barcode is the roll's
 * retail EAN-13, so shop listings fill most of this in; see docs/known-rolls.md
 * for sources. Most printers do not report the size, so this is how rolls are
 * recognised.
 */
export const KNOWN_ROLLS = KNOWN as Record<string, KnownRoll>;

const sizeOnly = (s: LabelSize): LabelSize => ({
  widthMm: s.widthMm,
  heightMm: s.heightMm,
  ...(s.tailMm ? { tailMm: s.tailMm } : {}),
  ...(s.fold ? { fold: s.fold } : {}),
});

/** Every size a known roll comes in, once each. */
export const KNOWN_ROLL_SIZES: LabelSize[] = Object.values(KNOWN_ROLLS)
  .map(sizeOnly)
  .filter((s, i, list) => list.findIndex((o) => sameSize(o, s)) === i);

export interface RollState {
  /** Null while the size is unknown. */
  size: LabelSize | null;
  /** Product name when the roll is in the known-roll table. */
  name?: string;
  /** Identifies the roll, so the size is applied once per roll. */
  key: string | null;
  /** A roll is loaded but its size has to come from the user. */
  needsSize: boolean;
}

/**
 * Works out the loaded roll's size: what the printer reports, then sizes the
 * user saved for this roll, then the built-in table of known rolls.
 */
export function resolveRoll(label: PrinterStatus['label'], saved: Record<string, LabelSize>, known: Record<string, LabelSize & { name?: string }> = KNOWN_ROLLS): RollState {
  if (!label) return { size: null, key: null, needsSize: false };
  if (label.widthMm && label.heightMm) {
    const size = { widthMm: label.widthMm, heightMm: label.heightMm };
    return { size, key: label.barcode ?? `${size.widthMm}x${size.heightMm}`, needsSize: false };
  }
  if (!label.barcode) return { size: null, key: null, needsSize: false };
  const entry = known[label.barcode];
  const size = saved[label.barcode] ?? (entry ? sizeOnly(entry) : null);
  return { size, key: label.barcode, needsSize: !size, ...(entry?.name ? { name: entry.name } : {}) };
}

/** How a design differs from the loaded roll. Fold mode is a design choice, so it never counts. */
export interface RollMismatch {
  size: boolean;
  paper: boolean;
}

export function rollMismatch(doc: LabelSize & { paper?: PaperType }, rollSize: LabelSize | null, rollPaper: PaperType | undefined): RollMismatch | null {
  const size = !!rollSize && (rollSize.widthMm !== doc.widthMm || rollSize.heightMm !== doc.heightMm || (rollSize.tailMm ?? 0) !== (doc.tailMm ?? 0));
  const paper = !!rollPaper && !!doc.paper && doc.paper !== rollPaper;
  return size || paper ? { size, paper } : null;
}

export function sameSize(a: LabelSize, b: LabelSize): boolean {
  return a.widthMm === b.widthMm && a.heightMm === b.heightMm && (a.tailMm ?? 0) === (b.tailMm ?? 0) && (a.fold ?? null) === (b.fold ?? null);
}

/**
 * Roll sizes worth offering for a printer: the ones whose edge across the
 * printhead suits its width. Labels run a little wider than the printable
 * area, so the limit allows some slack.
 */
export function sizesForPrinter(profile: PrinterProfile | null): LabelSize[] {
  const all = [...LABEL_PRESETS, ...TEMPLATE_SIZES, ...KNOWN_ROLL_SIZES].filter((s, i, list) => list.findIndex((o) => sameSize(o, s)) === i);
  const sorted = all.sort((a, b) => a.heightMm - b.heightMm || a.widthMm - b.widthMm);
  if (!profile) return sorted;
  if (profile.kind === 'thermal') return THERMAL_SIZES;
  const head = printheadMm(profile);
  const across = (s: LabelSize) => (profile.printDirection === 'left' ? s.heightMm : s.widthMm);
  return sorted.filter((s) => across(s) <= head * 1.3 && across(s) >= head * 0.5);
}

/** Every known size, the ones that suit the printer first. */
export function allSizesFor(profile: PrinterProfile | null): LabelSize[] {
  const fit = sizesForPrinter(profile);
  const rest = sizesForPrinter(null).filter((s) => !fit.some((f) => sameSize(f, s)));
  return [...fit, ...rest];
}
