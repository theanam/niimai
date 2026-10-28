import { clamp, mmToPx, ptToMm, pxToMm, round1, uid } from './units';

describe('units', () => {
  it('converts mm and px at a given dpi', () => {
    expect(mmToPx(25.4, 203)).toBeCloseTo(203);
    expect(pxToMm(203, 203)).toBeCloseTo(25.4);
  });
  it('converts points to mm', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4);
  });
  it('rounds and clamps', () => {
    expect(round1(1.2000000002)).toBe(1.2);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
  it('makes unique ids', () => {
    expect(uid()).not.toBe(uid());
  });
});
