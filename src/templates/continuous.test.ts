import { printIssues } from '../render/printability';
import { labelFromTemplate, templatePreview } from '.';
import { BOTTOM_SPACE_MM, CONTINUOUS_CATEGORY, CONTINUOUS_TEMPLATES, continuousTemplates } from './continuous';

describe('continuous paper templates', () => {
  it('offers a set of lists, planners and notes, 48 mm wide', () => {
    expect(CONTINUOUS_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(CONTINUOUS_TEMPLATES.map((t) => t.id)).size).toBe(CONTINUOUS_TEMPLATES.length);
    expect(CONTINUOUS_TEMPLATES.map((t) => t.name)).toEqual(expect.arrayContaining(['To-do list', 'Shopping list', 'Packing list', 'Notes']));
    for (const t of CONTINUOUS_TEMPLATES) {
      expect(t.size.widthMm, t.id).toBe(48);
      expect(t.category).toBe(CONTINUOUS_CATEGORY.id);
    }
  });

  it('keeps every element on the paper and prints cleanly at 203 dpi', () => {
    for (const t of CONTINUOUS_TEMPLATES) {
      const doc = templatePreview(t);
      expect(doc.elements.length, t.id).toBeGreaterThan(5);
      for (const el of doc.elements) {
        expect(el.x, t.id).toBeGreaterThanOrEqual(0);
        expect(el.y, t.id).toBeGreaterThanOrEqual(0);
        expect(el.x + el.w, t.id).toBeLessThanOrEqual(t.size.widthMm + 0.01);
        expect(el.y + el.h, t.id).toBeLessThanOrEqual(t.size.heightMm + 0.01);
      }
      expect(printIssues(doc, 203), t.id).toEqual({});
    }
  });

  it('makes a fresh editable label at the template length', () => {
    const todo = CONTINUOUS_TEMPLATES.find((t) => t.name === 'To-do list')!;
    const a = labelFromTemplate(todo);
    const b = labelFromTemplate(todo);
    expect(a).toMatchObject({ widthMm: 48, heightMm: todo.size.heightMm, name: 'To-do list' });
    expect(a.elements[0].id).not.toBe(b.elements[0].id);
    expect(a.elements.filter((e) => e.type === 'rect')).toHaveLength(9);
  });

  it('can be found by everyday words', () => {
    expect(CONTINUOUS_TEMPLATES.find((t) => t.haystack.includes('groceries'))?.name).toBe('Shopping list');
  });

  it('lays every template out across wider paper, keeping it on the paper', () => {
    for (const width of [58, 72, 80]) {
      for (const t of continuousTemplates(width)) {
        expect(t.size.widthMm, t.id).toBe(width);
        const doc = templatePreview(t);
        const right = Math.max(...doc.elements.map((e) => e.x + e.w));
        // Rules and grids reach the far margin, so nothing is stuck at 48 mm.
        expect(right, t.id).toBeGreaterThan(width - 4);
        expect(right, t.id).toBeLessThanOrEqual(width + 0.01);
        expect(printIssues(doc, 203), t.id).toEqual({});
      }
    }
    expect(labelFromTemplate(continuousTemplates(72)[0])).toMatchObject({ widthMm: 72 });
  });

  it('leaves the same blank space under every template, at any width', () => {
    for (const width of [48, 75]) {
      for (const t of continuousTemplates(width)) {
        const bottom = Math.max(...templatePreview(t).elements.map((e) => e.y + e.h));
        const space = t.size.heightMm - bottom;
        expect(space, t.id).toBeGreaterThanOrEqual(BOTTOM_SPACE_MM);
        expect(space, t.id).toBeLessThan(BOTTOM_SPACE_MM + 1);
      }
    }
  });
});
