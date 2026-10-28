import type { LabelSize } from '../doc/model';
import type { PrinterStatus } from './service';

export interface RollState {
  /** Null while the size is unknown. */
  size: LabelSize | null;
  /** Identifies the roll, so the size is applied once per roll. */
  key: string | null;
  /** A roll is loaded but its size has to come from the user. */
  needsSize: boolean;
}

/** Works out the loaded roll's size from what the printer reports plus sizes the user saved. */
export function resolveRoll(label: PrinterStatus['label'], saved: Record<string, LabelSize>): RollState {
  if (!label) return { size: null, key: null, needsSize: false };
  if (label.widthMm && label.heightMm) {
    const size = { widthMm: label.widthMm, heightMm: label.heightMm };
    return { size, key: label.barcode ?? `${size.widthMm}x${size.heightMm}`, needsSize: false };
  }
  if (!label.barcode) return { size: null, key: null, needsSize: false };
  const size = saved[label.barcode] ?? null;
  return { size, key: label.barcode, needsSize: !size };
}

export const sameSize = (a: LabelSize, b: LabelSize): boolean => a.widthMm === b.widthMm && a.heightMm === b.heightMm;
