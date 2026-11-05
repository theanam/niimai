import { IDBFactory } from 'fake-indexeddb';
import { createDoc } from '../doc/model';
import { resetDbConnection } from './db';
import { listPrints, printedDoc, recordPrint, RECENT_PRINTS, withPrint } from './recentPrints';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbConnection();
});

describe('recent prints', () => {
  it('keeps the newest print first, moves a reprint up and stops at the limit', () => {
    const a = createDoc();
    const b = { ...createDoc(), name: 'B' };
    let list = withPrint([], { doc: a, printedAt: 1, count: 1 });
    list = withPrint(list, { doc: b, printedAt: 2, count: 3 });
    list = withPrint(list, { doc: a, printedAt: 3, count: 2 });
    expect(list.map((r) => [r.doc.id, r.count])).toEqual([
      [a.id, 2],
      [b.id, 3],
    ]);
    // An edited label counts as a new version.
    list = withPrint(list, { doc: { ...a, updatedAt: a.updatedAt + 1 }, printedAt: 4, count: 1 });
    expect(list).toHaveLength(3);
    for (let i = 0; i < RECENT_PRINTS + 5; i++) list = withPrint(list, { doc: createDoc(), printedAt: 10 + i, count: 1 });
    expect(list).toHaveLength(RECENT_PRINTS);
  });

  it('opens the printed version as a copy when the label changed since', () => {
    const doc = createDoc();
    const record = { doc, printedAt: 1, count: 1 };
    expect(printedDoc(record, undefined)).toBe(doc);
    expect(printedDoc(record, doc)).toBe(doc);
    const copy = printedDoc(record, { ...doc, updatedAt: doc.updatedAt + 5 });
    expect(copy.id).not.toBe(doc.id);
    expect(copy.elements).toBe(doc.elements);
  });

  it('stores prints on the device', async () => {
    const doc = createDoc();
    await recordPrint(doc, 4);
    expect((await listPrints()).map((r) => [r.doc.id, r.count])).toEqual([[doc.id, 4]]);
  });
});
