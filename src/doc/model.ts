import { sanitizeIconBody, type IconWeight } from '../icons/catalog';
import { PAPER_TYPES, type PaperType } from '../printer/paper';
import { isFrameStyle, type FrameStyle } from '../render/frames';
import { round1, uid } from '../lib/units';
import type { DataSheet, NumberSequence } from './variables';

export type Align = 'left' | 'center' | 'right';
export type DitherMode = 'threshold' | 'floyd' | 'atkinson';
export type BarcodeFormat = 'code128' | 'ean13' | 'upca' | 'code39';

interface Base {
  id: string;
  /** Position and size in millimetres, relative to the label's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise, around the element's centre. */
  rotation: number;
}

export interface TextElement extends Base {
  type: 'text';
  text: string;
  fontFamily: string;
  /** Points. Ignored when autoFit is on. */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: Align;
  autoFit: boolean;
  /** Fields written as {{Name}} are filled in for each printed label. */
  dynamic?: boolean;
}

export interface ImageElement extends Base {
  type: 'image';
  /** Data URL, so labels stay self-contained. */
  src: string;
  dither: DitherMode;
  threshold: number;
  invert: boolean;
}

export interface QrElement extends Base {
  type: 'qr';
  value: string;
  /** See TextElement.dynamic. */
  dynamic?: boolean;
}

export interface BarcodeElement extends Base {
  type: 'barcode';
  value: string;
  format: BarcodeFormat;
  showText: boolean;
  /** See TextElement.dynamic. */
  dynamic?: boolean;
}

export interface IconElement extends Base {
  type: 'icon';
  /** Phosphor icon name, e.g. "package". */
  name: string;
  weight: IconWeight;
  /** Path markup in a 256 × 256 box, stored so labels stay self-contained. */
  body: string;
}

export interface RectElement extends Base {
  type: 'rect';
  strokeWidth: number;
  fill: boolean;
  radius: number;
}

export interface EllipseElement extends Base {
  type: 'ellipse';
  strokeWidth: number;
  fill: boolean;
}

export interface FrameElement extends Base {
  type: 'frame';
  style: FrameStyle;
  strokeWidth: number;
}

/** Which way a line crosses its box; diagonals run corner to corner. */
export type LineDirection = 'horizontal' | 'vertical' | 'down' | 'up';
export const LINE_DIRECTIONS: LineDirection[] = ['horizontal', 'vertical', 'down', 'up'];

export interface LineElement extends Base {
  type: 'line';
  strokeWidth: number;
  direction: LineDirection;
}

export type LabelElement =
  | TextElement
  | ImageElement
  | QrElement
  | BarcodeElement
  | IconElement
  | RectElement
  | EllipseElement
  | LineElement
  | FrameElement;

export type ElementType = LabelElement['type'];

export interface LabelDoc {
  version: 1;
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  /** Cable labels: the blank tail at the right end that wraps around the cable. */
  tailMm?: number;
  /** The flag folds at its middle; see FoldMode. */
  fold?: FoldMode;
  /** Paper to print on; unset follows what the loaded roll reports. */
  paper?: PaperType;
  /** The file this label was last saved as or opened from, without the extension. Its name follows the file. */
  fileName?: string;
  /** The printer connected when the label was made or last saved, for telling files apart later. */
  printer?: string;
  /** Rows that fill dynamic fields, one label per row. */
  sheet?: DataSheet;
  /** How {{Number}} counts. */
  sequence?: NumberSequence;
  elements: LabelElement[];
  createdAt: number;
  updatedAt: number;
}

/**
 * How a label that folds at the middle of its flag is printed:
 * - copy: design the first half; the second half repeats it, so a fold across
 *   the strip reads the right way from both sides
 * - flip: the repeat is turned upside down, for flags folded the other way
 * - none: both halves are designed freely; the fold line is only a guide
 */
export type FoldMode = 'copy' | 'flip' | 'none';
const FOLD_MODES: FoldMode[] = ['copy', 'flip', 'none'];

export interface LabelSize {
  widthMm: number;
  heightMm: number;
  /** Cable labels only: length of the unprinted tail at the right end. */
  tailMm?: number;
  fold?: FoldMode;
}

/** Length of the flag: everything left of a cable label's tail. */
export const flagWidth = (s: LabelSize): number => Math.max(1, s.widthMm - (s.tailMm ?? 0));

/** True when the second half of the flag repeats the first. */
export const isMirrored = (s: LabelSize): boolean => s.fold === 'copy' || s.fold === 'flip';

/**
 * The area you design in: the flag, or just its first half when the second
 * half repeats it.
 */
