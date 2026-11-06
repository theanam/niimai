import type { PrintOffset } from 'libniimai';
import { MAX_GAP_MM, MAX_LENGTH_MM, MAX_PAPER_MM, MIN_LENGTH_MM, MIN_PAPER_MM } from './thermalPaper';

/**
 * A paper the user keeps for printers that cannot sense it, the way slicers
 * keep filament profiles: a sticker roll or a continuous roll, with its size,
 * gap and the print position that lines it up. Papers are shared by every
 * printer; each printer remembers the one loaded last.
 */
export interface PaperPreset {
  id: string;
  name: string;
  widthMm: number;
  /** The sticker length, or the length new labels start at on continuous paper. */
  lengthMm: number;
  /** The gap between stickers; absent on continuous paper. */
  gapMm?: number;
  offset?: PrintOffset;
}

/** The paper settings a printer has now, to compare with a preset or save as one. */
export interface PaperValues {
  widthMm: number;
  lengthMm: number;
  gapMm?: number;
  offset: PrintOffset;
}

/** The paper last chosen on each printer, by printer model. */
export type PaperChoices = Record<string, string>;

export const presetValues = (p: PaperPreset): PaperValues => ({
  widthMm: p.widthMm,
  lengthMm: p.lengthMm,
  ...(p.gapMm !== undefined ? { gapMm: p.gapMm } : {}),
  offset: p.offset ?? { x: 0, y: 0 },
});

/** True when the printer's settings still match the preset. */
export function samePaper(a: PaperValues, b: PaperValues): boolean {
  return a.widthMm === b.widthMm && a.lengthMm === b.lengthMm && (a.gapMm ?? null) === (b.gapMm ?? null) && a.offset.x === b.offset.x && a.offset.y === b.offset.y;
}

const newId = (): string => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** A preset holding `values`; pass `id` to replace an existing one. */
export function presetFrom(name: string, values: PaperValues, id: string = newId()): PaperPreset {
  const moved = values.offset.x !== 0 || values.offset.y !== 0;
  return {
    id,
    name: name.trim(),
    widthMm: values.widthMm,
    lengthMm: values.lengthMm,
    ...(values.gapMm !== undefined ? { gapMm: values.gapMm } : {}),
    ...(moved ? { offset: { ...values.offset } } : {}),
  };
}

/** "58 × 40 mm stickers, 2 mm gap" or "75 mm continuous". */
export function paperSummary(p: Pick<PaperPreset, 'widthMm' | 'lengthMm' | 'gapMm'>): string {
  return p.gapMm !== undefined ? `${p.widthMm} × ${p.lengthMm} mm stickers, ${p.gapMm} mm gap` : `${p.widthMm} mm continuous`;
}

/** A name for a new paper from its size, unique among `papers`. */
export function suggestName(values: Pick<PaperValues, 'widthMm' | 'lengthMm' | 'gapMm'>, papers: PaperPreset[]): string {
  const base = values.gapMm !== undefined ? `Stickers ${values.widthMm} × ${values.lengthMm}` : `Continuous ${values.widthMm} mm`;
  const taken = new Set(papers.map((p) => p.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
}

const num = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

/** A preset read from a file or storage, or null when it is not one. Values out of range are refused. */
export function parsePreset(raw: unknown): PaperPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const widthMm = num(r.widthMm, MIN_PAPER_MM, MAX_PAPER_MM);
  const lengthMm = num(r.lengthMm, MIN_LENGTH_MM, MAX_LENGTH_MM);
  if (!name || widthMm === null || lengthMm === null) return null;
  const gapMm = r.gapMm === undefined ? undefined : num(r.gapMm, 0, MAX_GAP_MM);
  if (gapMm === null) return null;
  const o = r.offset as Record<string, unknown> | undefined;
  const x = o && num(o.x, -50, 50);
  const y = o && num(o.y, -50, 50);
  return {
    id: typeof r.id === 'string' && r.id ? r.id : newId(),
    name,
    widthMm,
    lengthMm,
    ...(gapMm !== undefined ? { gapMm } : {}),
    ...(x != null && y != null && (x !== 0 || y !== 0) ? { offset: { x, y } } : {}),
  };
}
