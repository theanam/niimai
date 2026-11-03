import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { EditorAction } from '../doc/history';
import { flagWidth, isMirrored, printableArea, sizeLabel, type LabelDoc, type LabelElement } from '../doc/model';
import { HANDLES, resizeBox, snapBox, type Guide, type Handle } from '../doc/snap';
import { coverBox, HUGS, placePatch, tighten, unionBox, type Box } from '../doc/bounds';
import { onImageAspect } from '../render/imageAspect';
import { round1 } from '../lib/units';
import { elementSvg, mirroredSvg } from '../render/svg';
import type { Area } from '../printer/safeArea';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { shortcutLabel } from '../shortcuts/shortcuts';
import { IconButton } from '../ui/IconButton';
import { TextEditor } from './TextEditor';
import { RasterImage } from '../ui/RasterImage';

interface Props {
  doc: LabelDoc;
  /** Every selected element; one shows handles, several show the box around them. */
  selectedIds: string[];
  dispatch: (a: EditorAction) => void;
  images: Record<string, string>;
  /** 1-bit preview image; when set, the canvas shows it and editing pauses. */
  preview: string | null;
  /** Bumped when web fonts finish loading, so auto-fit text re-measures. */
  fontsVersion: number;
  /** The text element being edited in place, if any. */
  editingId: string | null;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
  /** What the connected printer's head reaches; null when it reaches the whole label. */
  safeArea?: Area | null;
  /** Elements with details too fine for the printer, by id. */
  issues?: Record<string, string>;
  /** Screen pixels per millimetre; null fits the label to the view. */
  zoomLevel?: number | null;
  onZoomChange?: (zoom: number | null) => void;
  /** A zoom step asked for by keyboard; the counter makes repeats count. */
  zoomRequest?: { dir: 'in' | 'out' | 'fit'; n: number } | null;
  /** Draws an element as the shown record prints it: dynamic fields filled in. */
  resolve?: (el: LabelElement) => LabelElement;
  /** The sheet row on show, for labels that print one per row. */
  record?: { index: number; count: number; onChange: (index: number) => void } | null;
}

type Drag =
  | { kind: 'move'; id: string; ids: string[]; startX: number; startY: number; els: LabelElement[]; box: Box; moved: boolean }
  | { kind: 'resize'; id: string; handle: Handle; startX: number; startY: number; el: LabelElement }
  | { kind: 'marquee'; startX: number; startY: number; x: number; y: number; base: string[] };

/** Corner handles only for elements that keep their proportions. */
const CORNERS: Handle[] = ['nw', 'ne', 'se', 'sw'];

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const PADDING = 48;
const SNAP_PX = 6;
/** Screen pixels per millimetre at true size (96 CSS pixels to the inch). */
const PX_PER_MM = 96 / 25.4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 60;
const ZOOM_STEP = 1.25;

/** The zoom one step in or out from the current one. */
export const stepZoom = (zoom: number, dir: 'in' | 'out'): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, dir === 'in' ? zoom * ZOOM_STEP : zoom / ZOOM_STEP));

