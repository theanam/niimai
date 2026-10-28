import { useCallback, useMemo, useReducer } from 'react';
import { round1, uid } from '../lib/units';
import { editorReducer, initialState } from './history';
import { createDoc, createElement, type ElementType, type LabelDoc, type LabelElement } from './model';

export function useEditor(initial: LabelDoc = createDoc()) {
  const [state, dispatch] = useReducer(editorReducer, initial, initialState);
  const selected = useMemo(
    () => state.doc.elements.find((e) => e.id === state.selectedId) ?? null,
    [state.doc.elements, state.selectedId],
  );

  const add = useCallback(
    (type: ElementType, extra?: Partial<LabelElement>) => {
      const element = createElement(type, state.doc, extra);
      dispatch({ type: 'add', element });
      return element;
    },
    [state.doc],
  );

  const update = useCallback(
    (id: string, patch: Partial<LabelElement>, key?: string) => dispatch({ type: 'update', id, patch, key }),
    [],
  );

  /** A copy offset by 1 mm, selected. */
  const duplicate = useCallback((el: LabelElement) => {
    dispatch({ type: 'add', element: { ...el, id: uid(), x: round1(el.x + 1), y: round1(el.y + 1) } });
  }, []);

  return { state, dispatch, selected, add, update, duplicate };
}

export type Editor = ReturnType<typeof useEditor>;
