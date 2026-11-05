/**
 * Printers that cannot sense the paper centre whatever they are sent on the
 * head. The print position's offset moves a drawing inside its own canvas,
 * which would cut off a narrow label's edge, so for these printers the label
 * is drawn on a canvas as wide as the head instead, moved `dx` dots right of
 * the middle: the whole label moves along the head.
 */
export function placeOnHead(canvas: HTMLCanvasElement, headDots: number, dx: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.max(headDots, canvas.width);
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, Math.round((out.width - canvas.width) / 2 + dx), 0);
  return out;
}
