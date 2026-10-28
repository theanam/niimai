import { bitsToRgba, dither, toGray } from './dither';

describe('dithering', () => {
  it('composites transparency onto white', () => {
    const g = toGray(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]));
    expect(g[0]).toBe(255);
    expect(g[1]).toBe(0);
  });

  it('thresholds', () => {
    const gray = Float32Array.from([10, 200, 127, 128]);
    expect([...dither(gray, 4, 1, 'threshold', 128)]).toEqual([1, 0, 1, 0]);
  });

  it('error diffusion approximates mid grey with about half the dots', () => {
    const gray = new Float32Array(32 * 32).fill(128);
    for (const mode of ['floyd', 'atkinson'] as const) {
      const bits = dither(gray, 32, 32, mode);
      const ink = bits.reduce((a, b) => a + b, 0) / bits.length;
      expect(ink).toBeGreaterThan(mode === 'floyd' ? 0.4 : 0.3);
      expect(ink).toBeLessThan(0.6);
    }
  });

  it('leaves white white and black black', () => {
    expect([...dither(new Float32Array(4).fill(255), 2, 2, 'floyd')]).toEqual([0, 0, 0, 0]);
    expect([...dither(new Float32Array(4).fill(0), 2, 2, 'atkinson')]).toEqual([1, 1, 1, 1]);
  });

  it('writes bits back as opaque pixels, optionally inverted', () => {
    const rgba = new Uint8ClampedArray(8);
    bitsToRgba(Uint8Array.from([1, 0]), rgba);
    expect([...rgba]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
    bitsToRgba(Uint8Array.from([1, 0]), rgba, true);
    expect(rgba[0]).toBe(255);
  });
});
