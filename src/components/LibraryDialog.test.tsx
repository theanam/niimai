import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { createDoc } from '../doc/model';
import { resetDbConnection, saveLabel } from '../storage/db';
import { templatesForSize } from '../templates';
import { renderApp } from '../test/render';
import { LibraryDialog } from './LibraryDialog';

vi.mock('../render/fonts', () => ({ ensureFont: async () => {}, linkFont: async () => {} }));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbConnection();
});

const setup = (props: Partial<Parameters<typeof LibraryDialog>[0]> = {}) => {
  const onOpen = vi.fn();
  const onOpenChange = vi.fn();
  renderApp(
    <LibraryDialog open onOpenChange={onOpenChange} currentId="none" currentSize={{ widthMm: 40, heightMm: 12 }} onOpen={onOpen} {...props} />,
  );
  return { onOpen, onOpenChange };
};

const templateCards = () => within(screen.getByRole('list', { name: 'Templates' })).getAllByRole('button');

describe('library', () => {
  it('lists saved labels and opens one', async () => {
    const doc = { ...createDoc({ widthMm: 50, heightMm: 30 }), name: 'Spice rack' };
    await saveLabel(doc);
    const { onOpen, onOpenChange } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Open Spice rack' }));
    expect(onOpen).toHaveBeenCalledWith(doc);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks before deleting a saved label', async () => {
    await saveLabel({ ...createDoc(), name: 'Old one' });
    setup();
    await screen.findByRole('button', { name: 'Open Old one' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete “Old one”?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Old one' })).toBeNull());
  });

  it('shows templates for the current label size by default', async () => {
    setup({ initialTab: 'templates' });
    await screen.findByRole('list', { name: 'Templates' });
    const cards = templateCards();
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => /40 × 12 mm/.test(c.getAttribute('aria-label') ?? ''))).toBe(true);
    expect(screen.getByRole('button', { name: new RegExp(`All\\s*${templatesForSize({ widthMm: 40, heightMm: 12 }).length}`) })).toBeInTheDocument();
  });

  it('shows every size on request, with a size filter', async () => {
    setup({ initialTab: 'templates' });
    await screen.findByRole('list', { name: 'Templates' });
    await userEvent.click(screen.getByRole('radio', { name: 'All sizes' }));
    await userEvent.click(within(screen.getByLabelText('Filter by size')).getByRole('button', { name: '50 × 50' }));
    expect(templateCards().every((c) => /50 × 50 mm/.test(c.getAttribute('aria-label') ?? ''))).toBe(true);
  });

  it('filters by category and search, then opens a template as a new label', async () => {
    const { onOpen } = setup({ initialTab: 'templates' });
    await screen.findByRole('list', { name: 'Templates' });
    await userEvent.click(screen.getByRole('button', { name: /^Spices/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'paprika');
    const cards = templateCards();
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Use Paprika, 40 × 12 mm', 'Use Paprika with icon, 40 × 12 mm']);
    await userEvent.click(cards[1]);
    const doc = onOpen.mock.calls[0][0];
    expect([doc.widthMm, doc.heightMm]).toEqual([40, 12]);
    expect(doc.elements.some((e: { text?: string }) => e.text === 'Smoked Paprika')).toBe(true);
    expect(doc.elements.some((e: { type: string }) => e.type === 'icon')).toBe(true);
  });

  it('loads templates in pages', async () => {
    setup({ initialTab: 'templates' });
    await screen.findByRole('list', { name: 'Templates' });
    expect(templateCards()).toHaveLength(48);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(templateCards()).toHaveLength(96);
  });
});
