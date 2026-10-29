import type { LabelElement, LabelSize } from '../doc/model';
import { round1 } from '../lib/units';
import { printheadMm, type PrinterProfile } from './profiles';

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The part of the label the printhead reaches, in mm, or null when it reaches
 * all of it. The head is centred across the label (see printheadCrop), so a
 * label wider than the head loses an equal strip on each side.
 */
export function safeArea(size: Pick<LabelSize, 'widthMm' | 'heightMm'>, profile: Pick<PrinterProfile, 'printheadPixels' | 'dpi' | 'printDirection'> | null): Area | null {
  if (!profile) return null;
  const head = printheadMm(profile as PrinterProfile);
  const acrossIsWidth = profile.printDirection === 'top';
  const across = acrossIsWidth ? size.widthMm : size.heightMm;
  if (across <= head + 0.05) return null;
  const off = (across - head) / 2;
  return acrossIsWidth ? { x: off, y: 0, w: head, h: size.heightMm } : { x: 0, y: off, w: size.widthMm, h: head };
}

/** Frames, and outlines that span most of the label, read as borders. */
export const isBorder = (el: LabelElement, size: Pick<LabelSize, 'widthMm' | 'heightMm'>): boolean =>
  el.type === 'frame' || (el.type === 'rect' && !el.fill && !el.rotation && el.w >= size.widthMm * 0.8 && el.h >= size.heightMm * 0.8);

/**
 * Moves borders that run past the safe area inside it. Returns the new box for
 * each border that needed one, keyed by element id.
 */
export function fitBorders(elements: LabelElement[], size: Pick<LabelSize, 'widthMm' | 'heightMm'>, safe: Area | null): Record<string, Pick<LabelElement, 'x' | 'y' | 'w' | 'h'>> {
  if (!safe) return {};
  const out: Record<string, Pick<LabelElement, 'x' | 'y' | 'w' | 'h'>> = {};
  // A hair inside the edge, so the outline's stroke lands on dots the head prints.
  const pad = 0.2;
  const sx = safe.x + (safe.x > 0 ? pad : 0);
  const sy = safe.y + (safe.y > 0 ? pad : 0);
  const ex = safe.x + safe.w - (safe.x > 0 ? pad : 0);
  const ey = safe.y + safe.h - (safe.y > 0 ? pad : 0);
  for (const el of elements) {
    if (!isBorder(el, size)) continue;
    const x = Math.max(el.x, sx);
    const y = Math.max(el.y, sy);
    const r = Math.min(el.x + el.w, ex);
    const b = Math.min(el.y + el.h, ey);
    if (x === el.x && y === el.y && r === el.x + el.w && b === el.y + el.h) continue;
    out[el.id] = { x: round1(x), y: round1(y), w: round1(r - x), h: round1(b - y) };
  }
  return out;
}
