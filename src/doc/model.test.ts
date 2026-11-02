import { createDoc, createElement, onPaper, paperSize, parseDoc, placementArea, printableArea, reshapeLine, serializeDoc, sizeLabel, turnPatch, usedFonts, type LineElement, type TextElement } from './model';

describe('document model', () => {
  it('turns a line while keeping its length and centre on the label', () => {
    const label = { widthMm: 40, heightMm: 30 };
    const line = { ...createElement('line', label), x: 5, y: 14.5, w: 20, h: 1 } as LineElement;
    expect(reshapeLine(line, 'vertical', label)).toEqual({ direction: 'vertical', x: 14.5, y: 5, w: 1, h: 20 });
    expect(reshapeLine(line, 'down', label)).toEqual({ direction: 'down', x: 7.9, y: 7.9, w: 14.1, h: 14.1 });
    const tall = reshapeLine(line, 'vertical', { widthMm: 40, heightMm: 12 });
    expect(tall).toMatchObject({ h: 12, y: 0 });
  });

  it('keeps a diagonal line box when switching between diagonals', () => {
    const line = { ...createElement('line', { widthMm: 40, heightMm: 30 }), direction: 'down', x: 2, y: 2, w: 20, h: 10 } as LineElement;
    expect(reshapeLine(line, 'up', { widthMm: 40, heightMm: 30 })).toMatchObject({ direction: 'up', w: 20, h: 10, x: 2, y: 2 });
  });

  it('opens older lines as horizontal', () => {
    const doc = parseDoc({ version: 1, widthMm: 40, heightMm: 12, elements: [{ type: 'line', x: 1, y: 1, w: 10, h: 1 }] });
    expect(doc.elements[0]).toMatchObject({ direction: 'horizontal' });
  });

  it('sizes a new frame to the label with a small margin', () => {
    const frame = createElement('frame', { widthMm: 40, heightMm: 12 });
    expect(frame).toMatchObject({ type: 'frame', style: 'single', x: 0.5, y: 0.5, w: 39, h: 11 });
  });

  it('repairs frames with an unknown style or stroke', () => {
    const doc = parseDoc({ version: 1, widthMm: 40, heightMm: 12, elements: [{ type: 'frame', style: 'wavy', strokeWidth: -1 }] });
    expect(doc.elements[0]).toMatchObject({ style: 'single', strokeWidth: 0.5 });
  });

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

  it('starts text one line high: the whole of a small label, a heading on a big one', () => {
    expect(createElement('text', doc)).toMatchObject({ x: 1.2, y: 1.2, w: 37.6, h: 9.6 });
    const big = createElement('text', createDoc({ widthMm: 75, heightMm: 100 }));
    expect(big).toMatchObject({ w: 50, h: 10, x: 12.5, y: 45 });
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

  it('describes cable labels as flag + tail, and prints only on the flag', () => {
    const cable = { widthMm: 109, heightMm: 12.5, tailMm: 35 };
    expect(sizeLabel(cable)).toBe('74 + 35 × 12.5');
    expect(sizeLabel({ ...cable, fold: 'copy' })).toBe('37|37 + 35 × 12.5');
    // A repeated half leaves half the flag to design; separate halves leave all of it.
    expect(printableArea({ ...cable, fold: 'copy' })).toEqual({ widthMm: 37, heightMm: 12.5 });
    expect(printableArea({ ...cable, fold: 'none' })).toEqual({ widthMm: 74, heightMm: 12.5 });
    // With separate halves, new elements still start on the first side.
    expect(placementArea({ ...cable, fold: 'none' })).toEqual({ widthMm: 37, heightMm: 12.5 });
    expect(sizeLabel({ widthMm: 40, heightMm: 12 })).toBe('40 × 12');
    expect(printableArea(cable)).toEqual({ widthMm: 74, heightMm: 12.5 });
  });

  it('keeps a valid tail from a file and drops a nonsense one', () => {
    expect(parseDoc({ version: 1, widthMm: 109, heightMm: 12.5, tailMm: 35 }).tailMm).toBe(35);
    expect(parseDoc({ version: 1, widthMm: 40, heightMm: 12, tailMm: 80 }).tailMm).toBeUndefined();
    expect(parseDoc({ version: 1, widthMm: 40, heightMm: 12 }).tailMm).toBeUndefined();
    expect(parseDoc({ version: 1, widthMm: 109, heightMm: 12.5, tailMm: 35, fold: 'flip' }).fold).toBe('flip');
    expect(parseDoc({ version: 1, widthMm: 40, heightMm: 12, fold: 'sideways' }).fold).toBeUndefined();
  });

  it('lists fonts in use once each', () => {
    const d = {
      ...doc,
      elements: [createElement('text', doc, { fontFamily: 'Lobster' } as never), createElement('text', doc, { fontFamily: 'Lobster' } as never), createElement('qr', doc)],
    };
    expect(usedFonts(d)).toEqual(['Lobster']);
  });

  it('keeps the file name and printer a label was saved with', () => {
    expect(parseDoc({ ...createDoc(), fileName: 'Jars', printer: 'D110' })).toMatchObject({ fileName: 'Jars', printer: 'D110' });
    const bare = parseDoc({ ...createDoc(), fileName: 3, printer: '' });
    expect(bare.fileName).toBeUndefined();
    expect(bare.printer).toBeUndefined();
  });

  it("keeps a label's sheet, number sequence and dynamic elements", () => {
    const doc = createDoc();
    const text = { ...createElement('text', doc), dynamic: true };
    const parsed = parseDoc({
      ...doc,
      elements: [text, { ...createElement('qr', doc), dynamic: 'yes' }],
      sheet: { name: 'a.csv', columns: ['Name', 'Qty'], rows: [['Tea', 2], ['Coffee']] },
      sequence: { start: 10, step: 2, digits: 40 },
    });
    expect(parsed.sheet).toEqual({ name: 'a.csv', columns: ['Name', 'Qty'], rows: [['Tea', '2'], ['Coffee', '']] });
    expect(parsed.sequence).toEqual({ start: 10, step: 2, digits: 12 });
    expect(parsed.elements.map((e) => (e as { dynamic?: boolean }).dynamic)).toEqual([true, undefined]);
    expect(parseDoc({ ...doc, sheet: 'nope', sequence: { start: 'x' } })).not.toHaveProperty('sheet');
  });

  it('turns the artboard for landscape while the paper stays as it is', () => {
    const doc = createDoc({ widthMm: 50, heightMm: 30 });
    const turned = { ...doc, ...turnPatch(doc) };
    expect([turned.widthMm, turned.heightMm, turned.landscape]).toEqual([30, 50, true]);
    expect(paperSize(turned)).toEqual({ widthMm: 50, heightMm: 30 });
    expect(paperSize(doc)).toEqual({ widthMm: 50, heightMm: 30, tailMm: undefined, fold: undefined });
    const back = { ...turned, ...turnPatch(turned) };
    expect([back.widthMm, back.heightMm, back.landscape]).toEqual([50, 30, undefined]);
  });

  it('keeps elements in place, in proportion, and shrinks the ones too big for the turned artboard', () => {
    const doc = createDoc({ widthMm: 50, heightMm: 30 });
    const text = { ...createElement('text', doc), x: 5, y: 10, w: 40, h: 10, autoFit: false, fontSize: 20 } as TextElement;
    const dot = { ...createElement('ellipse', doc), x: 0, y: 0, w: 4, h: 4 };
    const [t, d] = turnPatch({ ...doc, elements: [text, dot] }).elements;
    // 40 mm wide on a 30 mm artboard: three quarters the size, centred where it was.
    expect([t.x, t.y, t.w, t.h, (t as TextElement).fontSize]).toEqual([0, 21.3, 30, 7.5, 15]);
    expect([d.x, d.y, d.w, d.h]).toEqual([0, 1.3, 4, 4]);
  });

  it('applies paper sizes to a landscape artboard turned, and ends landscape for cable and flag sizes', () => {
    expect(onPaper({ widthMm: 40, heightMm: 12 }, true)).toEqual({ widthMm: 12, heightMm: 40 });
    expect(onPaper({ heightMm: 70 }, true)).toEqual({ widthMm: 70 });
    expect(onPaper({ widthMm: 40, heightMm: 12 }, false)).toEqual({ widthMm: 40, heightMm: 12 });
    expect(onPaper({ widthMm: 109, heightMm: 12.5, tailMm: 35 }, true)).toEqual({ widthMm: 109, heightMm: 12.5, tailMm: 35, landscape: undefined });
  });

  it('opens landscape labels, but never a landscape cable or flag label', () => {
    const doc = { ...createDoc({ widthMm: 12, heightMm: 40 }), landscape: true as const };
    expect(parseDoc(JSON.parse(serializeDoc(doc))).landscape).toBe(true);
    expect(parseDoc({ ...doc, landscape: 'yes' })).not.toHaveProperty('landscape');
    expect(parseDoc({ ...doc, tailMm: 5 })).not.toHaveProperty('landscape');
    expect(parseDoc({ ...doc, fold: 'copy' })).not.toHaveProperty('landscape');
  });
});
