import { fitFontSize } from '../render/svg';
import { MM_PER_PT } from '../lib/units';
import { HUGS, tighten } from './bounds';
import type { LabelDoc, LabelElement } from './model';

export interface EditorState {
  doc: LabelDoc;
  /** Every selected element, in the order they were picked. */
  selectedIds: string[];
  /** The selected element when exactly one is selected, else null. */
  selectedId: string | null;
  past: LabelDoc[];
  future: LabelDoc[];
  /** Coalesces rapid edits of the same kind (dragging, typing) into one undo step. */
  lastKey: string | null;
}

export type EditorAction =
  | { type: 'load'; doc: LabelDoc }
  | { type: 'select'; id: string | null }
  | { type: 'selectMany'; ids: string[] }
  /** Adds the element to the selection, or takes it out. */
  | { type: 'toggleSelect'; id: string }
  | { type: 'add'; element: LabelElement }
  | { type: 'addMany'; elements: LabelElement[] }
  | { type: 'update'; id: string; patch: Partial<LabelElement>; key?: string }
  /** Several elements at once, as one step: moving or aligning a selection. */
  | { type: 'updateMany'; patches: Record<string, Partial<LabelElement>>; key?: string }
  | { type: 'remove'; id: string }
  | { type: 'removeMany'; ids: string[] }
  | { type: 'reorder'; id: string; direction: 'up' | 'down' }
  | { type: 'setDoc'; patch: Partial<Pick<LabelDoc, 'name' | 'widthMm' | 'heightMm' | 'tailMm' | 'fold' | 'landscape' | 'paper' | 'sheet' | 'sequence' | 'elements'>> }
  /** Facts about the label (its file, its printer) that undo leaves alone. */
  | { type: 'meta'; patch: Partial<Pick<LabelDoc, 'name' | 'fileName' | 'printer'>> }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_LIMIT = 100;

export const initialState = (doc: LabelDoc): EditorState => ({
  doc,
  selectedIds: [],
  selectedId: null,
  past: [],
  future: [],
  lastKey: null,
});

function push(state: EditorState, doc: LabelDoc, key: string | null = null): EditorState {
  const coalesce = key !== null && key === state.lastKey;
  return {
    ...state,
    doc: { ...doc, updatedAt: Date.now() },
    past: coalesce ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
    lastKey: key,
  };
}

const selection = (ids: string[]) => ({ selectedIds: ids, selectedId: ids.length === 1 ? ids[0] : null });

const GEOMETRY = ['x', 'y', 'w', 'h'] as const;

/**
 * Applies an edit to an element whose box hugs what it draws. Edits that
 * place the box (moving, resizing) are taken as they are. Any other edit
 * starts from the hugging box and ends with one: text keeps its size while
 * its words or font change, and a barcode keeps its height while its value
 * changes.
 */
