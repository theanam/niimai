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

  it('snaps to extra guides such as a fold line', () => {
    const r = snapBox({ x: 37.3, y: 2, w: 10, h: 4 }, { widthMm: 74, heightMm: 12.5 }, [], 0.5, [37]);
    expect(r.x).toBeCloseTo(37);
    expect(r.guides).toContainEqual({ axis: 'x', at: 37 });
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

  it('keeps a flat box’s corner under the pointer as it scales', () => {
    // A text box 40 × 4 dragged by its corner to a point on its diagonal, twice as far out.
    const flat = { x: 0, y: 0, w: 40, h: 4, rotation: 0 };
    expect(resizeBox(flat, 'se', 40, 4, true)).toMatchObject({ w: 80, h: 8 });
    // Moving across with the pointer a little low follows the move across: before, the short side won and
    // the corner shot 20 mm past the pointer.
    const r = resizeBox(flat, 'se', 20, 4, true);
    expect(r.w).toBeCloseTo(60.2, 1);
    expect(r.h).toBeCloseTo(6.02, 1);
    // Dragging from the opposite corner works the same way.
    expect(resizeBox(flat, 'nw', -40, -4, true)).toMatchObject({ x: -40, y: -4, w: 80, h: 8 });
  });

  it('keeps proportions at the minimum size', () => {
    const r = resizeBox({ x: 0, y: 0, w: 40, h: 4, rotation: 0 }, 'se', -60, -60, true);
    expect(r.h).toBeCloseTo(0.5);
    expect(r.w).toBeCloseTo(5);
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
