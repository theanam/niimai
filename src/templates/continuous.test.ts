import { printIssues } from '../render/printability';
import { labelFromTemplate, templatePreview } from '.';
import { CONTINUOUS_CATEGORY, CONTINUOUS_TEMPLATES } from './continuous';

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
});
