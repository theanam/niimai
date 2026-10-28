import { code128, code39, drawingSVG, ean13, qrcode, upca, type RenderOptions } from 'bwip-js';
import type { BarcodeElement, QrElement } from '../doc/model';

export interface Symbol2D {
  viewBox: string;
  body: string;
}

const cache = new Map<string, Symbol2D | Error>();

// Named encoders let the bundler drop the hundred-odd symbologies the app never uses.
const ENCODERS = { qrcode, code128, code39, ean13, upca } as const;

/** bwip-js renders a standalone SVG; this keeps its viewBox and contents for nesting. */
function generate(key: string, opts: RenderOptions & { bcid: keyof typeof ENCODERS }): Symbol2D {
  const hit = cache.get(key);
  if (hit instanceof Error) throw hit;
  if (hit) return hit;
  try {
    const svg = ENCODERS[opts.bcid](opts, drawingSVG());
    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 1 1';
    const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const sym = { viewBox, body };
    cache.set(key, sym);
    return sym;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    // bwip-js prefixes messages with the encoder name, e.g. "bwipp.ean13badLength#4202: ..."
    error.message = error.message.replace(/^[^:]*:\s*/, '');
    cache.set(key, error);
    throw error;
  }
}

export function qrSymbol(el: Pick<QrElement, 'value'>): Symbol2D {
  return generate(`qr:${el.value}`, { bcid: 'qrcode', text: el.value || ' ', eclevel: 'M' } as RenderOptions & { bcid: 'qrcode' });
}

export function barcodeSymbol(el: Pick<BarcodeElement, 'value' | 'format' | 'showText'>): Symbol2D {
  return generate(`bc:${el.format}:${el.showText}:${el.value}`, {
    bcid: el.format,
    text: el.value,
    includetext: el.showText,
    textxalign: 'center',
    scale: 2,
    height: 10,
  });
}

/** Null when the value encodes, otherwise a short reason. */
export function symbolError(el: QrElement | BarcodeElement): string | null {
  try {
    if (el.type === 'qr') qrSymbol(el);
    else barcodeSymbol(el);
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}
