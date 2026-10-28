import { findManualProfile } from './profiles';
import { KNOWN_ROLL_SIZES, KNOWN_ROLLS, resolveRoll, sameSize, sizesForPrinter } from './roll';

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

  it('fills in sizes of known rolls, with the user\'s own choice taking priority', () => {
    const known = { b: { widthMm: 30, heightMm: 15 } };
    expect(resolveRoll({ barcode: 'b' }, {}, known).size).toEqual({ widthMm: 30, heightMm: 15 });
    expect(resolveRoll({ barcode: 'b' }, { b: { widthMm: 40, heightMm: 12 } }, known).size).toEqual({ widthMm: 40, heightMm: 12 });
  });

  it('knows the rolls verified on hardware', () => {
    expect(resolveRoll({ barcode: '6971501227941' }, {}).size).toEqual({ widthMm: 50, heightMm: 30 });
    expect(resolveRoll({ barcode: '6972842743589' }, {}).size).toEqual({ widthMm: 30, heightMm: 15 });
    // D11 cable flag roll, T12.5×74+35.
    expect(resolveRoll({ barcode: '6972842743817' }, {}).size).toEqual({ widthMm: 109, heightMm: 12.5, tailMm: 35, fold: 'copy' });
  });

  it('keeps a clean table of known rolls', () => {
    const ean13 = (code: string) => {
      const d = [...code].map(Number);
      const sum = d.slice(0, 12).reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0);
      return (10 - (sum % 10)) % 10 === d[12];
    };
    const codes = Object.keys(KNOWN_ROLLS);
    expect(codes.length).toBeGreaterThan(50);
    for (const code of codes) {
      const roll = KNOWN_ROLLS[code];
      // Full codes are EAN-13; starter rolls bundled with printers carry 8-digit codes.
      expect(/^\d{13}$/.test(code) ? ean13(code) : /^\d{8}$/.test(code), code).toBe(true);
      expect(roll.widthMm, code).toBeGreaterThan(0);
      expect(roll.heightMm, code).toBeGreaterThan(0);
      expect(roll.name.length, code).toBeGreaterThan(2);
      if (roll.tailMm) expect(roll.tailMm, code).toBeLessThan(roll.widthMm);
    }
  });

  it('reports the product name of a recognised roll, and orients B-series rolls across the roll', () => {
    const r = resolveRoll({ barcode: '6975746634472' }, {});
    expect(r.name).toBe('R50×70 white');
    expect(r.size).toEqual({ widthMm: 50, heightMm: 70 });
    expect(resolveRoll({ barcode: '6972842743572' }, {}).size).toEqual({ widthMm: 40, heightMm: 12 });
  });

  it('offers every known roll size somewhere in the size lists', () => {
    const all = sizesForPrinter(null);
    for (const s of KNOWN_ROLL_SIZES) expect(all.some((o) => sameSize(o, s)), `${s.widthMm}x${s.heightMm}`).toBe(true);
  });

  it('offers roll sizes that suit the printhead', () => {
    const strips = sizesForPrinter(findManualProfile('d110')!);
    expect(strips.length).toBeGreaterThan(3);
    expect(strips.some((s) => s.tailMm === 35)).toBe(true);
    expect(strips.every((s) => s.heightMm <= 15.6)).toBe(true);
    const wide = sizesForPrinter(findManualProfile('b21')!);
    expect(wide.some((s) => s.widthMm === 50 && s.heightMm === 30)).toBe(true);
    expect(wide.every((s) => s.widthMm >= 24)).toBe(true);
    expect(sizesForPrinter(null).length).toBeGreaterThan(wide.length);
  });

  it('asks for the size of an unknown roll', () => {
    expect(resolveRoll({ barcode: 'new' }, {})).toEqual({ size: null, key: 'new', needsSize: true });
  });

  it('knows nothing without a roll', () => {
    expect(resolveRoll(undefined, {})).toEqual({ size: null, key: null, needsSize: false });
    expect(resolveRoll({ remaining: 5 }, {})).toEqual({ size: null, key: null, needsSize: false });
  });

  it('compares sizes, tail included', () => {
    expect(sameSize({ widthMm: 109, heightMm: 12.5, tailMm: 35 }, { widthMm: 109, heightMm: 12.5 })).toBe(false);
    expect(sameSize({ widthMm: 1, heightMm: 2 }, { widthMm: 1, heightMm: 2 })).toBe(true);
    expect(sameSize({ widthMm: 1, heightMm: 2 }, { widthMm: 2, heightMm: 1 })).toBe(false);
  });
});
