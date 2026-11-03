import { coverBox, placePatch, shownFontSize, tighten, visualBox } from './bounds';
import { hugEdit } from './history';
import { createDoc, createElement, type ImageElement, type TextElement } from './model';
import { setImageAspect } from '../render/imageAspect';
import { fitFontSize } from '../render/svg';

const doc = createDoc({ widthMm: 40, heightMm: 12 });
/** jsdom has no canvas, so text measures 0.55 em per character. */
const text = (extra: Partial<TextElement> = {}) => ({ ...(createElement('text', doc) as TextElement), x: 0, y: 0, w: 30, h: 10, ...extra });

describe('boxes that hug what they draw', () => {
  it('hugs fitted text: the lines at the size they draw, in place', () => {
    // "Label" is 2.75 em wide; 10 mm tall fits 8.33 mm text, 30 mm wide fits 10.9 mm, so height wins.
    const b = visualBox(text());
    expect(b.h).toBeCloseTo(10);
    expect(b.w).toBeCloseTo(2.75 * (10 / 1.2));
    expect(b.x).toBeCloseTo((30 - b.w) / 2);
    expect(visualBox(text({ align: 'left' })).x).toBe(0);
    expect(visualBox(text({ align: 'right' })).x).toBeCloseTo(30 - b.w);
  });

  it('tightens without changing how the text draws', () => {
    const el = text();
    const tight = tighten(el);
    expect(fitFontSize(tight)).toBeCloseTo(fitFontSize(el));
    const b = visualBox(tight);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(b[k]).toBeCloseTo(tight[k], 2);
  });

  it('hugs pictures and codes at their own proportions', () => {
    const qr = { ...createElement('qr', doc), x: 0, y: 0, w: 20, h: 10 };
    expect(visualBox(qr)).toEqual({ x: 5, y: 0, w: 10, h: 10 });
    const img = { ...(createElement('image', doc) as ImageElement), src: 'data:wide', x: 0, y: 0, w: 10, h: 10 };
    expect(visualBox(img)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    setImageAspect('data:wide', 2);
    expect(visualBox(img)).toEqual({ x: 0, y: 2.5, w: 10, h: 5 });
    const rect = { ...createElement('rect', doc), x: 1, y: 2, w: 20, h: 5 };
    expect(visualBox(rect)).toEqual({ x: 1, y: 2, w: 20, h: 5 });
  });

  it('keeps a rotated element where it shows when tightening', () => {
    const qr = { ...createElement('qr', doc), x: 0, y: 0, w: 20, h: 10, rotation: 90 };
    expect(coverBox(tighten(qr))).toEqual(expect.objectContaining({ w: expect.closeTo(10), h: expect.closeTo(10) }));
    const c = coverBox(qr);
    const t = coverBox(tighten(qr));
    expect(t.x).toBeCloseTo(c.x);
    expect(t.y).toBeCloseTo(c.y);
  });

  it('scales set-size text with its box', () => {
    const el = tighten(text({ autoFit: false, fontSize: 10 }));
    const patch = placePatch(el, { x: el.x, y: el.y, w: el.w * 2, h: el.h * 2 }) as Partial<TextElement>;
    expect(patch.fontSize).toBeCloseTo(20);
  });
});

describe('editing hugging elements', () => {
  it('keeps fitted text the same size while typing, growing the box', () => {
    const el = tighten(text());
    const size = fitFontSize(el);
    const typed = hugEdit(el, { text: 'Label maker' }) as TextElement;
    expect(fitFontSize(typed)).toBeCloseTo(size);
    expect(typed.w).toBeGreaterThan(el.w);
    expect(typed.h).toBeCloseTo(el.h);
    // Centred text grows both ways.
    expect(typed.x + typed.w / 2).toBeCloseTo(el.x + el.w / 2);
  });

  it('trims the empty space of a loose box on the first edit, leaving the text where it was', () => {
    const loose = text();
    const shown = visualBox(loose);
    const bold = hugEdit(loose, { italic: true });
    expect(bold.h).toBeCloseTo(shown.h);
    expect(bold.y).toBeCloseTo(shown.y);
  });

  it('keeps the size when fitting is turned off', () => {
    const el = tighten(text());
    const pt = shownFontSize(el);
    const fixed = hugEdit(el, { autoFit: false }) as TextElement;
    expect(fixed.fontSize).toBeCloseTo(pt, 0);
    expect(fixed.w).toBeCloseTo(el.w, 1);
  });

  it('keeps a barcode its height when its value grows', () => {
    const code = tighten({ ...createElement('barcode', doc), x: 0, y: 0, w: 30, h: 10 });
    const longer = hugEdit(code, { value: '123456789012345678' });
    expect(longer.h).toBeCloseTo(code.h, 1);
    expect(longer.w).toBeGreaterThan(code.w);
  });

  it('takes a moved or resized box as it is', () => {
    const el = text();
    expect(hugEdit(el, { x: 5 })).toMatchObject({ x: 5, w: 30, h: 10 });
  });
});

describe('icons', () => {
  it('hugs the artwork, leaving out the space around it, and draws the same once tightened', async () => {
    const { setIconInk } = await import('../render/iconInk');
    const { elementSvg } = await import('../render/svg');
    const body = '<path d="M32 64H224V192H32Z"/>';
    setIconInk(body, [32, 64, 192, 128]);
    const icon = { ...createElement('icon', doc), body, x: 0, y: 0, w: 12, h: 12 };
    // The 256 box fills 12 mm; the artwork is 9 × 6 mm of it.
    expect(visualBox(icon)).toEqual({ x: 1.5, y: 3, w: 9, h: 6 });
    const tight = tighten(icon);
    expect(tight).toMatchObject({ x: 1.5, y: 3, w: 9, h: 6, viewBox: '32 64 192 128' });
    expect(visualBox(tight)).toEqual({ x: 1.5, y: 3, w: 9, h: 6 });
    expect(elementSvg(tight)).toContain('viewBox="32 64 192 128"');
  });

  it('drops a viewBox from a file unless it is four numbers', async () => {
    const { parseDoc } = await import('./model');
    const file = (viewBox: unknown) => ({ ...createDoc(), elements: [{ ...createElement('icon', doc), body: '<path d="M0 0H1V1Z"/>', viewBox }] });
    expect((parseDoc(file('1 2 3 4')).elements[0] as { viewBox?: string }).viewBox).toBe('1 2 3 4');
    expect((parseDoc(file('0 0 1 1"/><script>')).elements[0] as { viewBox?: string }).viewBox).toBeUndefined();
  });
});
