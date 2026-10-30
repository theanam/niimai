import type { ImageElement, LabelDoc } from '../doc/model';
import { usedFonts } from '../doc/model';
import { mmToPx } from '../lib/units';
import { bitsToRgba, dither, toGray } from './dither';
import { embedFonts, ensureFont } from './fonts';
import { renderSvg } from './svg';

export const labelPixels = (doc: Pick<LabelDoc, 'widthMm' | 'heightMm'>, dpi: number) => ({
  width: Math.max(1, Math.round(mmToPx(doc.widthMm, dpi))),
  height: Math.max(1, Math.round(mmToPx(doc.heightMm, dpi))),
});

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable');
  return [c, ctx];
}

/** The image element reduced to 1 bit at printer resolution, as a PNG data URL. */
export async function processImage(el: ImageElement, dpi: number): Promise<string> {
  const img = await loadImage(el.src);
  const { width, height } = labelPixels({ widthMm: el.w, heightMm: el.h }, dpi);
  const [c, ctx] = canvas(width, height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  // SVGs without a width and height have no natural size; fill the box, which was sized to their proportions.
  const sized = img.naturalWidth > 0 && img.naturalHeight > 0;
  const scale = sized ? Math.min(width / img.naturalWidth, height / img.naturalHeight) : 1;
  const dw = sized ? img.naturalWidth * scale : width;
  const dh = sized ? img.naturalHeight * scale : height;
  ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
  const data = ctx.getImageData(0, 0, width, height);
  bitsToRgba(dither(toGray(data.data), width, height, el.dither, el.threshold), data.data, el.invert);
  ctx.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
}

/** Processed sources for every image element, keyed by element id. */
export async function processImages(doc: LabelDoc, dpi: number): Promise<Record<string, string>> {
  const entries = await Promise.all(
    doc.elements
      .filter((e): e is ImageElement => e.type === 'image' && !!e.src)
      .map(async (e) => [e.id, await processImage(e, dpi)] as const),
  );
  return Object.fromEntries(entries);
}

/** A standalone SVG with fonts and processed images inlined. */
export async function standaloneSvg(doc: LabelDoc, dpi: number, images?: Record<string, string>): Promise<string> {
  const fonts = usedFonts(doc);
  await Promise.all(fonts.map(ensureFont));
  const [css, imgs] = await Promise.all([embedFonts(fonts), images ? images : processImages(doc, dpi)]);
  return renderSvg(doc, { css, images: imgs });
}

/** Standalone SVGs for a batch of labels. Fonts are embedded once, in the first; on one page their rules apply to all. */
export async function standaloneSvgs(docs: LabelDoc[], images: Record<string, string> = {}): Promise<string[]> {
  const fonts = [...new Set(docs.flatMap(usedFonts))];
  await Promise.all(fonts.map(ensureFont));
  const css = await embedFonts(fonts);
  return docs.map((d, i) => renderSvg(d, { css: i === 0 ? css : undefined, images }));
}

/** The label as a pure black-and-white canvas at printer resolution. */
export async function rasterize(doc: LabelDoc, dpi: number, images?: Record<string, string>): Promise<HTMLCanvasElement> {
  const svg = await standaloneSvg(doc, dpi, images);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const { width, height } = labelPixels(doc, dpi);
  const [c, ctx] = canvas(width, height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  bitsToRgba(dither(toGray(data.data), width, height, 'threshold', 128), data.data);
  ctx.putImageData(data, 0, 0);
  return c;
}
