import { editorReducer, initialState } from './history';
import { createDoc, createElement, parseDoc } from './model';

const setup = () => {
  const doc = createDoc();
  const el = createElement('rect', doc);
  const s = editorReducer(initialState(doc), { type: 'add', element: el });
  return { s, el };
};

describe('editor history', () => {
  it('adds and selects an element', () => {
    const { s, el } = setup();
    expect(s.doc.elements).toHaveLength(1);
    expect(s.selectedId).toBe(el.id);
  });

  it('puts new frames behind everything else', () => {
    const { s, el } = setup();
    const frame = createElement('frame', s.doc);
    const next = editorReducer(s, { type: 'add', element: frame });
    expect(next.doc.elements.map((e) => e.id)).toEqual([frame.id, el.id]);
    expect(next.selectedId).toBe(frame.id);
  });

  it('undoes and redoes', () => {
    const { s } = setup();
    const undone = editorReducer(s, { type: 'undo' });
    expect(undone.doc.elements).toHaveLength(0);
    const redone = editorReducer(undone, { type: 'redo' });
    expect(redone.doc.elements).toHaveLength(1);
  });

  it('coalesces repeated edits with the same key into one undo step', () => {
    let { s, el } = setup();
    s = editorReducer(s, { type: 'update', id: el.id, patch: { x: 1 }, key: 'move' });
    s = editorReducer(s, { type: 'update', id: el.id, patch: { x: 2 }, key: 'move' });
    s = editorReducer(s, { type: 'update', id: el.id, patch: { x: 3 }, key: 'move' });
    s = editorReducer(s, { type: 'undo' });
    expect(s.doc.elements[0].x).toBe(el.x);
  });

  it('starts a new undo step after commit', () => {
    let { s, el } = setup();
    s = editorReducer(s, { type: 'update', id: el.id, patch: { x: 1 }, key: 'move' });
    s = editorReducer(s, { type: 'commit' });
    s = editorReducer(s, { type: 'update', id: el.id, patch: { x: 2 }, key: 'move' });
    s = editorReducer(s, { type: 'undo' });
    expect(s.doc.elements[0].x).toBe(1);
  });

  it('removes and clears the selection', () => {
    const { s, el } = setup();
    const r = editorReducer(s, { type: 'remove', id: el.id });
    expect(r.doc.elements).toHaveLength(0);
    expect(r.selectedId).toBeNull();
  });

  it('reorders layers and ignores moves past the ends', () => {
    let { s, el } = setup();
    const b = createElement('qr', s.doc);
    s = editorReducer(s, { type: 'add', element: b });
    s = editorReducer(s, { type: 'reorder', id: el.id, direction: 'up' });
    expect(s.doc.elements.map((e) => e.id)).toEqual([b.id, el.id]);
    expect(editorReducer(s, { type: 'reorder', id: el.id, direction: 'up' })).toBe(s);
  });

  it('ignores updates to missing elements', () => {
    const { s } = setup();
    expect(editorReducer(s, { type: 'update', id: 'nope', patch: { x: 1 } })).toBe(s);
  });

  it('changes label size as an undoable step', () => {
    let { s } = setup();
    s = editorReducer(s, { type: 'setDoc', patch: { widthMm: 50 } });
    expect(s.doc.widthMm).toBe(50);
    expect(editorReducer(s, { type: 'undo' }).doc.widthMm).toBe(40);
  });

  it('records file facts on every step, so undo keeps them', () => {
    let s = initialState(createDoc());
    s = editorReducer(s, { type: 'setDoc', patch: { widthMm: 50 } });
    s = editorReducer(s, { type: 'meta', patch: { name: 'Jars', fileName: 'Jars', printer: 'D110' } });
    expect(s.past).toHaveLength(1);
    s = editorReducer(s, { type: 'undo' });
    expect(s.doc).toMatchObject({ name: 'Jars', fileName: 'Jars', printer: 'D110' });
    s = editorReducer(s, { type: 'redo' });
    expect(s.doc).toMatchObject({ widthMm: 50, fileName: 'Jars' });
  });

  it('selects several elements, adding and taking out one at a time', () => {
    const { s, el } = setup();
    const other = createElement('ellipse', s.doc);
    let next = editorReducer(s, { type: 'add', element: other });
    next = editorReducer(next, { type: 'toggleSelect', id: el.id });
    expect(next.selectedIds).toEqual([other.id, el.id]);
    expect(next.selectedId).toBeNull();
    next = editorReducer(next, { type: 'toggleSelect', id: other.id });
    expect(next.selectedId).toBe(el.id);
  });

  it('moves, removes and adds several elements as one undo step each', () => {
    const { s, el } = setup();
    const other = createElement('ellipse', s.doc);
    let next = editorReducer(s, { type: 'add', element: other });
    next = editorReducer(next, { type: 'updateMany', patches: { [el.id]: { x: 1 }, [other.id]: { x: 2 } } });
    expect(next.doc.elements.map((e) => e.x)).toEqual([1, 2]);
    expect(editorReducer(next, { type: 'undo' }).doc.elements.map((e) => e.x)).toEqual([el.x, other.x]);
    next = editorReducer(next, { type: 'selectMany', ids: [el.id, other.id] });
    next = editorReducer(next, { type: 'removeMany', ids: [el.id, other.id] });
    expect(next.doc.elements).toHaveLength(0);
    expect(next.selectedIds).toEqual([]);
    next = editorReducer(next, { type: 'addMany', elements: [el, other] });
    expect(next.selectedIds).toEqual([el.id, other.id]);
  });

  it('drops elements that undo takes away from the selection', () => {
    const { s } = setup();
    const undone = editorReducer(s, { type: 'undo' });
    expect(undone.selectedIds).toEqual([]);
    expect(undone.selectedId).toBeNull();
  });

  describe('groups and locks', () => {
    const three = () => {
      const doc = createDoc();
      const [a, b, c] = [createElement('rect', doc), createElement('ellipse', doc), createElement('line', doc)];
      const s = editorReducer(initialState(doc), { type: 'addMany', elements: [a, b, c] });
      return { s, a, b, c };
    };

    it('picks and toggles a whole group, and one member alone on request', () => {
      const { s, a, b, c } = three();
      const g = editorReducer(s, { type: 'group', ids: [a.id, b.id] });
      expect(g.doc.elements.find((e) => e.id === a.id)?.group).toBeDefined();
      expect(g.doc.elements.find((e) => e.id === a.id)?.group).toBe(g.doc.elements.find((e) => e.id === b.id)?.group);
      expect(g.doc.elements.find((e) => e.id === c.id)?.group).toBeUndefined();
      expect(editorReducer(g, { type: 'select', id: a.id }).selectedIds.sort()).toEqual([a.id, b.id].sort());
      expect(editorReducer(g, { type: 'select', id: a.id, alone: true }).selectedIds).toEqual([a.id]);
      const toggled = editorReducer(editorReducer(g, { type: 'select', id: c.id }), { type: 'toggleSelect', id: b.id });
      expect(toggled.selectedIds.sort()).toEqual([a.id, b.id, c.id].sort());
      expect(editorReducer(toggled, { type: 'toggleSelect', id: a.id }).selectedIds).toEqual([c.id]);
      // Undo takes the group away again.
      expect(editorReducer(g, { type: 'undo' }).doc.elements.some((e) => e.group)).toBe(false);
    });

    it('takes groups apart and needs two elements to make one', () => {
      const { s, a, b } = three();
      expect(editorReducer(s, { type: 'group', ids: [a.id] })).toBe(s);
      const g = editorReducer(s, { type: 'group', ids: [a.id, b.id] });
      const u = editorReducer(g, { type: 'ungroup', ids: [a.id] });
      expect(u.doc.elements.some((e) => e.group)).toBe(false);
      expect(editorReducer(u, { type: 'select', id: a.id }).selectedIds).toEqual([a.id]);
    });

    it('locks elements out of the selection, keeps them out of their group, and unlocks them', () => {
      const { s, a, b } = three();
      const g = editorReducer(editorReducer(s, { type: 'group', ids: [a.id, b.id] }), { type: 'selectMany', ids: [a.id, b.id] });
      const l = editorReducer(g, { type: 'lock', ids: [b.id], locked: true });
      expect(l.doc.elements.find((e) => e.id === b.id)?.locked).toBe(true);
      expect(l.selectedIds).toEqual([a.id]);
      expect(editorReducer(l, { type: 'select', id: a.id }).selectedIds).toEqual([a.id]);
      const open = editorReducer(l, { type: 'lock', ids: [b.id], locked: false });
      expect('locked' in open.doc.elements.find((e) => e.id === b.id)!).toBe(false);
    });

    it('keeps groups and locks in saved files, and drops broken values', () => {
      const doc = createDoc();
      const raw = JSON.parse(JSON.stringify({ ...doc, elements: [{ ...createElement('rect', doc), group: 'g1', locked: true }, { ...createElement('rect', doc), group: 5, locked: 'yes' }] }));
      const [kept, dropped] = parseDoc(raw).elements;
      expect(kept).toMatchObject({ group: 'g1', locked: true });
      expect('group' in dropped || 'locked' in dropped).toBe(false);
    });
  });
});
