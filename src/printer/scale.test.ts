import { LINED_UP_MM } from './thermalPaper';
import { fromScale, scaleDoc, scaleLength, type ScaleReadings } from './scale';

describe('sticker scale', () => {
  it('prints just enough for a whole sticker and the next top, from anywhere on the roll', () => {
    // Stickers about 25 mm: room for two steps of a sticker up to 40 mm and a 5 mm gap.
    expect(scaleLength(25, 2)).toBe(93);
    expect(scaleLength(12, 2)).toBe(67);
    expect(scaleLength(25, 8)).toBe(99);
    // Whatever the start, the first whole sticker's top, its bottom and the next top are on the scale,
    // for any sticker up to 15 mm longer than the guess.
    for (const about of [10, 25, 50]) {
      for (const extra of [-5, 0, 7, 15]) {
        const length = about + extra;
        const pitch = length + 4;
        const printed = scaleLength(about, 2);
        for (let start = 0; start < pitch; start += 0.5) {
          const top = (pitch - start) % pitch;
          expect(top + pitch).toBeLessThanOrEqual(printed - 1);
        }
      }
    }
    const doc = scaleDoc(48, 120);
    expect(doc).toMatchObject({ widthMm: 48, heightMm: 120 });
    // Numbered every 5 mm down the middle.
    const numbers = doc.elements.filter((e) => e.type === 'text').map((e) => (e.type === 'text' ? e.text : ''));
    expect(numbers).toEqual(expect.arrayContaining(['5', '10', '115']));
    // A number that would run off the end is left out.
    expect(numbers).not.toContain('120');
  });

  it('reads one sticker directly, and turns down numbers that cannot be right', () => {
    // Printing started 2 mm below a sticker's top; that sticker ends at 23, the next starts at 28, the last on the 120 mm scale at 118.
    const r: ScaleReadings = { left: 0, right: 50, top: -2, bottom: 23, next: 28, last: 118 };
    expect(fromScale(r, 72, 120)).toEqual({ width: 50, length: 25, gap: 5, offsetX: -11, offsetY: 0, feedMm: 28 });
    expect(fromScale({ ...r, left: 11, right: 61 }, 72, 120)).toMatchObject({ offsetX: 0 });
    // Without the last top, the next one places the paper.
    expect(fromScale({ ...r, last: 0 }, 72, 120)).toMatchObject({ length: 25, gap: 5, feedMm: 28 });
    // The gap is exactly next − bottom, whatever the last top reads.
    for (const last of [0, 58, 88, 95, 112, 118]) expect(fromScale({ ...r, last }, 72, 120)).toMatchObject({ length: 25, gap: 5 });
    expect(fromScale({ ...r, bottom: -5 }, 72, 120)).toEqual({ error: "The sticker's bottom must read more than its top." });
    expect(fromScale({ ...r, next: 20 }, 72, 120)).toMatchObject({ error: expect.stringContaining('next') });
    expect(fromScale({ ...r, right: 0 }, 72, 120)).toMatchObject({ error: expect.stringContaining('right edge') });
    expect(fromScale({ ...r, last: 130 }, 72, 120)).toMatchObject({ error: expect.stringContaining('ends at 120') });
  });
});

describe('the scale on a simulated roll', () => {
  /**
   * A roll of `width` × `length` stickers every `length + gap`, sitting
   * `centre` mm right of the head's middle, loaded with the head `load` mm
   * into a sticker. The scale prints, the edges are read off it to 0.5 mm,
   * and the fix is applied.
   */
  const run = (roll: { width: number; length: number; gap: number; centre: number }, load: number, head: number, canRetract: boolean) => {
    const pitch = roll.length + roll.gap;
    // Printed from a set size a little short of the real one.
    const printed = scaleLength(roll.length - 3, roll.gap);
    const read = (v: number) => Math.round(v * 2) / 2;
    // A sticker top on the scale: the one the print started in, or the next.
    const top = load <= roll.length ? -load : pitch - load;
    const last = top + Math.floor((printed - top) / pitch) * pitch;
    const r: ScaleReadings = {
      left: read(head / 2 + roll.centre - roll.width / 2),
      right: read(head / 2 + roll.centre + roll.width / 2),
      top: read(top),
      bottom: read(top + roll.length),
      next: read(top + pitch),
      last: read(last),
    };
    const fix = fromScale(r, head, printed, canRetract);
    if ('error' in fix) throw new Error(fix.error);
    const stop = printed + fix.feedMm;
    const off = (((stop - top) % pitch) + pitch) % pitch;
    return { fix, offTop: Math.min(off, pitch - off) };
  };

  it('finds the roll and starts the next print on a sticker top, however it was loaded', () => {
    for (const roll of [
      { width: 50, length: 25, gap: 2, centre: 0 },
      { width: 40, length: 30, gap: 3, centre: 2 },
      { width: 46, length: 20, gap: 2.5, centre: -1.5 },
    ]) {
      for (const load of [0, 2, 12.5, roll.length + 1]) {
        for (const canRetract of [false, true]) {
          const { fix, offTop } = run(roll, load, 48, canRetract);
          expect(Math.abs(fix.width - roll.width)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(fix.length - roll.length)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(fix.gap - roll.gap)).toBeLessThanOrEqual(1);
          expect(Math.abs(fix.offsetX - roll.centre)).toBeLessThanOrEqual(0.5);
          // Readings are to 0.5 mm; forward-only printers may also keep a head just past a top.
          expect(offTop).toBeLessThan((canRetract ? 0 : LINED_UP_MM) + 0.6);
        }
      }
    }
  });
});
