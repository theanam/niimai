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

/**
 * Paper fed after each print on a sticker roll: the rest of the sticker,
 * when the label is shorter than it, then the gap. Each print then starts
 * on the next sticker whatever the label's length.
 */
export const stickerFeed = (gap: number, stickerLength: number, printedLength: number): number =>
  Math.round((gap + Math.max(0, stickerLength - printedLength)) * 100) / 100;

/**
 * How far past a sticker's top the head may sit and still count as lined
 * up. Moving forward to the next top would push out a whole blank sticker
 * to correct less than a ruler reading.
 */
export const LINED_UP_MM = 1.5;