export function Canvas({ doc, selectedIds, dispatch, images, preview, fontsVersion, editingId, onEditStart, onEditEnd, safeArea = null, issues = {}, zoomLevel = null, onZoomChange, zoomRequest = null, resolve = (el) => el, record = null }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [fitZoom, setFitZoom] = useState(10);
  const zoom = zoomLevel ?? fitZoom;
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const drag = useRef<Drag | null>(null);
  // Picture boxes hug the picture once its proportions are known.
  const [, setAspects] = useState(0);
  useEffect(() => onImageAspect(() => setAspects((n) => n + 1)), []);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const { clientWidth: cw, clientHeight: ch } = wrap;
      if (!cw || !ch) return;
      setFitZoom(Math.max(MIN_ZOOM, Math.min((cw - PADDING * 2) / doc.widthMm, (ch - PADDING * 2) / doc.heightMm)));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(wrap);
    return () => ro?.disconnect();
  }, [doc.widthMm, doc.heightMm]);

  useEffect(() => {
    if (!zoomRequest || !onZoomChange) return;
    onZoomChange(zoomRequest.dir === 'fit' ? null : stepZoom(zoom, zoomRequest.dir));
    // Only a new request steps; the zoom it starts from is read as it is now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRequest]);

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
      if (d.kind === 'marquee') {
        d.x = mx;
        d.y = my;
        const box = { x: Math.min(d.startX, mx), y: Math.min(d.startY, my), w: Math.abs(dx), h: Math.abs(dy) };
        if (Math.hypot(dx, dy) * zoom < 3) return;
        setMarquee(box);
        const hits = doc.elements.filter((el) => overlaps(coverBox(el), box)).map((el) => el.id);
        dispatch({ type: 'selectMany', ids: [...new Set([...d.base, ...hits])] });
      } else if (d.kind === 'move') {
        if (!d.moved && Math.hypot(dx, dy) * zoom < 2) return;
        d.moved = true;
        // The selection snaps as one box to the label and to everything else.
        const others = doc.elements.filter((o) => !d.ids.includes(o.id)).map(snapTarget);
        const box = { ...d.box, x: d.box.x + dx, y: d.box.y + dy };
        const snapped = e.altKey ? { ...box, guides: [] } : snapBox(box, printableArea(doc), others, SNAP_PX / zoom, foldGuides(doc));
        setGuides(snapped.guides);
        const [mx2, my2] = [snapped.x - d.box.x, snapped.y - d.box.y];
        const step = (v: number) => Math.round(v * 1000) / 1000;
        dispatch({ type: 'updateMany', patches: Object.fromEntries(d.els.map((el) => [el.id, { x: step(el.x + mx2), y: step(el.y + my2) }])), key: 'move' });
      } else if (HUGS.has(d.el.type)) {
        // Starts from the hugging box, so the handles sit on what is drawn and proportions hold.
        const box = resizeBox(d.el, d.handle, dx, dy, true);
        dispatch({ type: 'update', id: d.id, patch: placePatch(d.el, box), key: 'resize' });
      } else {
        const box = resizeBox(d.el, d.handle, dx, dy, e.shiftKey);
        dispatch({
          type: 'update',
          id: d.id,
          patch: { x: round1(box.x), y: round1(box.y), w: round1(box.w), h: round1(box.h) },
          key: 'resize',
        });
      }
    };
    const onUp = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      // A click without a drag on one of several selected elements picks it alone.
      if (d.kind === 'move' && !d.moved && d.ids.length > 1) dispatch({ type: 'select', id: d.id });
      setGuides([]);
      setMarquee(null);
      dispatch({ type: 'commit' });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  /** Shift-click adds to the selection or takes out; a plain press on a selected element drags the whole selection. */
  const startMove = (e: RPointerEvent, el: LabelElement) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      dispatch({ type: 'toggleSelect', id: el.id });
      return;
    }
    const [x, y] = toMm(e);
    const ids = selectedIds.includes(el.id) ? selectedIds : [el.id];
    if (ids !== selectedIds) dispatch({ type: 'select', id: el.id });
    const els = doc.elements.filter((o) => ids.includes(o.id));
    drag.current = { kind: 'move', id: el.id, ids, startX: x, startY: y, els, box: unionBox(els.map((o) => coverBox(o))), moved: false };
  };

  const startResize = (e: RPointerEvent, el: LabelElement, handle: Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const [x, y] = toMm(e);
    drag.current = { kind: 'resize', id: el.id, handle, startX: x, startY: y, el: tighten(el) };
  };

  /** Dragging on empty space draws a box; everything it touches is selected. Shift adds to the selection. */
  const startMarquee = (e: RPointerEvent) => {
    if (e.button !== 0 || preview) return;
    const base = e.shiftKey ? selectedIds : [];
    if (!e.shiftKey) dispatch({ type: 'select', id: null });
    const [x, y] = toMm(e);
    drag.current = { kind: 'marquee', startX: x, startY: y, x, y, base };
  };

  const chosen = preview ? [] : doc.elements.filter((e) => selectedIds.includes(e.id));
  const selected = chosen.length === 1 ? tighten(chosen[0]) : null;
  const group = chosen.length > 1 ? unionBox(chosen.map((el) => coverBox(el))) : null;
  const editing = preview ? undefined : doc.elements.find((e) => e.id === editingId && e.type === 'text');
  // Fingers need bigger targets than a mouse pointer.
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const handleSize = (coarse ? 18 : 8) / zoom;

  return (
    <div className="canvas-frame">
    <div className="canvas-wrap" ref={wrapRef} onPointerDown={startMarquee}>
      <div className="canvas-paper" style={{ width: doc.widthMm * zoom, height: doc.heightMm * zoom }}>
        {preview ? (
          <RasterImage className="canvas-preview" src={preview} alt="Print preview" draggable={false} />
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
                dangerouslySetInnerHTML={{ __html: (el.id === editingId ? '' : elementSvg(resolve(el), { images })) + hitArea(el) }}
              />
            ))}
            {isMirrored(doc) && (
              <g className="mirror-preview" aria-hidden="true">
                <g dangerouslySetInnerHTML={{ __html: mirroredSvg({ ...doc, elements: doc.elements.map(resolve) }, { images }) }} />
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
            {safeArea && (
              <g className="unsafe-zone" aria-label="Outside the printable area">
                <defs>
                  <pattern id="unsafe-hatch" width={1.2} height={1.2} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                    <rect width={0.35} height={1.2} />
                  </pattern>
                </defs>
                {safeArea.y > 0 ? (
                  <>
                    <rect width={doc.widthMm} height={safeArea.y} fill="url(#unsafe-hatch)" />
                    <rect y={safeArea.y + safeArea.h} width={doc.widthMm} height={doc.heightMm - safeArea.y - safeArea.h} fill="url(#unsafe-hatch)" />
                    <line x1={0} x2={doc.widthMm} y1={safeArea.y} y2={safeArea.y} strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${2 / zoom}`} />
                    <line x1={0} x2={doc.widthMm} y1={safeArea.y + safeArea.h} y2={safeArea.y + safeArea.h} strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${2 / zoom}`} />
                  </>
                ) : (
                  <>
                    <rect width={safeArea.x} height={doc.heightMm} fill="url(#unsafe-hatch)" />
                    <rect x={safeArea.x + safeArea.w} width={doc.widthMm - safeArea.x - safeArea.w} height={doc.heightMm} fill="url(#unsafe-hatch)" />
                    <line x1={safeArea.x} x2={safeArea.x} y1={0} y2={doc.heightMm} strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${2 / zoom}`} />
                    <line x1={safeArea.x + safeArea.w} x2={safeArea.x + safeArea.w} y1={0} y2={doc.heightMm} strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${2 / zoom}`} />
                  </>
                )}
              </g>
            )}
            {guides.map((g, i) =>
              g.axis === 'x' ? (
                <line key={i} className="guide" x1={g.at} x2={g.at} y1={-100} y2={doc.heightMm + 100} strokeWidth={1 / zoom} />
              ) : (
                <line key={i} className="guide" y1={g.at} y2={g.at} x1={-100} x2={doc.widthMm + 100} strokeWidth={1 / zoom} />
              ),
            )}
            {!preview &&
              doc.elements
                .filter((el) => issues[el.id])
                .map((el) => tighten(el))
                .map((el) => {
                  // A 16 px badge at any zoom: the 24-unit icon below scaled to 8 px radius.
                  const badge = 8 / zoom / 12;
                  return (
                    <g key={`issue-${el.id}`} className="print-issue-mark" aria-hidden="true" transform={el.rotation ? `rotate(${el.rotation} ${el.x + el.w / 2} ${el.y + el.h / 2})` : undefined}>
                      <rect x={el.x} y={el.y} width={el.w} height={el.h} strokeWidth={1.5 / zoom} strokeDasharray={`${3 / zoom} ${2 / zoom}`} />
                      <g transform={`translate(${el.x + el.w} ${el.y}) scale(${badge})`}>
                        <circle r={12} />
                        <path d="M0 -6.5V1.5M0 5.5V6" strokeWidth={2.6} strokeLinecap="round" />
                      </g>
                    </g>
                  );
                })}
            {selected && (
              <g transform={`rotate(${selected.rotation} ${selected.x + selected.w / 2} ${selected.y + selected.h / 2})`}>
                <rect
                  className="selection"
                  x={selected.x}
                  y={selected.y}
                  width={selected.w}
                  height={selected.h}
                  strokeWidth={1.5 / zoom}
                  onPointerDown={(e) => startMove(e, chosen[0])}
                />
                {(HUGS.has(selected.type) ? CORNERS : HANDLES).map((h) => {
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
                      onPointerDown={(e) => startResize(e, chosen[0], h)}
                    />
                  );
                })}
              </g>
            )}
            {selected && <SizeTag el={selected} zoom={zoom} />}
            {group && (
              <g className="multi-selection" aria-label={`${chosen.length} selected`}>
                {chosen.map((el) => {
                  const t = tighten(el);
                  return (
                    <rect
                      key={el.id}
                      className="selection selection-member"
                      x={t.x}
                      y={t.y}
                      width={t.w}
                      height={t.h}
                      strokeWidth={1 / zoom}
                      transform={t.rotation ? `rotate(${t.rotation} ${t.x + t.w / 2} ${t.y + t.h / 2})` : undefined}
                      onPointerDown={(e) => startMove(e, el)}
                    />
                  );
                })}
                <rect className="selection selection-group" x={group.x} y={group.y} width={group.w} height={group.h} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
                <SizeTag el={{ ...group, rotation: 0 }} zoom={zoom} />
              </g>
            )}
            {marquee && <rect className="marquee" x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} strokeWidth={1 / zoom} />}
          </svg>
        )}
        {editing?.type === 'text' && (
          <TextEditor
            key={editing.id}
            el={editing}
            zoom={zoom}
            onChange={(text) => dispatch({ type: 'update', id: editing.id, patch: { text }, key: 'text' })}
            onDone={onEditEnd}
          />
        )}
      </div>
    </div>
      <div className="canvas-hud">
        {record && record.count > 1 && (
          <div className="canvas-record" role="group" aria-label="Sheet row">
            <IconButton label="Previous row" disabled={record.index <= 0} onClick={() => record.onChange(record.index - 1)}>
              <ChevronLeft size={15} />
            </IconButton>
            <span className="canvas-record-text" aria-live="polite">
              Row {record.index + 1} of {record.count}
            </span>
            <IconButton label="Next row" disabled={record.index >= record.count - 1} onClick={() => record.onChange(record.index + 1)}>
              <ChevronRight size={15} />
            </IconButton>
          </div>
        )}
        <div className="canvas-size" aria-hidden="true">
          {sizeLabel(doc)} mm{isMirrored(doc) ? ' · mirrored' : ''}
          {doc.tailMm ? ' · tail blank' : ''}
        </div>
        {onZoomChange && (
          <div className="canvas-zoom" role="group" aria-label="Zoom">
            <IconButton label="Zoom out" shortcut={shortcutLabel('Mod+-')} disabled={zoom <= MIN_ZOOM} onClick={() => onZoomChange(stepZoom(zoom, 'out'))}>
              <Minus size={15} />
            </IconButton>
            <button type="button" className="canvas-zoom-level" onClick={() => onZoomChange(null)} title={`Fit (${shortcutLabel('Mod+0')})`} aria-label="Fit to view">
              {zoomLevel === null ? 'Fit' : `${Math.round((zoom / PX_PER_MM) * 100)}%`}
            </button>
            <IconButton label="Zoom in" shortcut={shortcutLabel('Mod+=')} disabled={zoom >= MAX_ZOOM} onClick={() => onZoomChange(stepZoom(zoom, 'in'))}>
              <Plus size={15} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}

/** The selected element's box size in a small pill just under it, the same screen size at any zoom. */
function SizeTag({ el, zoom }: { el: Box & { rotation: number }; zoom: number }) {
  // Below the lowest corner, so rotated elements never cover it.
  const a = (el.rotation * Math.PI) / 180;
  const below = (Math.abs(el.w * Math.sin(a)) + Math.abs(el.h * Math.cos(a))) / 2;
  const label = `${round1(el.w)} × ${round1(el.h)} mm`;
  // Sized in screen pixels, then converted to label millimetres.
  const px = 1 / zoom;
  const width = (label.length * 6.4 + 12) * px;
  const height = 18 * px;
  const cx = el.x + el.w / 2;
  const top = el.y + el.h / 2 + below + 6 * px;
  return (
    <g className="size-tag" aria-hidden="true">
      <rect x={cx - width / 2} y={top} width={width} height={height} rx={height / 2} />
      <text x={cx} y={top + height / 2} fontSize={11 * px} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
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

/** The box an element is drawn and grabbed in: what it draws, for elements that hug it. */
const snapTarget = (el: LabelElement): LabelElement => ({ ...el, ...coverBox(el) });

/** An invisible box so thin lines and empty shapes are easy to grab; only what is drawn, for text and pictures. */
function hitArea(original: LabelElement): string {
  const el = tighten(original);
  const pad = el.type === 'line' ? 1 : 0;
  const t = el.rotation ? ` transform="rotate(${el.rotation} ${el.x + el.w / 2} ${el.y + el.h / 2})"` : '';
  return `<rect x="${el.x - pad}" y="${el.y - pad}" width="${el.w + pad * 2}" height="${el.h + pad * 2}" fill="transparent"${t}/>`;
}
