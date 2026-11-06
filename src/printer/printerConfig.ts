import type { LabelSize } from '../doc/model';
import type { PrintOffset } from 'libniimai';
import type { Settings } from '../storage/db';
import { parsePreset, type PaperChoices, type PaperPreset } from './paperPresets';

/**
 * Every printer setting niimai keeps, in one file the user can save and load:
 * the browser's storage is per site and per device, and clearing it loses them.
 */
export const CONFIG_KIND = 'niimai-printers';
export const CONFIG_FILE = 'niimai-printers.json';

/** The settings a printer config file carries. */
export interface PrinterSettings {
  manualProfileId?: string | null;
  density?: number;
  rollSizes: Record<string, LabelSize>;
  printOffsets: Record<string, PrintOffset>;
  stickerGaps: Record<string, number>;
  paperWidths: Record<string, number>;
  labelLengths: Record<string, number>;
  matchedPrinters: Record<string, 'escpos' | 'cat'>;
  paperPresets: PaperPreset[];
  paperChoices: PaperChoices;
}

export const EMPTY_SETTINGS: PrinterSettings = {
  rollSizes: {},
  printOffsets: {},
  stickerGaps: {},
  paperWidths: {},
  labelLengths: {},
  matchedPrinters: {},
  paperPresets: [],
  paperChoices: {},
};

/** The storage keys the file holds, so loading writes each one back. */
export const CONFIG_KEYS = ['manualProfileId', 'density', 'rollSizes', 'printOffsets', 'stickerGaps', 'paperWidths', 'labelLengths', 'matchedPrinters', 'paperPresets', 'paperChoices'] as const satisfies readonly (keyof Settings)[];

export function serializeConfig(settings: PrinterSettings, now = new Date()): string {
  return JSON.stringify({ kind: CONFIG_KIND, version: 1, savedAt: now.toISOString(), ...settings }, null, 2);
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The entries of `raw` whose values pass `ok`. */
function record<T>(raw: unknown, ok: (v: unknown) => v is T): Record<string, T> {
  if (!isObject(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => ok(v))) as Record<string, T>;
}

const isPositive = (v: unknown): v is number => finite(v) && v > 0;
const isGap = (v: unknown): v is number => finite(v) && v >= 0;
const isOffset = (v: unknown): v is PrintOffset => isObject(v) && finite(v.x) && finite(v.y);
const isSize = (v: unknown): v is LabelSize => isObject(v) && isPositive(v.widthMm) && isPositive(v.heightMm);
const isFamily = (v: unknown): v is 'escpos' | 'cat' => v === 'escpos' || v === 'cat';
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Reads a printer config file. Unknown or broken entries are dropped; a file of another kind is refused. */
export function parseConfig(text: string): PrinterSettings {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a printer settings file');
  }
  if (!isObject(raw) || raw.kind !== CONFIG_KIND) throw new Error('Not a printer settings file');
  if (raw.version !== 1) throw new Error('This settings file is from a newer niimai');
  const papers = (Array.isArray(raw.paperPresets) ? raw.paperPresets : []).map(parsePreset).filter((p): p is PaperPreset => !!p);
  return {
    ...(raw.manualProfileId === null || isText(raw.manualProfileId) ? { manualProfileId: raw.manualProfileId } : {}),
    ...(finite(raw.density) ? { density: raw.density } : {}),
    rollSizes: record(raw.rollSizes, isSize),
    printOffsets: record(raw.printOffsets, isOffset),
    stickerGaps: record(raw.stickerGaps, isGap),
    paperWidths: record(raw.paperWidths, isPositive),
    labelLengths: record(raw.labelLengths, isPositive),
    matchedPrinters: record(raw.matchedPrinters, isFamily),
    paperPresets: papers.filter((p, i) => papers.findIndex((o) => o.id === p.id) === i),
    paperChoices: record(raw.paperChoices, isText),
  };
}

/**
 * Settings after loading a file: what it holds wins, and what it does not
 * mention stays. Papers with the same id are replaced, new ones added.
 * Sticker gaps are the one per-printer setting whose absence means
 * something (continuous paper), so a printer the file covers takes its gap
 * or lack of one from the file.
 */
export function mergeConfig(current: PrinterSettings, loaded: PrinterSettings): PrinterSettings {
  const covered = new Set([...Object.keys(loaded.paperWidths), ...Object.keys(loaded.labelLengths), ...Object.keys(loaded.stickerGaps)]);
  const keptGaps = Object.fromEntries(Object.entries(current.stickerGaps).filter(([k]) => !covered.has(k)));
  return {
    ...current,
    ...('manualProfileId' in loaded ? { manualProfileId: loaded.manualProfileId } : {}),
    ...(loaded.density !== undefined ? { density: loaded.density } : {}),
    rollSizes: { ...current.rollSizes, ...loaded.rollSizes },
    printOffsets: { ...current.printOffsets, ...loaded.printOffsets },
    stickerGaps: { ...keptGaps, ...loaded.stickerGaps },
    paperWidths: { ...current.paperWidths, ...loaded.paperWidths },
    labelLengths: { ...current.labelLengths, ...loaded.labelLengths },
    matchedPrinters: { ...current.matchedPrinters, ...loaded.matchedPrinters },
    paperPresets: [...current.paperPresets.filter((p) => !loaded.paperPresets.some((l) => l.id === p.id)), ...loaded.paperPresets],
    paperChoices: { ...current.paperChoices, ...loaded.paperChoices },
  };
}

/** "3 printers, 12 papers", for telling the user what a file held. */
export function configSummary(s: PrinterSettings): string {
  const printers = new Set([...Object.keys(s.printOffsets), ...Object.keys(s.stickerGaps), ...Object.keys(s.paperWidths), ...Object.keys(s.labelLengths), ...Object.keys(s.paperChoices)]).size;
  const parts = [printers && `${printers} printer${printers === 1 ? '' : 's'}`, s.paperPresets.length && `${s.paperPresets.length} paper${s.paperPresets.length === 1 ? '' : 's'}`].filter(Boolean);
  return parts.join(', ') || 'no printer settings';
}
