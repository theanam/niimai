import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LabelDoc, LabelSize } from '../doc/model';

interface Schema extends DBSchema {
  labels: { key: string; value: LabelDoc; indexes: { updatedAt: number } };
  settings: { key: string; value: unknown };
}

export interface Settings {
  lastLabelId?: string;
  manualProfileId?: string | null;
  density?: number;
  recentFonts?: string[];
  /** Roll sizes the user confirmed, by RFID barcode, for printers that do not report size. */
  rollSizes?: Record<string, LabelSize>;
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>('niimai', 1, {
    upgrade(d) {
      d.createObjectStore('labels', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      d.createObjectStore('settings');
    },
  });
  return dbPromise;
}

/** Testing hook: forget the open connection so a fresh database is used. */
export function resetDbConnection(): void {
  dbPromise = null;
}

export async function saveLabel(doc: LabelDoc): Promise<void> {
  await (await db()).put('labels', doc);
}

export async function getLabel(id: string): Promise<LabelDoc | undefined> {
  return (await db()).get('labels', id);
}

/** Newest first. */
export async function listLabels(): Promise<LabelDoc[]> {
  return (await (await db()).getAllFromIndex('labels', 'updatedAt')).reverse();
}

export async function deleteLabel(id: string): Promise<void> {
  await (await db()).delete('labels', id);
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined> {
  return (await (await db()).get('settings', key)) as Settings[K] | undefined;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await (await db()).put('settings', value, key);
}
