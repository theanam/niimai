/**
 * Reads spreadsheets for dynamic fields: CSV and TSV here, Excel (.xlsx)
 * through read-excel-file, loaded only when one is opened. The first row
 * names the columns.
 */
import type { DataSheet } from '../doc/variables';

/** Rows and columns a sheet may have; enough for any label run. */
export const MAX_ROWS = 10_000;
export const MAX_COLUMNS = 50;

/** The delimiter the first line uses most: comma, semicolon (European Excel) or tab. */
function delimiterOf(text: string): string {
  const line = text.slice(0, text.search(/\r?\n|$/));
  return [',', ';', '\t'].map((d) => [d, line.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
}

/** Parses CSV as Excel writes it: quoted fields may hold delimiters, quotes ("") and line breaks. */
export function parseCsv(text: string, delimiter = delimiterOf(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(v);
  return String(v);
};

/** A grid of cells as a sheet: the first row names the columns, blank rows are dropped. */
export function toSheet(name: string, grid: unknown[][]): DataSheet {
  const [head = [], ...body] = grid;
  const width = Math.min(MAX_COLUMNS, Math.max(head.length, ...body.map((r) => r.length)));
  const columns = Array.from({ length: width }, (_, i) => cellText(head[i]).trim() || `Column ${i + 1}`);
  const rows = body
    .map((r) => columns.map((_, i) => cellText(r[i])))
    .filter((r) => r.some((c) => c.trim()))
    .slice(0, MAX_ROWS);
  if (!rows.length) throw new Error('The sheet has no rows under its header');
  return { name, columns, rows };
}

export async function readSheetFile(file: File): Promise<DataSheet> {
  const name = file.name;
  if (/\.xlsx$/i.test(name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return toSheet(name, (await readSheet(file)) as unknown[][]);
  }
  if (/\.(xls|ods|numbers)$/i.test(name)) throw new Error('Save the sheet as .xlsx or .csv first');
  return toSheet(name, parseCsv(await file.text()));
}
