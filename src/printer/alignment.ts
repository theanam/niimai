import { createDoc, createElement, type LabelDoc, type LabelElement, type LabelSize } from '../doc/model';

/** Ticks per ruler, one per millimetre from the label's edge. */
export const RULER_MM = 8;

/**
 * A test label for finding the print offset along the label: an outline at
 * the edges, a centre line, and a millimetre ruler at each end numbered from
 * that end. When a print is shifted, one ruler loses its first numbers; the
 * first number still visible is how far to move the print the other way.
 */
export function alignmentDoc(size: LabelSize): LabelDoc {
  const doc = createDoc({ widthMm: size.widthMm, heightMm: size.heightMm, ...(size.tailMm ? { tailMm: size.tailMm } : {}) }, 'Alignment test');
  const { widthMm: w, heightMm: h } = size;
  const flag = w - (size.tailMm ?? 0);
  const els: LabelElement[] = [];
  const line = (x: number, y: number, len: number, vertical: boolean, stroke = 0.25) =>
    els.push({
      ...createElement('line', size),
      ...(vertical ? { x: x - 0.5, y, w: 1, h: len, direction: 'vertical' } : { x, y: y - 0.5, w: len, h: 1, direction: 'horizontal' }),
      strokeWidth: stroke,
    } as LabelElement);
  const text = (x: number, y: number, value: string, size = 2.2) =>
    els.push({ ...createElement('text', { widthMm: w, heightMm: h }), x: x - 2, y, w: 4, h: size, text: value, autoFit: true, bold: true } as LabelElement);

  // Outline drawn just inside the edges, so a shifted print cuts one side off.
  els.push({ ...createElement('frame', size), x: 0, y: 0, w: flag, h, strokeWidth: 0.3 } as LabelElement);
  // Centre line across the label.
  line(flag / 2, 0, h, true, 0.35);

  const rulerSpan = Math.min(RULER_MM, Math.floor(flag / 2 - 3));
  const tick = Math.min(3, h * 0.25);
  const top = h / 2 - tick;
  for (let mm = 1; mm <= rulerSpan; mm++) {
    const long = mm % 2 === 0;
    for (const x of [mm, flag - mm]) {
      line(x, long ? top - tick * 0.4 : top, long ? tick * 1.4 : tick, true);
      if (long) text(x, h / 2 + 0.4, String(mm));
    }
  }
  return { ...doc, elements: els };
}
