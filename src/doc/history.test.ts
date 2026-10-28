import { editorReducer, initialState } from './history';
import { createDoc, createElement } from './model';

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
});
