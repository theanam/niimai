import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { resetDbConnection } from '../storage/db';
import { renderApp } from '../test/render';
import { Editor, starterDoc } from './Editor';

vi.mock('../render/raster', () => ({
  processImages: vi.fn(async () => ({})),
  rasterize: vi.fn(async () => document.createElement('canvas')),
  standaloneSvg: vi.fn(async () => '<svg/>'),
}));

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  resetDbConnection();
  // The printer is an app-wide singleton; start every test disconnected.
  const { printer } = await import('../printer');
  await printer.disconnect();
});

/** Connects the demo printer through the printer dialog, then closes it. */
async function connectDemo() {
  await userEvent.click(screen.getByRole('button', { name: 'Connect printer' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Demo printer' }));
  await screen.findByRole('button', { name: /disconnect/i });
  await userEvent.keyboard('{Escape}');
}

const renderEditor = () => renderApp(<Editor initialDoc={starterDoc()} initialProfileId={null} initialDensity={2} />);
const elements = () => document.querySelectorAll('.canvas-el');

describe('editor', () => {
  it('opens with a starter label', () => {
    renderEditor();
    expect(elements()).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Label name' })).toHaveValue('My label');
  });

  it('adds elements from the toolbar and selects them', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add qr code' }));
    expect(elements()).toHaveLength(2);
    expect(screen.getByRole('complementary', { name: 'QR code settings' })).toBeInTheDocument();
  });

  it('edits text in place on double-click', async () => {
    renderEditor();
    const el = elements()[0];
    fireEvent.doubleClick(el);
    const box = screen.getByRole('textbox', { name: 'Edit text' });
    expect(box).toHaveFocus();
    expect(box).toHaveValue('Hello, label!');
    // The canvas hides its own copy while the editor draws the text.
    expect(el.querySelector('text')).toBeNull();
    await userEvent.type(box, ' Hi');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Edit text' })).toBeNull();
    expect(elements()[0].querySelector('text')?.textContent).toBe('Hello, label! Hi');
  });

  it('undoes a whole editing session in one step', async () => {
    renderEditor();
    fireEvent.doubleClick(elements()[0]);
    await userEvent.type(screen.getByRole('textbox', { name: 'Edit text' }), 'abc');
    await userEvent.keyboard('{Escape}');
    fireEvent.keyDown(window, { key: 'z', metaKey: true, ctrlKey: true });
    expect(elements()[0].querySelector('text')?.textContent).toBe('Hello, label!');
  });

  it('starts editing a new text element with its placeholder selected', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add text' }));
    const box = screen.getByRole('textbox', { name: 'Edit text' }) as HTMLTextAreaElement;
    expect(box).toHaveFocus();
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, 'Label'.length]);
    await userEvent.keyboard('Price');
    await userEvent.keyboard('{Escape}');
    expect(elements()[1].querySelector('text')?.textContent).toBe('Price');
  });

  it('removes a text element left empty', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add text' }));
    await userEvent.keyboard('{Backspace}{Escape}');
    expect(elements()).toHaveLength(1);
  });

  it('opens the editor with Enter on a selected text element', async () => {
    renderEditor();
    fireEvent.pointerDown(elements()[0], { button: 0 });
    fireEvent.pointerUp(window);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(await screen.findByRole('textbox', { name: 'Edit text' })).toHaveFocus();
  });

  it('undoes and redoes with keyboard shortcuts', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    expect(elements()).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'z', metaKey: true, ctrlKey: true });
    expect(elements()).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'z', metaKey: true, ctrlKey: true, shiftKey: true });
    expect(elements()).toHaveLength(2);
  });

  it('deletes, duplicates and nudges the selection', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    fireEvent.keyDown(window, { key: 'd', metaKey: true, ctrlKey: true });
    expect(elements()).toHaveLength(3);
    const x = screen.getByRole('spinbutton', { name: 'X' }) as HTMLInputElement;
    const before = Number(x.value);
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    expect(Number(x.value)).toBeCloseTo(before + 1);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(elements()).toHaveLength(2);
  });

  it('opens the print dialog with Mod+P and the new-label dialog with Mod+N', async () => {
    renderEditor();
    fireEvent.keyDown(window, { key: 'p', metaKey: true, ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Print' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    fireEvent.keyDown(window, { key: 'n', metaKey: true, ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'New label' });
    await userEvent.click(within(dialog).getByRole('button', { name: '50 × 30' }));
    await waitFor(() => expect(screen.getByRole('img', { name: /50 × 30 mm/ })).toBeInTheDocument());
    expect(elements()).toHaveLength(0);
  });

  it('connects to the demo printer', async () => {
    renderEditor();
    await connectDemo();
    expect(screen.getByRole('button', { name: 'Printer ready' })).toBeInTheDocument();
  });

  it('resizes the label to the loaded roll on connect, with undo', async () => {
    const { createDoc } = await import('../doc/model');
    renderApp(<Editor initialDoc={createDoc({ widthMm: 50, heightMm: 30 })} initialProfileId={null} initialDensity={2} />);
    await connectDemo();
    await waitFor(() => expect(screen.getByRole('img', { name: /40 × 12 mm/ })).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'z', metaKey: true, ctrlKey: true });
    expect(screen.getByRole('img', { name: /50 × 30 mm/ })).toBeInTheDocument();
  });

  it('remembers the size of a roll the printer cannot measure', async () => {
    const { MockClient } = await import('../printer/mock');
    const spy = vi.spyOn(MockClient.prototype, 'getRfidInfo').mockReturnValue({
      labelRfidInfo: { tagPresent: true, barCode: 'roll-1', allPaper: 10, usedPaper: 1 },
      paperInfo: undefined,
    });
    renderEditor();
    await connectDemo();
    await userEvent.click(await screen.findByRole('button', { name: /roll size/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Loaded roll size' });
    await userEvent.click(within(dialog).getByRole('button', { name: '50 × 30' }));
    await waitFor(() => expect(screen.getByRole('img', { name: /50 × 30 mm/ })).toBeInTheDocument());
    expect(screen.getByTitle('Size of the loaded roll')).toHaveTextContent('50 × 30');
    spy.mockRestore();
  });

  it('opens on the start screen and starts a blank label from it', async () => {
    renderApp(<Editor initialDoc={starterDoc()} initialProfileId={null} initialDensity={2} initialView="start" />);
    expect(screen.getByRole('heading', { name: 'What are we labelling?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Blank 50 × 30 mm' }));
    expect(screen.getByRole('img', { name: /50 × 30 mm/ })).toBeInTheDocument();
    expect(elements()).toHaveLength(0);
  });

  it('opens a suggested template from the start screen', async () => {
    renderApp(<Editor initialDoc={starterDoc()} initialProfileId={null} initialDensity={2} initialView="start" />);
    const list = await screen.findByRole('list', { name: 'Suggested templates' });
    await userEvent.click(within(list).getAllByRole('button')[0]);
    expect(screen.getByRole('img', { name: /40 × 12 mm/ })).toBeInTheDocument();
    expect(elements().length).toBeGreaterThan(0);
  });

  it('connects from the start screen and returns to it from the logo', async () => {
    renderApp(<Editor initialDoc={starterDoc()} initialProfileId={null} initialDensity={2} initialView="start" />);
    await userEvent.click(screen.getByRole('button', { name: /demo/i }));
    await waitFor(() => expect(screen.getByText('40 × 12 mm roll')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Blank 40 × 12 mm' }));
    await userEvent.click(screen.getByRole('link', { name: 'Start screen' }));
    expect(screen.getByRole('heading', { name: 'What are we labelling?' })).toBeInTheDocument();
  });

  it('ignores editing shortcuts on the start screen', () => {
    renderApp(<Editor initialDoc={starterDoc()} initialProfileId={null} initialDensity={2} initialView="start" />);
    fireEvent.keyDown(window, { key: 'p', metaKey: true, ctrlKey: true });
    expect(screen.queryByRole('dialog', { name: 'Print' })).toBeNull();
  });

  it('adds an icon from the picker', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response((await import('node:fs')).readFileSync(`public/icons/${String(url).split('/').pop()}`, 'utf8'))));
    try {
      renderEditor();
      await userEvent.click(screen.getByRole('button', { name: 'Add icon' }));
      await userEvent.type(await screen.findByRole('searchbox', { name: 'Search icons' }), 'package');
      await userEvent.click(await screen.findByRole('button', { name: 'Package' }));
      expect(elements()).toHaveLength(2);
      expect(screen.getByRole('complementary', { name: 'Icon settings' })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('has a GitHub link, help and about', () => {
    renderEditor();
    expect(screen.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute('href', 'https://github.com/theanam/niimai');
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '#/help');
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '#/about');
  });
});