export const printableArea = (s: LabelSize): LabelSize => ({
  widthMm: isMirrored(s) ? flagWidth(s) / 2 : flagWidth(s),
  heightMm: s.heightMm,
});

/** Where new elements land: the first half of a folded flag, otherwise the design area. */
export const placementArea = (s: LabelSize): LabelSize =>
  s.fold ? { widthMm: flagWidth(s) / 2, heightMm: s.heightMm } : printableArea(s);

/** "40 × 12" or, for cable labels, "74 + 35 × 12.5" (flag + tail × height). */
export const sizeLabel = (s: LabelSize): string => {
  const flag = s.fold ? `${flagWidth(s) / 2}|${flagWidth(s) / 2}` : `${flagWidth(s)}`;
  return s.tailMm ? `${flag} + ${s.tailMm} × ${s.heightMm}` : s.fold ? `${flag} × ${s.heightMm}` : `${s.widthMm} × ${s.heightMm}`;
};

/** Common NIIMBOT roll sizes, width × height in millimetres. */
export const LABEL_PRESETS: LabelSize[] = [
  { widthMm: 30, heightMm: 12 },
  { widthMm: 30, heightMm: 14 },
  { widthMm: 30, heightMm: 15 },
  { widthMm: 40, heightMm: 12 },
  { widthMm: 40, heightMm: 30 },
  { widthMm: 50, heightMm: 30 },
  { widthMm: 50, heightMm: 50 },
  { widthMm: 75, heightMm: 12 },
  // NIIMBOT T12.5×74+35 cable flag, for the D-series. The flag folds at its middle.
  { widthMm: 109, heightMm: 12.5, tailMm: 35, fold: 'copy' },
];

export const DEFAULT_FONT = 'Inter';

export function createDoc(size: LabelSize = { widthMm: 40, heightMm: 12 }, name = 'Untitled'): LabelDoc {
  const now = Date.now();
  return { version: 1, id: uid(), name, ...size, elements: [], createdAt: now, updatedAt: now };
}

/** A new element of the given type, centred on the label and sized to fit it. */
export function createElement(type: ElementType, doc: LabelSize, extra: Partial<LabelElement> = {}): LabelElement {
  const pad = Math.min(doc.widthMm, doc.heightMm) * 0.1;
  const fullW = doc.widthMm - pad * 2;
  const fullH = doc.heightMm - pad * 2;
  const square = Math.min(fullW, fullH);
  const box = (w: number, h: number): Base => ({
    id: uid(),
    x: round1((doc.widthMm - w) / 2),
    y: round1((doc.heightMm - h) / 2),
    w: round1(w),
    h: round1(h),
    rotation: 0,
  });

  let el: LabelElement;
  switch (type) {
    case 'text':
      el = {
        ...box(fullW, fullH),
        type,
        text: 'Label',
        fontFamily: DEFAULT_FONT,
        fontSize: 12,
        bold: false,
        italic: false,
        align: 'center',
        autoFit: true,
      };
      break;
    case 'image':
      el = { ...box(square, square), type, src: '', dither: 'floyd', threshold: 128, invert: false };
      break;
    case 'qr':
      el = { ...box(square, square), type, value: 'https://niimai.app/' };
      break;
    case 'barcode':
      el = { ...box(fullW, fullH), type, value: '123456789', format: 'code128', showText: true };
      break;
    case 'icon':
      el = { ...box(square, square), type, name: '', weight: 'bold', body: '' };
      break;
    case 'rect':
      el = { ...box(fullW, fullH), type, strokeWidth: 0.5, fill: false, radius: 1 };
      break;
    case 'ellipse':
      el = { ...box(square, square), type, strokeWidth: 0.5, fill: false };
      break;
    case 'line':
      el = { ...box(fullW, 1), type, strokeWidth: 0.5, direction: 'horizontal' };
      break;
    case 'frame':
      // Hugs the edge, leaving room for the printer's margin.
      el = { ...box(Math.max(1, doc.widthMm - 1), Math.max(1, doc.heightMm - 1)), type, style: 'single', strokeWidth: 0.5 };
      break;
  }
  return { ...el, ...extra } as LabelElement;
}

const TYPES: ElementType[] = ['text', 'image', 'qr', 'barcode', 'icon', 'rect', 'ellipse', 'line', 'frame'];
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validates a parsed label file. Unknown element types are dropped and missing
 * fields fall back to defaults, so files from newer versions still open.
 */
