import { readFileSync } from 'node:fs';
import { parseCatalog } from '../fonts/catalog';
import { symbolError } from '../render/barcode';
import { CATEGORIES, filterTemplates, labelFromTemplate, TEMPLATE_FONTS, TEMPLATE_SIZES, TEMPLATES, templatePreview, templatesForSize } from '.';
import { KINDS } from './kinds';
import KIND_ICONS from './kind-icons.json';
import ICON_SHAPES from './icon-shapes.json';

describe('template catalog', () => {
  it('has well over a thousand templates with unique ids', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(1000);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(new Set(KINDS.map((k) => k.id)).size).toBe(KINDS.length);
  });

  it('covers every category with several kinds', () => {
    for (const c of CATEGORIES) expect(KINDS.filter((k) => k.category === c.id).length).toBeGreaterThanOrEqual(5);
    expect(KINDS.every((k) => CATEGORIES.some((c) => c.id === k.category))).toBe(true);
  });

  it('keeps every element inside the label at every size', () => {
    for (const t of TEMPLATES) {
      const doc = templatePreview(t);
      for (const el of doc.elements) {
        expect(el.x, t.id).toBeGreaterThanOrEqual(0);
        expect(el.y, t.id).toBeGreaterThanOrEqual(0);
        expect(el.w, t.id).toBeGreaterThan(0);
        expect(el.h, t.id).toBeGreaterThan(0);
        expect(el.x + el.w, t.id).toBeLessThanOrEqual(doc.widthMm + 0.05);
        expect(el.y + el.h, t.id).toBeLessThanOrEqual(doc.heightMm + 0.05);
      }
    }
  });

  it('gives every template a title and only encodable codes', () => {
    for (const t of TEMPLATES) {
      const doc = templatePreview(t);
      expect(doc.elements.some((e) => e.type === 'text' && e.text.trim()), t.id).toBe(true);
      for (const el of doc.elements) if (el.type === 'qr' || el.type === 'barcode') expect(symbolError(el), t.id).toBeNull();
    }
  });

  it('uses only Google Fonts, bold only where a bold face exists', () => {
    const catalog = new Map(parseCatalog(JSON.parse(readFileSync('public/fonts/google-fonts.json', 'utf8'))).map((f) => [f.name, f]));
    for (const font of TEMPLATE_FONTS) expect(catalog.has(font), font).toBe(true);
    for (const t of TEMPLATES.filter((x) => x.size === TEMPLATE_SIZES[0])) {
      for (const el of templatePreview(t).elements) {
        if (el.type === 'text' && el.bold) expect(catalog.get(el.fontFamily)?.weights, `${t.id} ${el.fontFamily}`).toContain(700);
      }
    }
  });

  it('lays out every kind for any size, including sizes outside the catalog', () => {
    const odd = templatesForSize({ widthMm: 37, heightMm: 19 });
    expect(odd).toHaveLength(KINDS.length + Object.keys(KIND_ICONS).length);
    for (const t of odd) for (const el of templatePreview(t).elements) expect(el.x + el.w).toBeLessThanOrEqual(37.05);
  });

  it('maps icons only onto real kinds, with a bundled shape for each', () => {
    const kinds = new Set(KINDS.map((k) => k.id));
    for (const [kind, icon] of Object.entries(KIND_ICONS)) {
      expect(kinds.has(kind), kind).toBe(true);
      expect((ICON_SHAPES as Record<string, string>)[icon], icon).toMatch(/^<path d="/);
    }
  });

  it('puts an icon in every icon version, and none in the text versions', () => {
    for (const t of TEMPLATES) {
      const icons = templatePreview(t).elements.filter((e) => e.type === 'icon');
      expect(icons.length, t.id).toBe(t.variant === 'icon' ? 1 : 0);
      if (icons[0]?.type === 'icon') expect(icons[0].body).toMatch(/^<path d="/);
    }
  });

  it('makes a fresh editable label each time', () => {
    const a = labelFromTemplate(TEMPLATES[0]);
    const b = labelFromTemplate(TEMPLATES[0]);
    expect(a.id).not.toBe(b.id);
    expect(a.elements[0].id).not.toBe(b.elements[0].id);
    expect([a.widthMm, a.heightMm]).toEqual([TEMPLATES[0].size.widthMm, TEMPLATES[0].size.heightMm]);
  });

  it('filters by words, category and size', () => {
    const paprika = filterTemplates(TEMPLATES, { query: 'smoked paprika' });
    expect(paprika.every((t) => t.kind.id === 'spices-paprika')).toBe(true);
    expect(new Set(paprika.map((t) => t.variant))).toEqual(new Set(['text', 'icon']));
    expect(filterTemplates(TEMPLATES, { category: 'safety' }).every((t) => t.category === 'safety')).toBe(true);
    const size = { widthMm: 50, heightMm: 30 };
    expect(filterTemplates(TEMPLATES, { size })).toHaveLength(templatesForSize(size).length);
    expect(filterTemplates(TEMPLATES, { query: 'zzzz' })).toHaveLength(0);
  });
});
