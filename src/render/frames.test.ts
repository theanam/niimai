import { FRAME_STYLES, frameSvg, isFrameStyle } from './frames';

const box = { x: 1, y: 1, w: 30, h: 12 };

describe('frames', () => {
  it('draws every style inside its box', () => {
    for (const { value } of FRAME_STYLES) {
      const svg = frameSvg(value, box, 0.5);
      expect(svg).toMatch(/^<(rect|path)/);
      const nums = [...svg.matchAll(/\b[xy]="([\d.]+)"/g)].map((m) => Number(m[1]));
      for (const v of nums) expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it('draws two outlines for double frames', () => {
    expect(frameSvg('double', box, 0.5).match(/<rect/g)).toHaveLength(2);
  });

  it('dashes and dots the outline', () => {
    expect(frameSvg('dashed', box, 0.5)).toContain('stroke-dasharray="2 1.25"');
    expect(frameSvg('dotted', box, 0.5)).toContain('stroke-linecap="round"');
  });

  it('keeps the stroke thinner than a quarter of the box', () => {
    expect(frameSvg('single', { x: 0, y: 0, w: 8, h: 4 }, 3)).toContain('stroke-width="1"');
  });

  it('recognises style names', () => {
    expect(isFrameStyle('ticket')).toBe(true);
    expect(isFrameStyle('wavy')).toBe(false);
  });
});
