import { parseRoute } from './router';

describe('router', () => {
  it('parses hash routes', () => {
    expect(parseRoute('')).toBe('editor');
    expect(parseRoute('#/')).toBe('editor');
    expect(parseRoute('#/help')).toBe('help');
    expect(parseRoute('#/about?x=1')).toBe('about');
    expect(parseRoute('#/nope')).toBe('editor');
  });
});
