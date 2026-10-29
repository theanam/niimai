import { createDoc, createElement, type ElementType, type LabelElement } from '../doc/model';
import { dotMm, printIssue, printIssues } from './printability';

const size = { widthMm: 60, heightMm: 30 };
const make = (type: ElementType, patch: Record<string, unknown>): LabelElement => ({ ...createElement(type, size), ...patch }) as LabelElement;

describe('printability', () => {
  it('knows the dot size', () => {
    expect(dotMm(203)).toBeCloseTo(0.125, 3);
    expect(dotMm(300)).toBeCloseTo(0.085, 3);
  });

  it('flags strokes thinner than a dot', () => {
    expect(printIssue(make('line', { strokeWidth: 0.1 }), 203)).toMatch(/0.13 mm/);
    expect(printIssue(make('line', { strokeWidth: 0.2 }), 203)).toBeNull();
    expect(printIssue(make('frame', { strokeWidth: 0.05 }), 203)).toMatch(/printer dot/);
    expect(printIssue(make('rect', { strokeWidth: 0.05, fill: false }), 203)).toMatch(/Outline/);
    expect(printIssue(make('rect', { strokeWidth: 0.05, fill: true }), 203)).toBeNull();
    // A finer printer resolves it.
    expect(printIssue(make('line', { strokeWidth: 0.1 }), 300)).toBeNull();
  });

  it('flags text whose letters would be thinner than a dot', () => {
    const tiny = make('text', { autoFit: false, fontSize: 3, bold: false, text: 'Tiny' });
    expect(printIssue(tiny, 203)).toMatch(/larger or bold/);
    expect(printIssue({ ...tiny, bold: true } as LabelElement, 203)).toBeNull();
    expect(printIssue({ ...tiny, fontSize: 12 } as LabelElement, 203)).toBeNull();
    expect(printIssue({ ...tiny, text: '  ' } as LabelElement, 203)).toBeNull();
  });

  it('flags icons with lines thinner than a dot', () => {
    const icon = make('icon', { name: 'star', weight: 'regular', body: '<path d="M0 0h256v256z"/>', w: 1.5, h: 1.5 });
    expect(printIssue(icon, 203)).toMatch(/use Bold/);
    expect(printIssue({ ...icon, weight: 'bold' } as LabelElement, 203)).toBeNull();
    expect(printIssue({ ...icon, w: 6, h: 6 } as LabelElement, 203)).toBeNull();
  });

  it('flags codes whose bars or squares are under two dots', () => {
    expect(printIssue(make('qr', { value: 'https://niimai.app/', w: 4, h: 4 }), 203)).toMatch(/Squares/);
    expect(printIssue(make('qr', { value: 'https://niimai.app/', w: 15, h: 15 }), 203)).toBeNull();
    expect(printIssue(make('barcode', { value: '123456789', format: 'code128', w: 10, h: 6 }), 203)).toMatch(/Bars/);
    expect(printIssue(make('barcode', { value: '123456789', format: 'code128', w: 55, h: 10 }), 203)).toBeNull();
  });

  it('collects issues for a whole label', () => {
    const doc = { ...createDoc(size), elements: [make('line', { id: 'thin', strokeWidth: 0.05 }), make('line', { id: 'ok', strokeWidth: 0.5 })] };
    expect(Object.keys(printIssues(doc, 203))).toEqual(['thin']);
  });
});
