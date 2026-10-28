import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { EditorAction } from '../doc/history';
import { flagWidth, isMirrored, printableArea, sizeLabel, type LabelDoc, type LabelElement } from '../doc/model';
import { HANDLES, resizeBox, snapBox, type Guide, type Handle } from '../doc/snap';
import { round1 } from '../lib/units';
import { elementSvg, mirroredSvg } from '../render/svg';
import { TextEditor } from './TextEditor';

interface Props {
  doc: LabelDoc;
  selectedId: string | null;
  dispatch: (a: EditorAction) => void;
  images: Record<string, string>;
  /** 1-bit preview image; when set, the canvas shows it and editing pauses. */
  preview: string | null;
  /** Bumped when web fonts finish loading, so auto-fit text re-measures. */
  fontsVersion: number;
  /** The text element being edited in place, if any. */
  editingId: string | null;
  /** True when the edit began by adding the element, so its placeholder text is selected. */
  editingFresh: boolean;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
}

type Drag =
  | { kind: 'move'; id: string; startX: number; startY: number; el: LabelElement; moved: boolean }
  | { kind: 'resize'; id: string; handle: Handle; startX: number; startY: number; el: LabelElement };

const PADDING = 48;
const SNAP_PX = 6;

export function Canvas({ doc, selectedId, dispatch, images, preview, fontsVersion, editingId, editingFresh, onEditStart, onEditEnd }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(10);
  const [guides, setGuides] = useState<Guide[]>([]);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const { clientWidth: cw, clientHeight: ch } = wrap;
      if (!cw || !ch) return;
      setZoom(Math.max(1, Math.min((cw - PADDING * 2) / doc.widthMm, (ch - PADDING * 2) / doc.heightMm)));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(wrap);
    return () => ro?.disconnect();
  }, [doc.widthMm, doc.heightMm]);

  /** Pointer position in label millimetres. */
  const toMm = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0];
    return [(e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom];
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const [mx, my] = toMm(e);
      const dx = mx - d.startX;
      const dy = my - d.startY;
      if (d.kind === 'move') {
        if (!d.moved && Math.hypot(dx, dy) * zoom < 2) return;
        d.moved = true;
        const others = doc.elements.filter((o) => o.id !== d.id);
        const box = { x: d.el.x + dx, y: d.el.y + dy, w: d.el.w, h: d.el.h };
        const snapped = e.altKey ? { ...box, guides: [] } : snapBox(box, printableArea(doc), others, SNAP_PX / zoom, foldGuides(doc));
        setGuides(snapped.guides);
        dispatch({ type: 'update', id: d.id, patch: { x: round1(snapped.x), y: round1(snapped.y) }, key: 'move' });
      } else {
        const keep = e.shiftKey || d.el.type === 'qr';
        const box = resizeBox(d.el, d.handle, dx, dy, keep);
        dispatch({
          type: 'update',
          id: d.id,
          patch: { x: round1(box.x), y: round1(box.y), w: round1(box.w), h: round1(box.h) },
          key: 'resize',
        });
      }
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      setGuides([]);
      dispatch({ type: 'commit' });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const startMove = (e: RPointerEvent, el: LabelElement) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const [x, y] = toMm(e);
    dispatch({ type: 'select', id: el.id });
    drag.current = { kind: 'move', id: el.id, startX: x, startY: y, el, moved: false };
  };

  const startResize = (e: RPointerEvent, el: LabelElement, handle: Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const [x, y] = toMm(e);
    drag.current = { kind: 'resize', id: el.id, handle, startX: x, startY: y, el };
  };

  const selected = preview ? null : doc.elements.find((e) => e.id === selectedId);
  const editing = preview ? undefined : doc.elements.find((e) => e.id === editingId && e.type === 'text');
  // Fingers need bigger targets than a mouse pointer.
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const handleSize = (coarse ? 18 : 8) / zoom;

  return (
    <div className="canvas-wrap" ref={wrapRef} onPointerDown={() => dispatch({ type: 'select', id: null })}>
      <div className="canvas-paper" style={{ width: doc.widthMm * zoom, height: doc.heightMm * zoom }}>
        {preview ? (
          <img className="canvas-preview" src={preview} alt="Print preview" draggable={false} />
        ) : (
          <svg
            ref={svgRef}
            className="canvas-svg"
            data-fonts={fontsVersion}
            width={doc.widthMm * zoom}
            height={doc.heightMm * zoom}
            viewBox={`0 0 ${doc.widthMm} ${doc.heightMm}`}
            role="img"
            aria-label={`${doc.name}, ${doc.widthMm} × ${doc.heightMm} mm`}
          >
            <rect width={doc.widthMm} height={doc.heightMm} fill="#fff" />
            {doc.elements.map((el) => (
              <g
                key={el.id}
                data-id={el.id}
                className="canvas-el"
                onPointerDown={(e) => startMove(e, el)}
                onDoubleClick={() => el.type === 'text' && onEditStart(el.id)}
                // The element being edited is drawn by the textarea on top, so it is left out here.
                dangerouslySetInnerHTML={{ __html: (el.id === editingId ? '' : elementSvg(el, { images })) + hitArea(el) }}
              />
            ))}
            {isMirrored(doc) && (
              <g className="mirror-preview" aria-hidden="true">
                <g dangerouslySetInnerHTML={{ __html: mirroredSvg(doc, { images }) }} />
                <rect x={flagWidth(doc) / 2} width={flagWidth(doc) / 2} height={doc.heightMm} />
              </g>
            )}
            {!!doc.fold && (
              <line
                className="fold-line"
                x1={flagWidth(doc) / 2}
                x2={flagWidth(doc) / 2}
                y1={-1.5}
                y2={doc.heightMm + 1.5}
                strokeWidth={1.2 / zoom}
                strokeDasharray={`${4 / zoom} ${3 / zoom}`}
              />
            )}
            {!!doc.tailMm && (
              <g className="tail-zone" aria-hidden="true">
                <defs>
                  <pattern id="tail-hatch" width={1.6} height={1.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width={0.5} height={1.6} />
                  </pattern>
                </defs>
                <rect x={doc.widthMm - doc.tailMm} width={doc.tailMm} height={doc.heightMm} fill="url(#tail-hatch)" />
                <line x1={doc.widthMm - doc.tailMm} x2={doc.widthMm - doc.tailMm} y1={0} y2={doc.heightMm} strokeWidth={1 / zoom} />
              </g>
            )}
            {guides.map((g, i) =>
              g.axis === 'x' ? (
                <line key={i} className="guide" x1={g.at} x2={g.at} y1={-100} y2={doc.heightMm + 100} strokeWidth={1 / zoom} />
              ) : (
                <line key={i} className="guide" y1={g.at} y2={g.at} x1={-100} x2={doc.widthMm + 100} strokeWidth={1 / zoom} />
              ),
            )}
            {selected && (
              <g transform={`rotate(${selected.rotation} ${selected.x + selected.w / 2} ${selected.y + selected.h / 2})`}>
                <rect
                  className="selection"
                  x={selected.x}
                  y={selected.y}
                  width={selected.w}
                  height={selected.h}
                  strokeWidth={1.5 / zoom}
                  onPointerDown={(e) => startMove(e, selected)}
                />
                {HANDLES.map((h) => {
                  const hx = selected.x + (h.includes('e') ? selected.w : h.includes('w') ? 0 : selected.w / 2);
                  const hy = selected.y + (h.includes('s') ? selected.h : h.includes('n') ? 0 : selected.h / 2);
                  return (
                    <rect
                      key={h}
                      className={`handle handle-${h}`}
                      data-handle={h}
                      x={hx - handleSize / 2}
                      y={hy - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      strokeWidth={1 / zoom}
                      onPointerDown={(e) => startResize(e, selected, h)}
                    />
                  );
                })}
              </g>
            )}
          </svg>
        )}
        {editing?.type === 'text' && (
          <TextEditor
            key={editing.id}
            el={editing}
            zoom={zoom}
            selectAll={editingFresh}
            onChange={(text) => dispatch({ type: 'update', id: editing.id, patch: { text }, key: 'text' })}
            onDone={onEditEnd}
          />
        )}
      </div>
      <div className="canvas-size" aria-hidden="true">
        {sizeLabel(doc)} mm{isMirrored(doc) ? ' · mirrored' : ''}{doc.tailMm ? ' · tail blank' : ''}
      </div>
    </div>
  );
}

/**
 * With separate halves, each half acts like its own label: its edges and
 * centre snap too.
 */
function foldGuides(doc: LabelDoc): number[] {
  if (doc.fold !== 'none') return [];
  const half = flagWidth(doc) / 2;
  return [half / 2, half, half * 1.5];
}

/** An invisible box so thin lines and empty shapes are easy to grab. */
function hitArea(el: LabelElement): string {
  const pad = el.type === 'line' ? 1 : 0;
  const t = el.rotation ? ` transform="rotate(${el.rotation} ${el.x + el.w / 2} ${el.y + el.h / 2})"` : '';
  return `<rect x="${el.x - pad}" y="${el.y - pad}" width="${el.w + pad * 2}" height="${el.h + pad * 2}" fill="transparent"${t}/>`;
}
