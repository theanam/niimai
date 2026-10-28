import type { LabelDoc, LabelElement } from './model';

export interface EditorState {
  doc: LabelDoc;
  selectedId: string | null;
  past: LabelDoc[];
  future: LabelDoc[];
  /** Coalesces rapid edits of the same kind (dragging, typing) into one undo step. */
  lastKey: string | null;
}

export type EditorAction =
  | { type: 'load'; doc: LabelDoc }
  | { type: 'select'; id: string | null }
  | { type: 'add'; element: LabelElement }
  | { type: 'update'; id: string; patch: Partial<LabelElement>; key?: string }
  | { type: 'remove'; id: string }
  | { type: 'reorder'; id: string; direction: 'up' | 'down' }
  | { type: 'setDoc'; patch: Partial<Pick<LabelDoc, 'name' | 'widthMm' | 'heightMm' | 'tailMm' | 'fold' | 'paper'>> }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_LIMIT = 100;

export const initialState = (doc: LabelDoc): EditorState => ({
  doc,
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

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { doc } = state;
  switch (action.type) {
    case 'load':
      return initialState(action.doc);
    case 'select':
      return { ...state, selectedId: action.id, lastKey: null };
    case 'add':
      // Frames go behind everything so they never cover what they surround.
      return {
        ...push(state, { ...doc, elements: action.element.type === 'frame' ? [action.element, ...doc.elements] : [...doc.elements, action.element] }),
        selectedId: action.element.id,
      };
    case 'update': {
      if (!doc.elements.some((e) => e.id === action.id)) return state;
      const elements = doc.elements.map((e) => (e.id === action.id ? ({ ...e, ...action.patch } as LabelElement) : e));
      return push(state, { ...doc, elements }, action.key ? `${action.id}:${action.key}` : null);
    }
    case 'remove':
      return {
        ...push(state, { ...doc, elements: doc.elements.filter((e) => e.id !== action.id) }),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
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
    case 'commit':
      return { ...state, lastKey: null };
    case 'undo': {
      const prev = state.past.at(-1);
      if (!prev) return state;
      return { ...state, doc: prev, past: state.past.slice(0, -1), future: [state.doc, ...state.future], lastKey: null };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return { ...state, doc: next, past: [...state.past, state.doc], future: state.future.slice(1), lastKey: null };
    }
  }
}
