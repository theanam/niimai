import { sanitizeIconBody, type IconWeight } from '../icons/catalog';
import { round1, uid } from '../lib/units';

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
}

export interface BarcodeElement extends Base {
  type: 'barcode';
  value: string;
  format: BarcodeFormat;
  showText: boolean;
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

export interface LineElement extends Base {
  type: 'line';
  strokeWidth: number;
}

export type LabelElement =
  | TextElement
  | ImageElement
  | QrElement
  | BarcodeElement
  | IconElement
  | RectElement
  | EllipseElement
  | LineElement;

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
      el = { ...box(fullW, 1), type, strokeWidth: 0.5 };
      break;
  }
  return { ...el, ...extra } as LabelElement;
}

const TYPES: ElementType[] = ['text', 'image', 'qr', 'barcode', 'icon', 'rect', 'ellipse', 'line'];
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
      if (merged.type === 'icon') merged.body = sanitizeIconBody(String(merged.body ?? ''));
      return merged;
    });
  const now = Date.now();
  const tail = isNum(raw.tailMm) && raw.tailMm > 0 && raw.tailMm < size.widthMm ? { tailMm: raw.tailMm } : {};
  const fold = FOLD_MODES.includes(raw.fold as FoldMode) ? { fold: raw.fold as FoldMode } : {};
  return {
    version: 1,
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled',
    ...size,
    ...tail,
    ...fold,
    elements,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
  };
}

export const serializeDoc = (doc: LabelDoc): string => JSON.stringify(doc, null, 2);

/** Every font family the label uses, for loading and embedding. */
export const usedFonts = (doc: LabelDoc): string[] => [
  ...new Set(doc.elements.flatMap((e) => (e.type === 'text' ? [e.fontFamily] : []))),
];
