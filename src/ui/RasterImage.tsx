import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

/** How strongly ink is kept when shrinking: a line covering a third of a pixel still draws it nearly black. */
const INK_GAIN = 3;

/**
 * Shrinks a 1-bit page (RGBA) by averaging the ink under each output pixel,
 * then darkening it, so details one dot wide stay visible at small sizes.
 * Returns grey levels, 0 black to 255 white, one per output pixel.
 */
export function shrinkInk(data: ArrayLike<number>, sw: number, sh: number, tw: number, th: number): Uint8ClampedArray {
  const ink = new Float32Array(tw * th);
  const count = new Float32Array(tw * th);
  for (let y = 0; y < sh; y++) {
    const ty = Math.min(th - 1, Math.floor((y * th) / sh));
    for (let x = 0; x < sw; x++) {
      const t = ty * tw + Math.min(tw - 1, Math.floor((x * tw) / sw));
      count[t]++;
      if (data[(y * sw + x) * 4] < 128) ink[t]++;
    }
  }
  const out = new Uint8ClampedArray(tw * th);
  for (let i = 0; i < out.length; i++) out[i] = 255 * (1 - Math.min(1, (INK_GAIN * ink[i]) / Math.max(1, count[i])));
  return out;
}

type Mode = 'plain' | 'crisp' | 'shrunk';

/**
 * A printer-resolution preview. At or above its own size it keeps hard pixel
 * edges. Smaller, the browser's scaling would drop lines one dot wide, so a
 * canvas drawn with shrinkInk covers it; the image stays underneath for layout.
 */
export function RasterImage({ className = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('plain');
  /** What the canvas holds, so it is only redrawn when the image or its size changes. */
  const drawn = useRef('');

  const update = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img?.naturalWidth || !canvas) return;
    const rect = img.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const tw = Math.round(rect.width * dpr);
    const th = Math.round(rect.height * dpr);
    if (tw >= img.naturalWidth - 0.5) return setMode('crisp');
    const ctx = canvas.getContext('2d');
    if (!ctx || tw < 1 || th < 1) return setMode('plain');
    const key = `${img.currentSrc || img.src}:${tw}x${th}`;
    if (drawn.current !== key) {
      const sw = img.naturalWidth;
      const sh = img.naturalHeight;
      const src = document.createElement('canvas');
      src.width = sw;
      src.height = sh;
      const sctx = src.getContext('2d');
      if (!sctx) return setMode('plain');
      sctx.drawImage(img, 0, 0);
      const grey = shrinkInk(sctx.getImageData(0, 0, sw, sh).data, sw, sh, tw, th);
      canvas.width = tw;
      canvas.height = th;
      const out = ctx.createImageData(tw, th);
      grey.forEach((v, i) => out.data.set([v, v, v, 255], i * 4));
      ctx.putImageData(out, 0, 0);
      drawn.current = key;
    }
    setMode('shrunk');
  };

  // The displayed size changes with zoom and layout, so look again after every render and resize.
  useLayoutEffect(update);
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span className={`raster ${className}`.trim()} data-mode={mode}>
      <img ref={imgRef} className={mode === 'crisp' ? 'crisp' : undefined} onLoad={update} {...props} />
      <canvas ref={canvasRef} aria-hidden="true" hidden={mode !== 'shrunk'} />
    </span>
  );
}
