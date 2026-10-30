/**
 * Dynamic text: fields written as {{Name}} in a text, QR code or barcode
 * marked dynamic. Each printed label is one record: a row of the label's
 * sheet, a step of its number sequence, and today's date.
 */
import type { LabelDoc, LabelElement } from './model';

/** Rows of a spreadsheet, kept with the label so it prints the same anywhere. */
export interface DataSheet {
  /** The file it came from, for showing. */
  name: string;
  columns: string[];
  rows: string[][];
}

/** How {{Number}} counts: start, start + step, … padded to a number of digits, up to an end if set. */
export interface NumberSequence {
  start: number;
  step: number;
  digits: number;
  /** The last number of a run; sets how many labels a batch prints. */
  end?: number;
}

export const DEFAULT_SEQUENCE: NumberSequence = { start: 1, step: 1, digits: 1 };

/** Fields every label has, offered as chips next to the sheet's columns. */
export const BUILT_IN_FIELDS = [
  { name: 'Date', hint: "Today's date" },
  { name: 'Time', hint: 'The time of printing' },
  { name: 'Number', hint: 'Counts up on each label' },
] as const;

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;
/** {{Date}}, {{Date+30}}, {{Date-7}}: a day count from today. */
const DATE_FIELD = /^date\s*([+-]\s*\d+)?$/i;

/** How {{Date}} is written. The option follows a colon: {{Date+30:iso}}. */
export const DATE_FORMATS = [
  { value: 'medium', label: 'Day month year' },
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
  { value: 'iso', label: 'ISO' },
  { value: 'month', label: 'Month and year' },
  { value: 'mmyy', label: 'MM/YYYY' },
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number]['value'];

export const TIME_FORMATS = [
  { value: 'local', label: 'Local' },
  { value: '24h', label: '24-hour' },
  { value: '12h', label: '12-hour' },
] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number]['value'];

export type FieldKind = 'date' | 'time' | 'number' | 'column';

/** A field split into what it is and its options. */
export interface FieldSpec {
  kind: FieldKind;
  /** The column name for sheet fields. */
  name: string;
  /** Days from today, for dates. */
  offset: number;
  format?: string;
}

/** Reads a field as written, e.g. "Date+30:iso". A sheet column of the same name wins over a built-in field. */
export function parseField(raw: string, sheet?: DataSheet): FieldSpec {
  const text = raw.trim();
  if (columnIndex(sheet, text) >= 0) return { kind: 'column', name: text, offset: 0 };
  const colon = text.lastIndexOf(':');
  const head = (colon > 0 ? text.slice(0, colon) : text).trim();
  const format = colon > 0 ? text.slice(colon + 1).trim() || undefined : undefined;
  const date = DATE_FIELD.exec(head);
  if (date) return { kind: 'date', name: 'Date', offset: Number((date[1] ?? '0').replace(/\s/g, '')), format };
  if (/^time$/i.test(head)) return { kind: 'time', name: 'Time', offset: 0, format };
  if (/^number$/i.test(head)) return { kind: 'number', name: 'Number', offset: 0 };
  return { kind: 'column', name: text, offset: 0 };
}

/** Writes a field back out, leaving defaults off so it stays short. */
export function fieldName(spec: FieldSpec): string {
  if (spec.kind === 'column' || spec.kind === 'number') return spec.name;
  const offset = spec.kind === 'date' && spec.offset ? `${spec.offset > 0 ? '+' : ''}${spec.offset}` : '';
  const format = spec.format && spec.format !== (spec.kind === 'date' ? 'medium' : 'local') ? `:${spec.format}` : '';
  return `${spec.name}${offset}${format}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatDate(d: Date, format = 'medium'): string {
  switch (format) {
    case 'iso':
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    case 'mmyy':
      return `${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    case 'month':
      return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(d);
    case 'short':
    case 'long':
      return new Intl.DateTimeFormat(undefined, { dateStyle: format }).format(d);
    default:
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
  }
}

export function formatTime(d: Date, format = 'local'): string {
  if (format === '24h') return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (format === '12h') return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(d);
}

/** A short name for a field's tag, e.g. "Date +30". */
export function fieldLabel(raw: string, sheet?: DataSheet): string {
  const spec = parseField(raw, sheet);
  if (spec.kind === 'date') return spec.offset ? `Date ${spec.offset > 0 ? '+' : '−'}${Math.abs(spec.offset)}` : 'Date';
  return spec.name;
}

export type DynamicElement = Extract<LabelElement, { type: 'text' | 'qr' | 'barcode' }>;

const contentKey = (el: DynamicElement): 'text' | 'value' => (el.type === 'text' ? 'text' : 'value');

/** The text that can hold fields: a text's words, a code's value. */
export const contentOf = (el: DynamicElement): string => (el.type === 'text' ? el.text : el.value);

export const canBeDynamic = (el: LabelElement): el is DynamicElement => el.type === 'text' || el.type === 'qr' || el.type === 'barcode';

/** Field names written in a piece of text, in order, without repeats. */
export function fieldsIn(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]))];
}

