import { alignmentDoc, RULER_MM } from './alignment';

describe('alignment test label', () => {
  it('outlines the label, marks the centre and numbers a ruler at each end', () => {
    const doc = alignmentDoc({ widthMm: 30, heightMm: 15 });
    expect(doc).toMatchObject({ widthMm: 30, heightMm: 15 });
    expect(doc.elements.filter((e) => e.type === 'frame')).toHaveLength(1);
    const numbers = doc.elements.flatMap((e) => (e.type === 'text' ? [e.text] : []));
    // Every even millimetre is numbered at both ends of each ruler.
    expect(numbers.filter((n) => n === '2')).toHaveLength(4);
    expect(numbers).toContain(String(RULER_MM));
    const centre = doc.elements.find((e) => e.type === 'line' && e.direction === 'vertical' && e.h === 15);
    expect(centre && centre.x + centre.w / 2).toBe(15);
  });

  it('numbers a ruler down from the top and up from the bottom', () => {
    const doc = alignmentDoc({ widthMm: 50, heightMm: 30 });
    const ticks = doc.elements.filter((e) => e.type === 'line' && e.direction === 'horizontal');
    const ys = ticks.map((e) => e.y + e.h / 2).sort((a, b) => a - b);
    // One tick per millimetre in from each edge, centred on the centre line.
    expect(ys.slice(0, 2)).toEqual([1, 2]);
    expect(ys.slice(-2)).toEqual([28, 29]);
    expect(ticks).toHaveLength(2 * RULER_MM);
    for (const t of ticks) expect(t.x + t.w / 2).toBeCloseTo(25);
    const numbers = doc.elements.flatMap((e) => (e.type === 'text' ? [e.text] : []));
    // Even millimetres at both ends of both rulers.
    expect(numbers.filter((n) => n === '2')).toHaveLength(4);
  });

  it('shortens the top and bottom rulers on short labels', () => {
    const ticks = alignmentDoc({ widthMm: 40, heightMm: 12 }).elements.filter((e) => e.type === 'line' && e.direction === 'horizontal');
    expect(ticks).toHaveLength(2 * 4);
  });

  it('keeps the outline on a cable label flag', () => {
    const doc = alignmentDoc({ widthMm: 109, heightMm: 12.5, tailMm: 35 });
    expect(doc.elements.find((e) => e.type === 'frame')).toMatchObject({ x: 0, w: 74 });
  });
});
