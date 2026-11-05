/**
 * The last labels printed on this device, each as it was when it printed,
 * so a common label prints again without finding and opening it first.
 */
import type { LabelDoc } from '../doc/model';
import { uid } from '../lib/units';
import { getSetting, setSetting } from './db';

export interface PrintRecord {
  doc: LabelDoc;
  printedAt: number;
  /** Labels that came out, copies and records together. */
  count: number;
}

export const RECENT_PRINTS = 12;

const sameVersion = (a: LabelDoc, b: LabelDoc) => a.id === b.id && a.updatedAt === b.updatedAt;

/** The list with a new print on top; printing the same version again moves it up. */
export function withPrint(list: PrintRecord[], record: PrintRecord): PrintRecord[] {
  return [record, ...list.filter((r) => !sameVersion(r.doc, record.doc))].slice(0, RECENT_PRINTS);
}

/**
 * The label to open for a past print. The newest copy of that label (open
 * or saved) is used when it has not changed since; a label edited since
 * opens the printed version as a copy, so the edits are kept.
 */
export function printedDoc(record: PrintRecord, newest: LabelDoc | undefined): LabelDoc {
  if (!newest || sameVersion(newest, record.doc)) return record.doc;
  const now = Date.now();
  return { ...record.doc, id: uid(), fileName: undefined, createdAt: now, updatedAt: now };
}

export async function listPrints(): Promise<PrintRecord[]> {
  return (await getSetting('recentPrints')) ?? [];
}

export async function recordPrint(doc: LabelDoc, count: number): Promise<void> {
  await setSetting('recentPrints', withPrint(await listPrints(), { doc, printedAt: Date.now(), count }));
}
