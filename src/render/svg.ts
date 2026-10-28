import { flagWidth, isMirrored, type LabelDoc, type LabelElement, type TextElement } from '../doc/model';
import { ptToMm } from '../lib/units';
import { barcodeSymbol, qrSymbol, type Symbol2D } from './barcode';
import { measureText, type MeasureFn } from './measure';

export interface SvgOptions {
  /** Extra CSS, used to embed @font-face rules for standalone output. */
  css?: string;
  /** Replacement image sources by element id (the dithered 1-bit versions). */
  images?: Record<string, string>;
  measure?: MeasureFn;
  /** Physical size attributes in mm. Off for on-screen use, where CSS sizes the SVG. */
  physicalSize?: boolean;
}

export const LINE_HEIGHT = 1.2;
const INK = '#000';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const n = (v: number): string => String(Math.round(v * 1000) / 1000);

/** Font size in mm that fits every line inside the box. */
export function fitFontSize(el: TextElement, measure: MeasureFn = measureText): number {
  if (!el.autoFit) return ptToMm(el.fontSize);
  const lines = el.text.split('\n');
  const widest = Math.max(0.01, ...lines.map((l) => measure(l || ' ', el.fontFamily, el.bold, el.italic)));
  return Math.max(0.5, Math.min(el.w / widest, el.h / (lines.length * LINE_HEIGHT)));
}

function textSvg(el: TextElement, measure: MeasureFn): string {
  const size = fitFontSize(el, measure);
  const lines = el.text.split('\n');
  const lineH = size * LINE_HEIGHT;
  const top = el.y + (el.h - lines.length * lineH) / 2;
  const anchor = el.align === 'left' ? 'start' : el.align === 'right' ? 'end' : 'middle';
  const x = el.align === 'left' ? el.x : el.align === 'right' ? el.x + el.w : el.x + el.w / 2;
  const tspans = lines
    .map((line, i) => `<tspan x="${n(x)}" y="${n(top + lineH * (i + 0.5))}">${esc(line) || ' '}</tspan>`)
    .join('');
  return (
    `<text font-family="${esc(`'${el.fontFamily}', sans-serif`)}" font-size="${n(size)}" ` +
    `font-weight="${el.bold ? 700 : 400}" font-style="${el.italic ? 'italic' : 'normal'}" ` +
    `text-anchor="${anchor}" dominant-baseline="central" fill="${INK}" xml:space="preserve">${tspans}</text>`
  );
}

function nested(sym: Symbol2D, el: LabelElement): string {
  return `<svg x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" viewBox="${sym.viewBox}" preserveAspectRatio="xMidYMid meet">${sym.body}</svg>`;
}

function placeholder(el: LabelElement): string {
  return `<rect x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" fill="none" stroke="${INK}" stroke-width="0.2" stroke-dasharray="0.8 0.8"/>`;
}

export function elementSvg(el: LabelElement, opts: SvgOptions = {}): string {
  const measure = opts.measure ?? measureText;
  let body: string;
  switch (el.type) {
    case 'text':
      body = textSvg(el, measure);
      break;
    case 'image': {
      const processed = opts.images?.[el.id];
      const src = processed ?? el.src;
      body = src
        ? `<image href="${esc(src)}" x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" ` +
          `preserveAspectRatio="${processed ? 'none' : 'xMidYMid meet'}"${processed ? ' style="image-rendering:pixelated"' : ''}/>`
        : placeholder(el);
      break;
    }
    case 'qr':
    case 'barcode':
      try {
        body = nested(el.type === 'qr' ? qrSymbol(el) : barcodeSymbol(el), el);
      } catch {
        body = placeholder(el);
      }
      break;
    case 'icon':
      // The body is sanitised path data (see sanitizeIconBody), never raw file contents.
      body = el.body
        ? `<svg x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" viewBox="0 0 256 256" preserveAspectRatio="xMidYMid meet" fill="${INK}">${el.body}</svg>`
        : placeholder(el);
      break;
    case 'rect': {
      const s = el.fill ? 0 : el.strokeWidth;
      body =
        `<rect x="${n(el.x + s / 2)}" y="${n(el.y + s / 2)}" width="${n(Math.max(0, el.w - s))}" height="${n(Math.max(0, el.h - s))}" ` +
        `rx="${n(el.radius)}" fill="${el.fill ? INK : 'none'}" stroke="${el.fill ? 'none' : INK}" stroke-width="${n(s)}"/>`;
      break;
    }
    case 'ellipse': {
      const s = el.fill ? 0 : el.strokeWidth;
      body =
        `<ellipse cx="${n(el.x + el.w / 2)}" cy="${n(el.y + el.h / 2)}" rx="${n(Math.max(0, (el.w - s) / 2))}" ry="${n(Math.max(0, (el.h - s) / 2))}" ` +
        `fill="${el.fill ? INK : 'none'}" stroke="${el.fill ? 'none' : INK}" stroke-width="${n(s)}"/>`;
      break;
    }
    case 'line':
      body = `<line x1="${n(el.x)}" y1="${n(el.y + el.h / 2)}" x2="${n(el.x + el.w)}" y2="${n(el.y + el.h / 2)}" stroke="${INK}" stroke-width="${n(el.strokeWidth)}"/>`;
      break;
  }
  if (!el.rotation) return body;
  return `<g transform="rotate(${n(el.rotation)} ${n(el.x + el.w / 2)} ${n(el.y + el.h / 2)})">${body}</g>`;
}

/**
 * Where a folded flag's repeat goes: shifted onto the second half, or turned
 * upside down around the fold. Null when nothing repeats.
 */
export function mirrorTransform(doc: Pick<LabelDoc, 'widthMm' | 'heightMm' | 'tailMm' | 'fold'>): string | null {
  if (!isMirrored(doc)) return null;
  const half = flagWidth(doc) / 2;
  return doc.fold === 'flip' ? `rotate(180 ${n(half)} ${n(doc.heightMm / 2)})` : `translate(${n(half)} 0)`;
}

/** The repeated half of a folded flag, or an empty string. */
export function mirroredSvg(doc: LabelDoc, opts: SvgOptions = {}): string {
  const transform = mirrorTransform(doc);
  if (!transform) return '';
  return `<g transform="${transform}">${doc.elements.map((el) => elementSvg(el, opts)).join('')}</g>`;
}

/** The whole label as a standalone SVG document, in millimetre units. */
export function renderSvg(doc: LabelDoc, opts: SvgOptions = {}): string {
  const { widthMm: w, heightMm: h } = doc;
  const size = opts.physicalSize === false ? '' : ` width="${n(w)}mm" height="${n(h)}mm"`;
  const style = opts.css ? `<style>${opts.css}</style>` : '';
  const body = doc.elements.map((el) => elementSvg(el, opts)).join('') + mirroredSvg(doc, opts);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${size} viewBox="0 0 ${n(w)} ${n(h)}">` +
    `${style}<rect width="${n(w)}" height="${n(h)}" fill="#fff"/>${body}</svg>`
  );
}
