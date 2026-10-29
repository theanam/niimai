import { alignmentDoc, RULER_MM } from './alignment';

describe('alignment test label', () => {
  it('outlines the label, marks the centre and numbers a ruler at each end', () => {
    const doc = alignmentDoc({ widthMm: 30, heightMm: 15 });
    expect(doc).toMatchObject({ widthMm: 30, heightMm: 15 });
    expect(doc.elements.filter((e) => e.type === 'frame')).toHaveLength(1);
    const numbers = doc.elements.flatMap((e) => (e.type === 'text' ? [e.text] : []));
    // Every even millimetre is numbered at both ends.
    expect(numbers.filter((n) => n === '2')).toHaveLength(2);
    expect(numbers).toContain(String(RULER_MM));
    const centre = doc.elements.find((e) => e.type === 'line' && e.direction === 'vertical' && e.h === 15);
    expect(centre && centre.x + centre.w / 2).toBe(15);
  });

  it('keeps the outline on a cable label flag', () => {
    const doc = alignmentDoc({ widthMm: 109, heightMm: 12.5, tailMm: 35 });
    expect(doc.elements.find((e) => e.type === 'frame')).toMatchObject({ x: 0, w: 74 });
  });
});