export function hugEdit(el: LabelElement, patch: Partial<LabelElement>): LabelElement {
  const merged = { ...el, ...patch } as LabelElement;
  if (!HUGS.has(el.type)) return merged;
  // Placed boxes are measured around what is drawn, which for an icon is its artwork alone.
  if (GEOMETRY.some((k) => k in patch)) {
    const placed = el.type === 'icon' && 'w' in patch && 'h' in patch && !('viewBox' in patch);
    return placed ? ({ ...merged, viewBox: tighten(el).viewBox } as LabelElement) : merged;
  }
  const base = tighten(el);
  // A new icon (or weight) shows its whole artwork again.
  const next = { ...base, ...patch, ...(base.type === 'icon' && 'body' in patch ? { viewBox: undefined } : {}) } as LabelElement;
  if (next.type === 'text' && base.type === 'text') {
    const size = fitFontSize(base) / MM_PER_PT;
    if (next.autoFit) {
      // Measured at the size it drew at, so the words stay that size.
      const fixed = tighten({ ...next, autoFit: false, fontSize: size });
      return { ...fixed, autoFit: true, fontSize: next.fontSize };
    }
    // Turning fitting off keeps the size the text had.
    if (base.autoFit && !('fontSize' in patch)) return tighten({ ...next, fontSize: Math.round(size * 10) / 10 });
    return tighten(next);
  }
  if (next.type === 'barcode') {
    // Fitted into a very wide box, the code keeps its height and grows sideways from the middle.
    const wide = tighten({ ...next, x: base.x + base.w / 2 - base.w * 50, w: base.w * 100 });
    if (wide.w < base.w * 50) return wide;
  }
  return tighten(next);
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { doc } = state;
  switch (action.type) {
    case 'load':
      return initialState(action.doc);
    case 'select':
      return { ...state, ...selection(action.id ? [action.id] : []), lastKey: null };
    case 'selectMany':
      return { ...state, ...selection(action.ids.filter((id) => doc.elements.some((e) => e.id === id))), lastKey: null };
    case 'toggleSelect': {
      const has = state.selectedIds.includes(action.id);
      return { ...state, ...selection(has ? state.selectedIds.filter((id) => id !== action.id) : [...state.selectedIds, action.id]), lastKey: null };
    }
    case 'add':
    case 'addMany': {
      const added = (action.type === 'add' ? [action.element] : action.elements).map((e) => tighten(e));
      // Frames go behind everything so they never cover what they surround.
      const frames = added.filter((e) => e.type === 'frame');
      const rest = added.filter((e) => e.type !== 'frame');
      return {
        ...push(state, { ...doc, elements: [...frames, ...doc.elements, ...rest] }),
        ...selection(added.map((e) => e.id)),
      };
    }
    case 'update': {
      if (!doc.elements.some((e) => e.id === action.id)) return state;
      const elements = doc.elements.map((e) => (e.id === action.id ? hugEdit(e, action.patch) : e));
      return push(state, { ...doc, elements }, action.key ? `${action.id}:${action.key}` : null);
    }
    case 'updateMany': {
      const ids = Object.keys(action.patches);
      if (!ids.length) return state;
      const elements = doc.elements.map((e) => (action.patches[e.id] ? ({ ...e, ...action.patches[e.id] } as LabelElement) : e));
      return push(state, { ...doc, elements }, action.key ? `${ids.sort().join(',')}:${action.key}` : null);
    }
    case 'remove':
    case 'removeMany': {
      const gone = action.type === 'remove' ? [action.id] : action.ids;
      return {
        ...push(state, { ...doc, elements: doc.elements.filter((e) => !gone.includes(e.id)) }),
        ...selection(state.selectedIds.filter((id) => !gone.includes(id))),
      };
    }
    case 'reorder': {
      const i = doc.elements.findIndex((e) => e.id === action.id);
      const j = action.direction === 'up' ? i + 1 : i - 1;
      if (i < 0 || j < 0 || j >= doc.elements.length) return state;
      const elements = [...doc.elements];
      [elements[i], elements[j]] = [elements[j], elements[i]];
      return push(state, { ...doc, elements });
    }
    case 'setDoc':
      return push(state, { ...doc, ...action.patch }, `doc:${Object.keys(action.patch).join(',')}`);
    case 'meta': {
      const apply = (d: LabelDoc) => ({ ...d, ...action.patch });
      return { ...state, doc: apply(doc), past: state.past.map(apply), future: state.future.map(apply) };
    }
    case 'commit':
      return { ...state, lastKey: null };
    case 'undo': {
      const prev = state.past.at(-1);
      if (!prev) return state;
      return { ...state, doc: prev, past: state.past.slice(0, -1), future: [state.doc, ...state.future], lastKey: null, ...kept(state, prev) };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return { ...state, doc: next, past: [...state.past, state.doc], future: state.future.slice(1), lastKey: null, ...kept(state, next) };
    }
  }
}

/** The selection, less elements the other version of the label does not have. */
const kept = (state: EditorState, doc: LabelDoc) => selection(state.selectedIds.filter((id) => doc.elements.some((e) => e.id === id)));
