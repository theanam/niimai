import { createDoc, createElement, type LabelElement } from '../doc/model';
import { decodeShare, encodeShare, sharedPart, shareUrl, SHARE_PREFIX } from './share';

describe('share links', () => {
  it('carries the whole label in the link and opens it as a new copy', async () => {
    const doc = { ...createDoc(), name: 'Jam jars', fileName: 'jam.niimai', printer: 'B1' };
    doc.elements = [{ ...createElement('text', doc), text: 'Strawberry · 2026', group: 'g' } as LabelElement];
    const text = await encodeShare(doc);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    const copy = await decodeShare(text);
    expect(copy.name).toBe('Jam jars');
    expect(copy.elements[0]).toMatchObject({ type: 'text', text: 'Strawberry · 2026', group: 'g' });
    expect(copy.id).not.toBe(doc.id);
    // Where it was saved and printed stays on this device.
    expect(copy.fileName).toBeUndefined();
    expect(copy.printer).toBeUndefined();
  });

  it('builds links on this copy of the app and reads them back', async () => {
    const url = await shareUrl(createDoc(), 'https://niimai.app/');
    expect(url.startsWith(`https://niimai.app/${SHARE_PREFIX}`)).toBe(true);
    const hash = url.slice(url.indexOf('#'));
    expect(await decodeShare(sharedPart(hash)!)).toMatchObject({ version: 1 });
    expect(sharedPart('#/help')).toBeNull();
    expect(sharedPart(SHARE_PREFIX)).toBeNull();
  });

  it('refuses a damaged link', async () => {
    await expect(decodeShare('not-a-label')).rejects.toThrow();
  });
});
