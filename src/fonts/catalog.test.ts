import { filterFonts, parseCatalog, previewUrl } from './catalog';

const rows = [
  ['inter', 'Inter', 'sans', [700, 400], 1],
  ['lobster', 'Lobster', 'display', [400], 0],
  ['roboto-mono', 'Roboto Mono', 'mono', [400], 1],
  ['roboto', 'Roboto', 'sans', [400], 1],
  ['broken'],
];

describe('font catalogue', () => {
  const fonts = parseCatalog(rows);

  it('parses compact rows and skips bad ones', () => {
    expect(fonts).toHaveLength(4);
    expect(fonts[0]).toEqual({ id: 'inter', name: 'Inter', cat: 'sans', weights: [400, 700], italic: true });
  });

  it('filters by category', () => {
    expect(filterFonts(fonts, '', 'mono').map((f) => f.name)).toEqual(['Roboto Mono']);
  });

  it('ranks names that start with the query first', () => {
    expect(filterFonts(fonts, 'mono').map((f) => f.name)).toEqual(['Roboto Mono']);
    expect(filterFonts(fonts, 'rob').map((f) => f.name)).toEqual(['Roboto Mono', 'Roboto']);
    expect(filterFonts(fonts, 'o').map((f) => f.name)[0]).not.toBe('Inter');
  });

  it('builds a preview url with only the name glyphs', () => {
    expect(previewUrl(fonts[1])).toBe('https://fonts.googleapis.com/css2?family=Lobster:wght@400&text=Lobster&display=swap');
  });

  it('ships a generated catalogue covering every category', async () => {
    const { readFileSync } = await import('node:fs');
    const all = parseCatalog(JSON.parse(readFileSync('public/fonts/google-fonts.json', 'utf8')));
    expect(all.length).toBeGreaterThan(1000);
    for (const cat of ['sans', 'serif', 'display', 'script', 'mono']) expect(all.some((f) => f.cat === cat)).toBe(true);
  });
});
