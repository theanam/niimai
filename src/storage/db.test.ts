import { IDBFactory } from 'fake-indexeddb';
import { createDoc } from '../doc/model';
import { deleteLabel, getLabel, getSetting, listLabels, resetDbConnection, saveLabel, setSetting } from './db';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbConnection();
});

describe('storage', () => {
  it('saves, lists newest first, and deletes labels', async () => {
    const a = { ...createDoc(), name: 'A', updatedAt: 1 };
    const b = { ...createDoc(), name: 'B', updatedAt: 2 };
    await saveLabel(a);
    await saveLabel(b);
    expect((await listLabels()).map((d) => d.name)).toEqual(['B', 'A']);
    expect(await getLabel(a.id)).toEqual(a);
    await deleteLabel(a.id);
    expect(await listLabels()).toHaveLength(1);
  });

  it('stores settings', async () => {
    expect(await getSetting('density')).toBeUndefined();
    await setSetting('density', 3);
    await setSetting('manualProfileId', 'd11');
    expect(await getSetting('density')).toBe(3);
    expect(await getSetting('manualProfileId')).toBe('d11');
  });
});
