import { alignPatches, distributePatches } from './align';
import { createDoc, createElement, type LabelElement } from './model';

const doc = createDoc({ widthMm: 50, heightMm: 30 });
const rect = (x: number, y: number, w: number, h: number): LabelElement => ({ ...createElement('rect', doc), x, y, w, h });
const area = { x: 0, y: 0, w: 50, h: 30 };

describe('align and distribute', () => {
  it('lines several elements up with each other', () => {
    const a = rect(2, 2, 10, 4);
    const b = rect(20, 10, 6, 6);
    expect(alignPatches([a, b], 'left', area)).toEqual({ [b.id]: { x: 2 } });
    expect(alignPatches([a, b], 'right', area)).toEqual({ [a.id]: { x: 16 } });
    expect(alignPatches([a, b], 'bottom', area)).toEqual({ [a.id]: { y: 12 } });
    // The selection spans 2 to 16 high; centres meet at 9.
    expect(alignPatches([a, b], 'centerY', area)).toEqual({ [a.id]: { y: 7 }, [b.id]: { y: 6 } });
  });

  it('lines one element up with the label', () => {
    const a = rect(2, 2, 10, 4);
    expect(alignPatches([a], 'centerX', area)).toEqual({ [a.id]: { x: 20 } });
    expect(alignPatches([a], 'bottom', area)).toEqual({ [a.id]: { y: 26 } });
  });

  it('spaces three or more evenly, keeping the outermost', () => {
    const a = rect(0, 0, 10, 5);
    const b = rect(12, 0, 4, 5);
    const c = rect(40, 0, 10, 5);
    // 50 mm span, 24 mm of elements: two gaps of 13 mm.
    expect(distributePatches([c, a, b], 'x')).toEqual({ [b.id]: { x: 23 } });
    expect(distributePatches([a, b], 'x')).toEqual({});
  });
});
