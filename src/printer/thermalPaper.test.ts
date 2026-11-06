import { printWidthFor, stickerFeed } from './thermalPaper';

describe('feeding a sticker roll', () => {
  it('feeds the rest of a sticker after a shorter label, then the gap', () => {
    expect(stickerFeed(2, 25, 12)).toBe(15);
    expect(stickerFeed(2, 25, 25)).toBe(2);
    // A label longer than the sticker runs on; only the gap follows.
    expect(stickerFeed(2, 25, 30)).toBe(2);
  });
});

describe('print width for a head of unknown width', () => {
  it('follows the paper class: 58 mm, 80 mm and 4-inch paper', () => {
    expect([40, 48, 58, 69, 70, 75, 80, 99, 100, 112].map(printWidthFor)).toEqual([48, 48, 48, 48, 72, 72, 72, 72, 104, 104]);
  });
});
