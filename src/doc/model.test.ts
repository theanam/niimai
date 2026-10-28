import { createDoc, createElement, parseDoc, serializeDoc, usedFonts } from './model';

describe('document model', () => {
  const doc = createDoc({ widthMm: 40, heightMm: 12 });

  it('creates elements centred inside the label', () => {
    for (const type of ['text', 'image', 'qr', 'barcode', 'icon', 'rect', 'ellipse', 'line'] as const) {
      const el = createElement(type, doc);
      expect(el.type).toBe(type);
      expect(el.x).toBeGreaterThanOrEqual(0);
      expect(el.y).toBeGreaterThanOrEqual(0);
      expect(el.x + el.w).toBeLessThanOrEqual(40);
      expect(el.y + el.h).toBeLessThanOrEqual(12);
    }
  });

  it('keeps QR codes square', () => {
    const qr = createElement('qr', doc);
    expect(qr.w).toBe(qr.h);
  });

  it('round-trips through JSON', () => {
    const d = { ...doc, elements: [createElement('text', doc), createElement('qr', doc)] };
    expect(parseDoc(JSON.parse(serializeDoc(d)))).toEqual(d);
  });

  it('rejects files that are not labels', () => {
    expect(() => parseDoc(null)).toThrow();
    expect(() => parseDoc({ version: 2, widthMm: 10, heightMm: 10 })).toThrow(/version/);
    expect(() => parseDoc({ version: 1 })).toThrow(/size/);
  });

  it('drops unknown elements and fills missing fields', () => {
    const parsed = parseDoc({ version: 1, widthMm: 30, heightMm: 15, elements: [{ type: 'hologram' }, { type: 'text', text: 'Hi' }] });
    expect(parsed.elements).toHaveLength(1);
    const text = parsed.elements[0];
    expect(text.type === 'text' && text.text).toBe('Hi');
    expect(typeof text.id).toBe('string');
    expect(Number.isFinite(text.w)).toBe(true);
  });

  it('strips anything but path data from icons in opened files', () => {
    const parsed = parseDoc({ version: 1, widthMm: 30, heightMm: 15, elements: [{ type: 'icon', name: 'x', body: '<path d="M0 0Z"/><script>alert(1)</script>' }] });
    const icon = parsed.elements[0];
    expect(icon.type === 'icon' && icon.body).toBe('<path d="M0 0Z"/>');
  });

  it('lists fonts in use once each', () => {
    const d = {
      ...doc,
      elements: [createElement('text', doc, { fontFamily: 'Lobster' } as never), createElement('text', doc, { fontFamily: 'Lobster' } as never), createElement('qr', doc)],
    };
    expect(usedFonts(d)).toEqual(['Lobster']);
  });
});
