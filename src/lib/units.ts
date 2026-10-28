export const MM_PER_INCH = 25.4;
export const MM_PER_PT = 25.4 / 72;

export const mmToPx = (mm: number, dpi: number): number => (mm / MM_PER_INCH) * dpi;
export const pxToMm = (px: number, dpi: number): number => (px / dpi) * MM_PER_INCH;
export const ptToMm = (pt: number): number => pt * MM_PER_PT;

/** Rounds to a tenth of a millimetre, the precision the editor works in. */
export const round1 = (v: number): number => Math.round(v * 10) / 10;

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
