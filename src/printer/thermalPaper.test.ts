import { stickerFeed } from './thermalPaper';

describe('feeding a sticker roll', () => {
  it('feeds the rest of a sticker after a shorter label, then the gap', () => {
    expect(stickerFeed(2, 25, 12)).toBe(15);
    expect(stickerFeed(2, 25, 25)).toBe(2);
    // A label longer than the sticker runs on; only the gap follows.
    expect(stickerFeed(2, 25, 30)).toBe(2);
  });
});
