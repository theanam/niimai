import { readFileSync } from 'node:fs';
import { filterIcons, iconBody, iconLabel, parseIconMeta, sanitizeIconBody } from './catalog';

const meta = parseIconMeta(JSON.parse(readFileSync('public/icons/meta.json', 'utf8')));

describe('icon catalog', () => {
  it('ships every Phosphor icon in each printable weight', () => {
    expect(meta.icons.length).toBeGreaterThan(1500);
    expect(meta.categories.length).toBeGreaterThan(10);
    for (const w of ['regular', 'bold', 'fill']) {
      const shapes = JSON.parse(readFileSync(`public/icons/${w}.json`, 'utf8'));
      expect(Object.keys(shapes)).toHaveLength(meta.icons.length);
      expect(shapes.package).toMatch(/^<path d="/);
    }
  });

  it('searches names first, then tags, within a category', () => {
    const names = filterIcons(meta.icons, 'box').map((i) => i.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).toContain('box');
    const objects = filterIcons(meta.icons, '', 'objects');
    expect(objects.every((i) => i.categories.includes('objects'))).toBe(true);
    expect(filterIcons(meta.icons, 'qqqqzz')).toHaveLength(0);
  });

  it('keeps only path data from icon markup', () => {
    const evil = '<path d="M0 0L10 10Z" onclick="alert(1)"/><script>alert(1)</script><image href="javascript:x"/><path d="M1,2 3 4"/>';
    expect(sanitizeIconBody(evil)).toBe('<path d="M0 0L10 10Z"/><path d="M1,2 3 4"/>');
    expect(sanitizeIconBody('<path d="M0 0&quot;><script>"/>')).toBe('<path d="M0 0quotscript"/>');
  });

  it('loads one icon shape by weight', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(readFileSync('public/icons/fill.json', 'utf8'))));
    try {
      expect(await iconBody('package', 'fill')).toMatch(/^<path d="M/);
      await expect(iconBody('no-such-icon', 'fill')).rejects.toThrow(/not found/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('labels icons for people', () => {
    expect(iconLabel('arrow-circle-up')).toBe('Arrow circle up');
  });
});
