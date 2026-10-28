import { createDoc, createElement } from './model';
import { resizeBox, snapBox } from './snap';

describe('snapping', () => {
  const doc = createDoc({ widthMm: 40, heightMm: 12 });

  it('snaps to the label edge within tolerance', () => {
    const r = snapBox({ x: 0.3, y: 5, w: 10, h: 2 }, doc, [], 0.5);
    expect(r.x).toBe(0);
    expect(r.guides).toContainEqual({ axis: 'x', at: 0 });
  });

  it('snaps centres to the label centre', () => {
    const r = snapBox({ x: 14.8, y: 0, w: 10, h: 2 }, doc, [], 0.5);
    expect(r.x).toBeCloseTo(15);
  });

  it('snaps to other elements', () => {
    const other = { ...createElement('rect', doc), x: 20, y: 2, w: 5, h: 5 };
    const r = snapBox({ x: 25.2, y: 8, w: 3, h: 1 }, doc, [other], 0.5);
    expect(r.x).toBeCloseTo(25);
  });

  it('leaves the box alone outside tolerance', () => {
    const r = snapBox({ x: 3, y: 3, w: 2, h: 2 }, doc, [], 0.5);
    expect(r).toMatchObject({ x: 3, y: 3, guides: [] });
  });
});

describe('resizing', () => {
  const start = { x: 10, y: 10, w: 10, h: 10, rotation: 0 };

  it('grows from the south-east corner keeping the top-left fixed', () => {
    expect(resizeBox(start, 'se', 5, 2, false)).toEqual({ x: 10, y: 10, w: 15, h: 12 });
  });

  it('grows from the west edge keeping the right edge fixed', () => {
    const r = resizeBox(start, 'w', -4, 0, false);
    expect(r.x + r.w).toBeCloseTo(20);
    expect(r.w).toBeCloseTo(14);
  });

  it('keeps proportions on corners when asked', () => {
    const r = resizeBox(start, 'se', 10, 0, true);
    expect(r.w).toBeCloseTo(r.h);
  });

  it('never shrinks below the minimum', () => {
    expect(resizeBox(start, 'se', -50, -50, false).w).toBe(0.5);
  });

  it('resizes in the element frame when rotated', () => {
    const r = resizeBox({ ...start, rotation: 90 }, 'e', 0, 5, false);
    expect(r.w).toBeCloseTo(15);
    expect(r.h).toBeCloseTo(10);
  });
});
