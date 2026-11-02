import { createElement } from '../doc/model';
import { fitBorders, isBorder, safeArea, turnedArea } from './safeArea';

const d11 = { printheadPixels: 96, dpi: 203, printDirection: 'left' as const };
const b21 = { printheadPixels: 384, dpi: 203, printDirection: 'top' as const };

describe('safe area', () => {
  it('is the whole label when the head covers it', () => {
    expect(safeArea({ widthMm: 40, heightMm: 12 }, d11)).toBeNull();
    expect(safeArea({ widthMm: 40, heightMm: 30 }, b21)).toBeNull();
    expect(safeArea({ widthMm: 40, heightMm: 30 }, null)).toBeNull();
  });

  it('loses an equal strip on each side across the head', () => {
    const a = safeArea({ widthMm: 30, heightMm: 15 }, d11)!;
    expect(a.x).toBe(0);
    expect(a.w).toBe(30);
    expect(a.y).toBeCloseTo(1.5, 1);
    expect(a.h).toBeCloseTo(12, 1);
    const b = safeArea({ widthMm: 50, heightMm: 30 }, b21)!;
    expect(b).toMatchObject({ y: 0, h: 30 });
    expect(b.x).toBeCloseTo(1, 1);
    expect(b.w).toBeCloseTo(48, 1);
  });

  it('treats frames and large outlines as borders', () => {
    const size = { widthMm: 30, heightMm: 15 };
    expect(isBorder(createElement('frame', size), size)).toBe(true);
    expect(isBorder({ ...createElement('rect', size), x: 0.5, y: 0.5, w: 29, h: 14 }, size)).toBe(true);
    expect(isBorder({ ...createElement('rect', size), w: 5, h: 5 }, size)).toBe(false);
    expect(isBorder({ ...createElement('rect', size), x: 0, y: 0, w: 30, h: 15, fill: true } as never, size)).toBe(false);
  });

  it('moves borders inside the safe area and leaves the rest alone', () => {
    const size = { widthMm: 30, heightMm: 15 };
    const frame = { ...createElement('frame', size), id: 'f', x: 0.5, y: 0.5, w: 29, h: 14 };
    const text = { ...createElement('text', size), id: 't', x: 0, y: 0, w: 30, h: 15 };
    const boxes = fitBorders([frame, text], size, safeArea(size, d11));
    expect(Object.keys(boxes)).toEqual(['f']);
    expect(boxes.f.x).toBe(0.5);
    expect(boxes.f.y).toBeGreaterThanOrEqual(1.5);
    expect(boxes.f.y + boxes.f.h).toBeLessThanOrEqual(13.5);
  });

  it('leaves borders already inside', () => {
    const size = { widthMm: 30, heightMm: 15 };
    const frame = { ...createElement('frame', size), id: 'f', x: 0.5, y: 2, w: 29, h: 11 };
    expect(fitBorders([frame], size, safeArea(size, d11))).toEqual({});
  });

  it('turns the printable area of the paper onto a landscape artboard', () => {
    // 50 × 30 mm paper, 1 mm lost at each side; the 30 × 50 artboard loses it at the top and bottom.
    expect(turnedArea({ x: 1, y: 0, w: 48, h: 30 }, 50)).toEqual({ x: 0, y: 1, w: 30, h: 48 });
    expect(turnedArea({ x: 0, y: 2, w: 40, h: 10 }, 40)).toEqual({ x: 2, y: 0, w: 10, h: 40 });
    expect(turnedArea(null, 50)).toBeNull();
  });
});
