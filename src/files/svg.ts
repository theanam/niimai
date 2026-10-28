/** True for SVG files, including ones the system reports without a type. */
export const isSvgFile = (f: Blob): boolean => f.type === 'image/svg+xml' || /\.svg$/i.test((f as File).name ?? '');

/** True for anything the image tool can place. */
export const isImageFile = (f: Blob): boolean => f.type.startsWith('image/') || isSvgFile(f);

/** True when pasted text is SVG markup. */
export const looksLikeSvg = (text: string): boolean => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text);

const length = (v: string | null): number | null => {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 && !/%$/.test(v!.trim()) ? n : null;
};

/**
 * The drawing's proportions from its width and height, or its viewBox when
 * those are missing. Units do not matter here, only the ratio.
 */
export function svgSize(markup: string): { w: number; h: number } | null {
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg') return null;
  const w = length(svg.getAttribute('width'));
  const h = length(svg.getAttribute('height'));
  if (w && h) return { w, h };
  const box = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  if (box.length === 4 && box[2] > 0 && box[3] > 0) return { w: box[2], h: box[3] };
  return null;
}

/** The file typed as SVG so browsers render it from a data URL. */
export const asSvgBlob = (f: Blob): Blob => (f.type === 'image/svg+xml' ? f : new Blob([f], { type: 'image/svg+xml' }));
