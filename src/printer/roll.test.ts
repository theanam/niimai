import { resolveRoll, sameSize } from './roll';

describe('roll size', () => {
  it('uses the size the printer reports', () => {
    expect(resolveRoll({ widthMm: 40, heightMm: 12, barcode: 'b' }, {})).toEqual({ size: { widthMm: 40, heightMm: 12 }, key: 'b', needsSize: false });
  });

  it('falls back to a size saved for the barcode', () => {
    expect(resolveRoll({ barcode: 'b', remaining: 3 }, { b: { widthMm: 50, heightMm: 30 } })).toEqual({
      size: { widthMm: 50, heightMm: 30 },
      key: 'b',
      needsSize: false,
    });
  });

  it('asks for the size of an unknown roll', () => {
    expect(resolveRoll({ barcode: 'new' }, {})).toEqual({ size: null, key: 'new', needsSize: true });
  });

  it('knows nothing without a roll', () => {
    expect(resolveRoll(undefined, {})).toEqual({ size: null, key: null, needsSize: false });
    expect(resolveRoll({ remaining: 5 }, {})).toEqual({ size: null, key: null, needsSize: false });
  });

  it('compares sizes', () => {
    expect(sameSize({ widthMm: 1, heightMm: 2 }, { widthMm: 1, heightMm: 2 })).toBe(true);
    expect(sameSize({ widthMm: 1, heightMm: 2 }, { widthMm: 2, heightMm: 1 })).toBe(false);
  });
});
