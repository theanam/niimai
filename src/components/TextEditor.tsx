import { useLayoutEffect, useRef } from 'react';
import type { TextElement } from '../doc/model';
import { fitFontSize, LINE_HEIGHT } from '../render/svg';

interface Props {
  el: TextElement;
  /** Screen pixels per millimetre. */
  zoom: number;
  /** Select all text on open, for freshly added elements. */
  selectAll: boolean;
  onChange: (text: string) => void;
  onDone: () => void;
}

/**
 * A textarea laid exactly over a text element, in the element's own font,
 * size, alignment and rotation, so typing happens on the label itself.
 */
export function TextEditor({ el, zoom, selectAll, onChange, onDone }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    if (selectAll) ta.select();
    else ta.setSelectionRange(ta.value.length, ta.value.length);
    // Only on open: re-running would move the caret on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size = fitFontSize(el) * zoom;
  const lines = Math.max(1, el.text.split('\n').length);
  const height = lines * size * LINE_HEIGHT;

  return (
    <div
      className="text-editor"
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.w * zoom,
        height: el.h * zoom,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        aria-label="Edit text"
        value={el.text}
        spellCheck={false}
        wrap="off"
        style={{
          top: (el.h * zoom - height) / 2,
          height,
          fontFamily: `'${el.fontFamily}', sans-serif`,
          fontSize: size,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : 'normal',
          lineHeight: LINE_HEIGHT,
          textAlign: el.align,
        }}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onDone}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            e.stopPropagation();
            onDone();
          }
        }}
      />
    </div>
  );
}
