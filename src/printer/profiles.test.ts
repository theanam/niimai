import { DEMO_META } from './mock';
import { correctTask, findManualProfile, inkOutsideHead, printheadCrop, MANUAL_PROFILES, printheadMm, resolveProfile } from './profiles';

describe('printer profiles', () => {
  it('builds a profile from library metadata', () => {
    const p = resolveProfile(DEMO_META, 'D11_V1');
    expect(p).toMatchObject({ dpi: 203, printheadPixels: 96, printDirection: 'left', printTask: 'D11_V1' });
  });

  it('ignores a manual choice when the printer is recognised', () => {
    const manual = findManualProfile('b1')!;
    expect(resolveProfile(DEMO_META, 'D11_V1', manual)?.printTask).toBe('D11_V1');
  });

  it('uses the manual choice for an unrecognised printer', () => {
    const manual = findManualProfile('b1')!;
    expect(resolveProfile(undefined, undefined, manual)).toBe(manual);
  });

  it('crops pages wider than the printhead, centred', () => {
    const b21 = { printheadPixels: 384, printDirection: 'top' as const };
    expect(printheadCrop(400, 240, b21)).toEqual({ x: 8, y: 0, width: 384, height: 240, cropped: true });
    expect(printheadCrop(320, 240, b21)).toMatchObject({ x: 0, width: 320, cropped: false });
    const d11 = { printheadPixels: 96, printDirection: 'left' as const };
    expect(printheadCrop(240, 120, d11)).toEqual({ x: 0, y: 12, width: 240, height: 96, cropped: true });
  });

  it('uses the original B21 task for a B21 C2B on protocol 0', () => {
    expect(correctTask('B21_C2B', 0, 'B1')).toBe('B21_V1');
    expect(correctTask('B21_C2B', undefined, 'B1')).toBe('B21_V1');
    expect(correctTask('B21_C2B', 4, 'B1')).toBe('B1');
    expect(correctTask('D11', 0, 'D11_V1')).toBe('D11_V1');
    const meta = { ...DEMO_META, model: 'B21_C2B' } as typeof DEMO_META;
    expect(resolveProfile(meta, 'B1', undefined, 0)?.printTask).toBe('B21_V1');
  });

  it('returns null for unknown printers without a manual choice', () => {
    expect(resolveProfile(undefined, undefined)).toBeNull();
  });

  it('computes the printhead width in mm', () => {
    expect(printheadMm(findManualProfile('d11')!)).toBeCloseTo(12, 0);
    expect(printheadMm(findManualProfile('b1')!)).toBeCloseTo(48, 0);
  });

  it('offers a manual profile for each print task family', () => {
    expect(MANUAL_PROFILES.map((p) => p.printTask)).toEqual(['D11_V1', 'D110', 'B1', 'B21_V1']);
  });

  it('spots ink outside the printhead and ignores it inside', () => {
    const d11 = { printheadPixels: 4, printDirection: 'left' as const };
    // 3 × 6 page, white; the head covers rows 1 to 4.
    const page = (blackAt?: [number, number]) => {
      const d = new Uint8ClampedArray(3 * 6 * 4).fill(255);
      if (blackAt) d[(blackAt[1] * 3 + blackAt[0]) * 4] = 0;
      return d;
    };
    expect(inkOutsideHead(page(), 3, 6, d11)).toBe(false);
    expect(inkOutsideHead(page([2, 3]), 3, 6, d11)).toBe(false);
    expect(inkOutsideHead(page([1, 0]), 3, 6, d11)).toBe(true);
    expect(inkOutsideHead(page([0, 5]), 3, 6, d11)).toBe(true);
    const b21 = { printheadPixels: 2, printDirection: 'top' as const };
    expect(inkOutsideHead(page([0, 2]), 3, 6, b21)).toBe(false);
    expect(inkOutsideHead(page([2, 2]), 3, 6, b21)).toBe(true);
    expect(inkOutsideHead(page([0, 0]), 3, 6, { printheadPixels: 8, printDirection: 'left' })).toBe(false);
  });
});
