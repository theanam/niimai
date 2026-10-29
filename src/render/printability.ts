import type { LabelDoc, LabelElement } from '../doc/model';
import { MM_PER_INCH } from '../lib/units';
import { barcodeSymbol, qrSymbol, type Symbol2D } from './barcode';
import { measureText, type MeasureFn } from './measure';
import { fitFontSize } from './svg';

/** Width of one printer dot in mm. */
export const dotMm = (dpi: number): number => MM_PER_INCH / dpi;

/** Letter stems as a share of the font size, regular and bold. Typical for the sans faces labels use. */
const STEM = { regular: 0.085, bold: 0.14 };
/** Phosphor draws its regular lines 16 units wide in a 256 grid, bold 24; Fill's cut-outs run about 16. */
const ICON_STROKE = { regular: 16, bold: 24, fill: 16 } as const;
/** Bars and squares under this many dots tend not to scan once the paper spreads the ink. */
const MIN_CODE_DOTS = 2;

const round2 = (v: number) => Math.ceil(v * 100) / 100;

/** Rendered size of one viewBox unit when a symbol is fitted into the element's box. */
function unitMm(sym: Symbol2D, el: LabelElement): number {
  const [, , w, h] = sym.viewBox.split(/\s+/).map(Number);
  return w > 0 && h > 0 ? Math.min(el.w / w, el.h / h) : 0;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Thinnest bar of a linear barcode, in viewBox units: bars are strokes a whole number of modules wide. */
function thinnestBar(sym: Symbol2D): number {
  const widths = [...sym.body.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1])).filter((v) => v > 0);
  return widths.length ? Math.min(...widths) : 0;
}

/** One QR module, in viewBox units: every corner of the drawing sits on the module grid. */
function qrModule(sym: Symbol2D): number {
  const d = /d="([^"]+)"/.exec(sym.body)?.[1] ?? '';
  const nums = (d.match(/\d+(\.\d+)?/g) ?? []).map(Number).filter((v) => v > 0 && Number.isInteger(v));
  return nums.reduce((a, b) => gcd(a, b), 0);
}

/**
 * Why an element would print badly at this resolution: details thinner than
 * the printer's dots vanish or blur. Null when it prints as it looks.
 */
export function printIssue(el: LabelElement, dpi: number, measure: MeasureFn = measureText): string | null {
  const dot = dotMm(dpi);
  const min = `${round2(dot)} mm`;
  switch (el.type) {
    case 'line':
    case 'frame':
      return el.strokeWidth < dot ? `Thinner than one printer dot. Use ${min} or more.` : null;
    case 'rect':
    case 'ellipse':
      return !el.fill && el.strokeWidth < dot ? `Outline is thinner than one printer dot. Use ${min} or more.` : null;
    case 'text': {
      if (!el.text.trim()) return null;
      const stem = fitFontSize(el, measure) * (el.bold ? STEM.bold : STEM.regular);
      return stem < dot ? (el.bold ? 'Letters are too thin to print. Make the text larger.' : 'Letters are too thin to print. Make the text larger or bold.') : null;
    }
    case 'icon': {
      if (!el.body) return null;
      const stroke = Math.min(el.w, el.h) * (ICON_STROKE[el.weight] / 256);
      return stroke < dot ? (el.weight === 'bold' ? 'Lines are too thin to print. Make the icon larger.' : 'Lines are too thin to print. Make the icon larger or use Bold.') : null;
    }
    case 'barcode':
    case 'qr':
      try {
        const sym = el.type === 'qr' ? qrSymbol(el) : barcodeSymbol(el);
        const unit = el.type === 'qr' ? qrModule(sym) : thinnestBar(sym);
        const mm = unit * unitMm(sym, el);
        if (!mm || mm >= dot * MIN_CODE_DOTS) return null;
        return el.type === 'qr' ? 'Squares are too small to scan reliably. Make the code larger.' : 'Bars are too thin to scan reliably. Make the barcode wider.';
      } catch {
        // A value that does not encode already shows its own error.
        return null;
      }
    case 'image':
      return null;
  }
}

/** Print issues for every element that has one, keyed by element id. */
export function printIssues(doc: LabelDoc, dpi: number, measure?: MeasureFn): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of doc.elements) {
    const issue = printIssue(el, dpi, measure);
    if (issue) out[el.id] = issue;
  }
  return out;
}