export function parseDoc(input: unknown): LabelDoc {
  if (!input || typeof input !== 'object') throw new Error('Not a label file');
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1) throw new Error('Unsupported label file version');
  if (!isNum(raw.widthMm) || !isNum(raw.heightMm) || raw.widthMm <= 0 || raw.heightMm <= 0) {
    throw new Error('Label size is missing');
  }
  const size = { widthMm: raw.widthMm, heightMm: raw.heightMm };
  const elements = (Array.isArray(raw.elements) ? raw.elements : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && TYPES.includes(e.type as ElementType))
    .map((e) => {
      const base = createElement(e.type as ElementType, size);
      const merged = { ...base, ...e } as LabelElement;
      for (const k of ['x', 'y', 'w', 'h', 'rotation'] as const) if (!isNum(merged[k])) merged[k] = base[k];
      if (typeof merged.id !== 'string') merged.id = base.id;
      if ('dynamic' in merged) (merged as { dynamic?: boolean }).dynamic = merged.dynamic === true || undefined;
      if (merged.type === 'icon') merged.body = sanitizeIconBody(String(merged.body ?? ''));
      if (merged.type === 'line' && !LINE_DIRECTIONS.includes(merged.direction)) merged.direction = 'horizontal';
      if (merged.type === 'frame') {
        if (!isFrameStyle(merged.style)) merged.style = 'single';
        if (!isNum(merged.strokeWidth) || merged.strokeWidth <= 0) merged.strokeWidth = 0.5;
      }
      return merged;
    });
  const now = Date.now();
  const tail = isNum(raw.tailMm) && raw.tailMm > 0 && raw.tailMm < size.widthMm ? { tailMm: raw.tailMm } : {};
  const fold = FOLD_MODES.includes(raw.fold as FoldMode) ? { fold: raw.fold as FoldMode } : {};
  const paper = PAPER_TYPES.some((p) => p.value === raw.paper) ? { paper: raw.paper as PaperType } : {};
  const fileName = typeof raw.fileName === 'string' && raw.fileName ? { fileName: raw.fileName } : {};
  const printer = typeof raw.printer === 'string' && raw.printer ? { printer: raw.printer } : {};
  const sheet = parseSheet(raw.sheet);
  const seq = raw.sequence as Record<string, unknown> | undefined;
  const sequence =
    seq && typeof seq === 'object' && isNum(seq.start) && isNum(seq.step) && isNum(seq.digits)
      ? {
          sequence: {
            start: Math.round(seq.start),
            step: Math.round(seq.step),
            digits: Math.min(12, Math.max(1, Math.round(seq.digits))),
            ...(isNum(seq.end) ? { end: Math.round(seq.end) } : {}),
          },
        }
      : {};
  return {
    version: 1,
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled',
    ...size,
    ...tail,
    ...fold,
    ...paper,
    ...fileName,
    ...printer,
    ...(sheet ? { sheet } : {}),
    ...sequence,
    elements,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
  };
}

/** A sheet read back from a file, with every cell as text; null when it is not one. */
function parseSheet(raw: unknown): DataSheet | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.columns) || !Array.isArray(r.rows)) return null;
  const columns = r.columns.map((c) => String(c ?? ''));
  const rows = r.rows.filter(Array.isArray).map((row: unknown[]) => columns.map((_, i) => String(row[i] ?? '')));
  return { name: typeof r.name === 'string' ? r.name : 'Sheet', columns, rows };
}

export const serializeDoc = (doc: LabelDoc): string => JSON.stringify(doc, null, 2);

/** Every font family the label uses, for loading and embedding. */
export const usedFonts = (doc: LabelDoc): string[] => [
  ...new Set(doc.elements.flatMap((e) => (e.type === 'text' ? [e.fontFamily] : []))),
];

/**
 * The box for a line turned to a new direction: same length and centre,
 * kept on the label. Diagonals get a square box.
 */
export function reshapeLine(el: LineElement, direction: LineDirection, label: LabelSize): Partial<LineElement> {
  const length = Math.max(el.w, el.h, 2);
  const thin = 1;
  let w: number;
  let h: number;
  if (direction === 'horizontal') [w, h] = [Math.min(length, label.widthMm), thin];
  else if (direction === 'vertical') [w, h] = [thin, Math.min(length, label.heightMm)];
  else if (Math.min(el.w, el.h) >= 2) [w, h] = [el.w, el.h];
  else {
    const side = Math.min(length / Math.SQRT2, label.widthMm, label.heightMm);
    [w, h] = [side, side];
  }
  const clamp = (v: number, size: number, max: number) => Math.min(Math.max(0, v), Math.max(0, max - size));
  return {
    direction,
    w: round1(w),
    h: round1(h),
    x: round1(clamp(el.x + el.w / 2 - w / 2, w, label.widthMm)),
    y: round1(clamp(el.y + el.h / 2 - h / 2, h, label.heightMm)),
  };
}