/** Every field the label's dynamic elements use. */
export function fieldsOf(doc: Pick<LabelDoc, 'elements'>): string[] {
  return [...new Set(doc.elements.flatMap((el) => (canBeDynamic(el) && el.dynamic ? fieldsIn(contentOf(el)) : [])))];
}

const isBuiltIn = (name: string) => parseField(name).kind !== 'column';

/** The sheet column a field names, matched without regard to case. */
export function columnIndex(sheet: DataSheet | undefined, name: string): number {
  if (!sheet) return -1;
  const want = name.trim().toLowerCase();
  return sheet.columns.findIndex((c) => c.trim().toLowerCase() === want);
}

/** What makes the label print as a batch: sheet columns, a number sequence, or both. */
export function batchNeeds(doc: Pick<LabelDoc, 'elements' | 'sheet'>) {
  const fields = fieldsOf(doc);
  const columns = fields.filter((f) => columnIndex(doc.sheet, f) >= 0 || !isBuiltIn(f));
  return {
    fields,
    /** Fields that come from the sheet, attached or not. */
    columns,
    /** Fields with no column in the attached sheet, or no sheet at all. */
    missing: columns.filter((f) => columnIndex(doc.sheet, f) < 0),
    sheet: columns.length > 0 && !!doc.sheet?.rows.length,
    number: fields.some((f) => parseField(f, doc.sheet).kind === 'number'),
  };
}

export const isBatch = (doc: Pick<LabelDoc, 'elements' | 'sheet'>): boolean => {
  const needs = batchNeeds(doc);
  return needs.sheet || needs.number;
};

/** One printed label's worth of values. */
export interface LabelRecord {
  /** 0-based: the sheet row, and the step of the number sequence. */
  index: number;
  now: Date;
}

/** Labels a run of numbers covers from start to end; null without an end. */
export function sequenceCount(seq: NumberSequence | undefined): number | null {
  const { start, step, end } = { ...DEFAULT_SEQUENCE, ...seq };
  if (end === undefined || !step) return null;
  const n = Math.floor((end - start) / step) + 1;
  return Math.max(1, n);
}

export function sequenceValue(seq: NumberSequence | undefined, index: number): string {
  const { start, step, digits } = { ...DEFAULT_SEQUENCE, ...seq };
  const v = start + index * step;
  const sign = v < 0 ? '-' : '';
  return sign + String(Math.abs(v)).padStart(Math.max(1, digits), '0');
}

/** The value of one field for a record; unknown fields stay as written so they are easy to spot. */
export function fieldValue(doc: Pick<LabelDoc, 'sheet' | 'sequence'>, name: string, rec: LabelRecord): string {
  const spec = parseField(name, doc.sheet);
  switch (spec.kind) {
    case 'date': {
      const d = new Date(rec.now);
      d.setDate(d.getDate() + spec.offset);
      return formatDate(d, spec.format);
    }
    case 'time':
      return formatTime(rec.now, spec.format);
    case 'number':
      return sequenceValue(doc.sequence, rec.index);
    default: {
      const col = columnIndex(doc.sheet, spec.name);
      return col >= 0 ? (doc.sheet!.rows[rec.index]?.[col] ?? '') : `{{${name}}}`;
    }
  }
}

export function fill(text: string, doc: Pick<LabelDoc, 'sheet' | 'sequence'>, rec: LabelRecord): string {
  return text.replace(TOKEN, (_, name: string) => fieldValue(doc, name, rec));
}

/** The element as it prints for a record. */
export function resolveElement<E extends LabelElement>(el: E, doc: Pick<LabelDoc, 'sheet' | 'sequence'>, rec: LabelRecord): E {
  if (!canBeDynamic(el) || !el.dynamic) return el;
  const content = contentOf(el);
  const filled = fill(content, doc, rec);
  return filled === content ? el : ({ ...el, [contentKey(el)]: filled } as E);
}

/** The label as it prints for a record. */
export function resolveDoc(doc: LabelDoc, rec: LabelRecord): LabelDoc {
  if (!doc.elements.some((e) => canBeDynamic(e) && e.dynamic)) return doc;
  return { ...doc, elements: doc.elements.map((el) => resolveElement(el, doc, rec)) };
}

/** Adds a field to the end of a text, with a space before it when needed. */
export function appendField(text: string, name: string): string {
  const token = `{{${name}}}`;
  if (!text.trim()) return token;
  return /\s$/.test(text) ? text + token : `${text} ${token}`;
}

/** Sheet rows from 1-based, inclusive bounds, kept inside the sheet. */
export function clampRange(from: number, to: number, total: number): [number, number] {
  const a = Math.min(Math.max(1, Math.floor(from) || 1), Math.max(1, total));
  const b = Math.min(Math.max(a, Math.floor(to) || a), Math.max(1, total));
  return [a, b];
}

/** A piece of dynamic content: words as written, or a field. */
export type Part = { kind: 'text'; value: string } | { kind: 'field'; name: string };

/** Splits content into text and fields, in order. */
export function toParts(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'field', name: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

export const fromParts = (parts: Part[]): string => parts.map((p) => (p.kind === 'text' ? p.value : `{{${p.name}}}`)).join('');
