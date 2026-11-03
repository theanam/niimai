import { ptToMm } from '../lib/units';
import { barcodeSymbol } from '../render/barcode';
import { iconInk } from '../render/iconInk';
import { imageAspect } from '../render/imageAspect';
import { measureText, type MeasureFn } from '../render/measure';
import { fitFontSize, ICON_BOX, LINE_HEIGHT } from '../render/svg';
import type { IconElement, LabelElement, TextElement } from './model';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Elements drawn at their content's own proportions: text, pictures and
 * codes. Their box always hugs what they draw, and resizing keeps their
 * proportions.
 */
export const HUGS: ReadonlySet<LabelElement['type']> = new Set(['text', 'image', 'qr', 'icon', 'barcode']);

/** Exact enough to keep drawn sizes steady, short enough to keep files tidy. */
const tidy = (v: number) => Math.round(v * 1000) / 1000;

/** Width over height of what an element draws, or null when it fills its box. */
function aspect(el: LabelElement): number | null {
  switch (el.type) {
    case 'qr':
      return 1;
    case 'image':
      return imageAspect(el.src);
    case 'barcode':
      try {
        const [, , w, h] = barcodeSymbol(el).viewBox.split(/[\s,]+/).map(Number);
        return w > 0 && h > 0 ? w / h : null;
      } catch {
        return null;
      }
    default:
      return null;
  }
}

/** The lines of a text element at the size it draws, where it draws them. */
function textBox(el: TextElement, measure: MeasureFn): Box {
  const size = fitFontSize(el, measure);
  const lines = el.text.split('\n');
  const w = Math.max(...lines.map((l) => measure(l || ' ', el.fontFamily, el.bold, el.italic))) * size;
  const h = lines.length * size * LINE_HEIGHT;
  const x = el.align === 'left' ? el.x : el.align === 'right' ? el.x + el.w - w : el.x + (el.w - w) / 2;
  return { x, y: el.y + (el.h - h) / 2, w, h };
}

const numbers = (viewBox: string) => viewBox.split(/[\s,]+/).map(Number) as [number, number, number, number];

/** An icon's artwork where it draws: the shown part of its 256 box fitted into the element, then the artwork inside that. */
function iconBox(el: IconElement): Box {
  const [vx, vy, vw, vh] = numbers(el.viewBox ?? ICON_BOX);
  const k = Math.min(el.w / vw, el.h / vh);
  const [fx, fy] = [el.x + (el.w - vw * k) / 2, el.y + (el.h - vh * k) / 2];
  const [ix, iy, iw, ih] = iconInk(el.body) ?? [vx, vy, vw, vh];
  // Only the part of the artwork the element shows.
  const x0 = Math.max(ix, vx);
  const y0 = Math.max(iy, vy);
  const x1 = Math.min(ix + iw, vx + vw);
  const y1 = Math.min(iy + ih, vy + vh);
  if (x1 <= x0 || y1 <= y0) return { x: fx, y: fy, w: vw * k, h: vh * k };
  return { x: fx + (x0 - vx) * k, y: fy + (y0 - vy) * k, w: (x1 - x0) * k, h: (y1 - y0) * k };
}

/** The viewBox that shows exactly the artwork an icon draws, so a box shrunk to it draws the same. */
function iconViewBox(el: IconElement): string | undefined {
  const ink = iconInk(el.body);
  if (!ink) return el.viewBox;
  const [vx, vy, vw, vh] = numbers(el.viewBox ?? ICON_BOX);
  const x0 = Math.max(ink[0], vx);
  const y0 = Math.max(ink[1], vy);
  const x1 = Math.min(ink[0] + ink[2], vx + vw);
  const y1 = Math.min(ink[1] + ink[3], vy + vh);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0].map((v) => Math.round(v * 100) / 100).join(' ') : el.viewBox;
}

/**
 * What an element visibly takes up, before rotation: the box that hugs its
 * text or picture. Selection, sizes, snapping and alignment all use it.
 */
export function visualBox(el: LabelElement, measure: MeasureFn = measureText): Box {
  if (el.type === 'text') return textBox(el, measure);
  if (el.type === 'icon') return el.body ? iconBox(el) : { x: el.x, y: el.y, w: el.w, h: el.h };
  const a = aspect(el);
  if (!a) return { x: el.x, y: el.y, w: el.w, h: el.h };
  const w = Math.min(el.w, el.h * a);
  const h = w / a;
  return { x: el.x + (el.w - w) / 2, y: el.y + (el.h - h) / 2, w, h };
}

/**
 * Where the centre of the visible box lands on the label. Rotation turns
 * around the element's own box, which a hugging box can sit off-centre in.
 */
function visualCentre(el: LabelElement, b: Box): [number, number] {
  const [ox, oy] = [el.x + el.w / 2, el.y + el.h / 2];
  const [bx, by] = [b.x + b.w / 2 - ox, b.y + b.h / 2 - oy];
  if (!el.rotation) return [ox + bx, oy + by];
  const r = (el.rotation * Math.PI) / 180;
  return [ox + bx * Math.cos(r) - by * Math.sin(r), oy + bx * Math.sin(r) + by * Math.cos(r)];
}

/** The element with its box shrunk to what it draws, so it looks exactly the same. */
export function tighten<E extends LabelElement>(el: E, measure: MeasureFn = measureText): E {
  if (!HUGS.has(el.type)) return el;
  const b = visualBox(el, measure);
  const [cx, cy] = visualCentre(el, b);
  const shown = el.type === 'icon' && el.body ? { viewBox: iconViewBox(el) } : {};
  return { ...el, ...shown, x: tidy(cx - b.w / 2), y: tidy(cy - b.h / 2), w: tidy(b.w), h: tidy(b.h) };
}

/** The axis-aligned box an element covers on the label, rotation included. */
export function coverBox(el: LabelElement, measure: MeasureFn = measureText): Box {
  const b = visualBox(el, measure);
  if (!el.rotation) return b;
  const r = (el.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const [cx, cy] = visualCentre(el, b);
  const w = b.w * cos + b.h * sin;
  const h = b.w * sin + b.h * cos;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** The box around several boxes. */
export function unionBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * The patch that puts a hugging element into a new visible box of the same
 * proportions. Text with a set size scales its size with the box.
 */
export function placePatch(el: LabelElement, box: Box, measure: MeasureFn = measureText): Partial<LabelElement> {
  const tight = tighten(el, measure);
  const patch: Partial<LabelElement> = { x: tidy(box.x), y: tidy(box.y), w: tidy(box.w), h: tidy(box.h) };
  // A box placed around an icon's artwork shows only the artwork.
  if (tight.type === 'icon' && tight.viewBox) (patch as Partial<IconElement>).viewBox = tight.viewBox;
  if (el.type === 'text' && !el.autoFit && tight.w > 0) {
    (patch as Partial<TextElement>).fontSize = Math.round(el.fontSize * (box.w / tight.w) * 100) / 100;
  }
  return patch;
}

/** The size a text element draws at, in points, for showing in the inspector. */
export const shownFontSize = (el: TextElement, measure: MeasureFn = measureText): number =>
  el.autoFit ? Math.round((fitFontSize(el, measure) / ptToMm(1)) * 10) / 10 : el.fontSize;
