import type { DitherMode } from '../doc/model';

/** RGBA → luminance 0–255, compositing transparent pixels onto white. */
export function toGray(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const lum = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    out[i] = lum * a + 255 * (1 - a);
  }
  return out;
}

type Kernel = [dx: number, dy: number, weight: number][];

const FLOYD: Kernel = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
];

const ATKINSON: Kernel = [
  [1, 0, 1 / 8],
  [2, 0, 1 / 8],
  [-1, 1, 1 / 8],
  [0, 1, 1 / 8],
  [1, 1, 1 / 8],
  [0, 2, 1 / 8],
];

/**
 * Reduces a grayscale image to 1 bit. Returns 1 for black (ink), 0 for white.
 * `threshold` shifts the black/white cut-off; higher prints darker.
 */
export function dither(gray: Float32Array, width: number, height: number, mode: DitherMode, threshold = 128): Uint8Array {
  const px = Float32Array.from(gray);
  const out = new Uint8Array(width * height);
  const kernel = mode === 'floyd' ? FLOYD : mode === 'atkinson' ? ATKINSON : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const black = px[i] < threshold;
      out[i] = black ? 1 : 0;
      if (!kernel) continue;
      const err = px[i] - (black ? 0 : 255);
      for (const [dx, dy, wgt] of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny < height) px[ny * width + nx] += err * wgt;
      }
    }
  }
  return out;
}

/** Writes a 1-bit mask back into RGBA as opaque black and white. */
export function bitsToRgba(bits: Uint8Array, rgba: Uint8ClampedArray, invert = false): void {
  for (let i = 0; i < bits.length; i++) {
    const v = (bits[i] === 1) !== invert ? 0 : 255;
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
}
