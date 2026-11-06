import { paperSummary, parsePreset, presetFrom, presetValues, samePaper, suggestName } from './paperPresets';

const stickers = { widthMm: 50, lengthMm: 30, gapMm: 2, offset: { x: 0, y: 0 } };

describe('paper presets', () => {
  it('keeps a paper as a preset and gives back the same settings', () => {
    const p = presetFrom('  Kraft 50 × 30 ', { ...stickers, offset: { x: 1.5, y: -0.5 } });
    expect(p).toMatchObject({ name: 'Kraft 50 × 30', widthMm: 50, lengthMm: 30, gapMm: 2, offset: { x: 1.5, y: -0.5 } });
    expect(p.id).toBeTruthy();
    expect(samePaper(presetValues(p), { ...stickers, offset: { x: 1.5, y: -0.5 } })).toBe(true);
  });

  it('leaves out the gap on continuous paper and an unmoved print position', () => {
    const p = presetFrom('Roll', { widthMm: 75, lengthMm: 80, offset: { x: 0, y: 0 } }, 'id-1');
    expect(p).toEqual({ id: 'id-1', name: 'Roll', widthMm: 75, lengthMm: 80 });
    expect(presetValues(p)).toEqual({ widthMm: 75, lengthMm: 80, offset: { x: 0, y: 0 } });
  });

  it('sees any change in size, gap, paper kind or position', () => {
    expect(samePaper(stickers, { ...stickers })).toBe(true);
    expect(samePaper(stickers, { ...stickers, widthMm: 51 })).toBe(false);
    expect(samePaper(stickers, { ...stickers, lengthMm: 31 })).toBe(false);
    expect(samePaper(stickers, { ...stickers, gapMm: 3 })).toBe(false);
    expect(samePaper(stickers, { widthMm: 50, lengthMm: 30, offset: { x: 0, y: 0 } })).toBe(false);
    expect(samePaper(stickers, { ...stickers, offset: { x: 0.25, y: 0 } })).toBe(false);
  });

  it('describes a paper in a few words', () => {
    expect(paperSummary(stickers)).toBe('50 × 30 mm stickers, 2 mm gap');
    expect(paperSummary({ widthMm: 75, lengthMm: 80 })).toBe('75 mm continuous');
  });

  it('suggests a name from the size that no other paper has', () => {
    expect(suggestName(stickers, [])).toBe('Stickers 50 × 30');
    const taken = [presetFrom('Stickers 50 × 30', stickers), presetFrom('stickers 50 × 30 (2)', stickers)];
    expect(suggestName(stickers, taken)).toBe('Stickers 50 × 30 (3)');
    expect(suggestName({ widthMm: 58, lengthMm: 30 }, [])).toBe('Continuous 58 mm');
  });

  it('reads presets back, refusing ones without a name or with sizes out of range', () => {
    expect(parsePreset({ id: 'a', name: 'Roll', widthMm: 58, lengthMm: 30 })).toEqual({ id: 'a', name: 'Roll', widthMm: 58, lengthMm: 30 });
    expect(parsePreset({ name: 'S', widthMm: 40, lengthMm: 30, gapMm: 3, offset: { x: 1, y: 0 } })).toMatchObject({ gapMm: 3, offset: { x: 1, y: 0 } });
    expect(parsePreset({ name: 'S', widthMm: 40, lengthMm: 30 })?.id).toBeTruthy();
    expect(parsePreset({ name: '', widthMm: 58, lengthMm: 30 })).toBeNull();
    expect(parsePreset({ name: 'Huge', widthMm: 900, lengthMm: 30 })).toBeNull();
    expect(parsePreset({ name: 'Bad gap', widthMm: 58, lengthMm: 30, gapMm: -1 })).toBeNull();
    expect(parsePreset('nope')).toBeNull();
  });
});
