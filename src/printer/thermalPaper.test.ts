import { correctedGap, MAX_GAP_MM } from './thermalPaper';

describe('sticker gap from the line-up test', () => {
  it('narrows the gap when later prints sit lower, and widens it when they sit higher', () => {
    // Three prints: the creep shows twice between the first and the last.
    expect(correctedGap(3, 1)).toBe(2.5);
    expect(correctedGap(2, -1)).toBe(2.5);
    expect(correctedGap(2, 0)).toBe(2);
    expect(correctedGap(2, 1.5, 4)).toBe(1.5);
  });

  it('keeps the gap within what the printer takes', () => {
    expect(correctedGap(0.5, 4)).toBe(0);
    expect(correctedGap(MAX_GAP_MM, -4)).toBe(MAX_GAP_MM);
  });
});
