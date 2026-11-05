/**
 * Paper on printers that cannot sense it (ESC/POS, cat), set once per
 * printer: sticker rolls, where each print feeds exactly the gap after every
 * sticker, and paper narrower than the print width. No entry for a printer
 * means continuous paper as wide as its head.
 */
export type StickerGaps = Record<string, number>;
export type PaperWidths = Record<string, number>;
/** The length new labels start at on each printer: the sticker height, or the usual length on continuous paper. */
export type LabelLengths = Record<string, number>;

/** The gap offered when stickers are first chosen; most 58 mm sticker rolls are close to it. */
export const DEFAULT_GAP_MM = 2;
export const MAX_GAP_MM = 20;
export const MIN_PAPER_MM = 10;
export const MAX_PAPER_MM = 112;
export const MIN_LENGTH_MM = 5;
export const MAX_LENGTH_MM = 500;

/** Stickers the line-up test prints in a row. */
export const STICKER_TEST_COUNT = 3;

/**
 * The gap that stops prints creeping across a sticker roll. Each print feeds
 * one sticker and the set gap, so a gap set too wide moves every print a
 * little lower on its sticker than the one before. drift is how much lower
 * the last test print sits than the first (negative when higher).
 */
export function correctedGap(gap: number, drift: number, prints = STICKER_TEST_COUNT): number {
  const next = gap - drift / (prints - 1);
  return Math.min(MAX_GAP_MM, Math.max(0, Math.round(next * 10) / 10));
}
