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
