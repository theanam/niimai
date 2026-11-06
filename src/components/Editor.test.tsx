import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { onTestFinished } from 'vitest';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { resetDbConnection } from '../storage/db';
import { renderApp } from '../test/render';
import { createElement } from '../doc/model';
import { Editor, starterDoc } from './Editor';

vi.mock('../render/raster', () => ({
  processImages: vi.fn(async () => ({})),
  rasterize: vi.fn(async () => document.createElement('canvas')),
  standaloneSvg: vi.fn(async () => '<svg/>'),
}));

beforeEach(async () => {
  // Most tests read positions; the section starts collapsed for people (see the test for that).
  localStorage.setItem('niimai:sections', JSON.stringify({ position: true }));
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

/** Points the app's printer at a stand-in MP583 for one test. Returns the undo. */
async function useEscPosPrinter() {
  const { printer } = await import('../printer');
  const { EscPosPrinterClient, escposModelFor } = await import('libniimai');
  const link = { name: 'MP583', write: async () => {}, onNotify: () => {}, onDisconnect: () => {}, disconnect: async () => {} };
  const target = printer as unknown as { createClient: () => Promise<unknown> };
  const original = target.createClient;
  target.createClient = async () => new EscPosPrinterClient(link, escposModelFor('MP583'));
  return {
    printer,
    restore: () => {
      target.createClient = original;
    },
  };
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
    await userEvent.click(screen.getByRole('button', { name: 'Add QR code' }));
    expect(elements()).toHaveLength(2);
    expect(screen.getByRole('complementary', { name: 'QR code settings' })).toBeInTheDocument();
  });

  it('selects several elements with shift-click and Mod+A, then aligns and deletes them together', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add QR code' }));
    fireEvent.pointerDown(elements()[0], { button: 0, shiftKey: true });
    expect(screen.getByRole('complementary', { name: 'Selection settings' })).toHaveTextContent('2 selected');
    await userEvent.click(screen.getByRole('button', { name: 'Align left' }));
    const lefts = [...document.querySelectorAll('.selection-member')].map((r) => Number(r.getAttribute('x')));
    expect(lefts[0]).toBeCloseTo(lefts[1]);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'a', metaKey: true, ctrlKey: true });
    expect(screen.getByRole('complementary', { name: 'Selection settings' })).toHaveTextContent('2 selected');
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(elements()).toHaveLength(0);
  });

  it('groups elements so a click picks them together, and locks them out of reach until unlocked', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add QR code' }));
    fireEvent.pointerDown(elements()[0], { button: 0, shiftKey: true });
    await userEvent.click(screen.getByRole('button', { name: 'Group' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerDown(elements()[0], { button: 0 });
    fireEvent.pointerUp(window);
    expect(screen.getByRole('complementary', { name: 'Selection settings' })).toHaveTextContent('2 selected');
    // A second click on a picked group picks that one element.
    fireEvent.pointerDown(elements()[0], { button: 0 });
    fireEvent.pointerUp(window);
    expect(screen.getByRole('complementary', { name: 'Text settings' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ungroup' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerDown(elements()[1], { button: 0 });
    fireEvent.pointerUp(window);
    expect(screen.getByRole('complementary', { name: 'QR code settings' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Lock' }));
    expect(elements()[1]).toHaveClass('locked');
    const locked = screen.getByRole('complementary', { name: 'Label settings' });
    expect(within(locked).getByText('Locked')).toBeInTheDocument();
    // Select all leaves locked elements out.
    fireEvent.keyDown(window, { key: 'a', metaKey: true, ctrlKey: true });
    expect(screen.getByRole('complementary', { name: 'Text settings' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await userEvent.click(screen.getByRole('button', { name: 'Unlock QR code' }));
    expect(elements()[1]).not.toHaveClass('locked');
    expect(screen.queryByText('Locked')).toBeNull();
  });

  it('adds and takes out elements with a long press on touch screens, and selects all from the label panel', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add QR code' }));
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(elements()[0], { button: 0, pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(window);
      expect(screen.getByRole('complementary', { name: 'Selection settings' })).toHaveTextContent('2 selected');
      fireEvent.pointerDown(elements()[1], { button: 0, pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(window);
      expect(screen.getByRole('complementary', { name: 'Text settings' })).toBeInTheDocument();
      // A short tap still picks one element.
      fireEvent.pointerDown(elements()[1], { button: 0, pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(100));
      fireEvent.pointerUp(window);
      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole('complementary', { name: 'QR code settings' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
    fireEvent.keyDown(window, { key: 'Escape' });
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('complementary', { name: 'Selection settings' })).toHaveTextContent('2 selected');
  });

  it('shares the label as a link, and opens a shared link as a copy', async () => {
    const { encodeShare } = await import('../files/share');
    const shared = { ...starterDoc(), name: 'Spice rack' };
    window.history.replaceState(null, '', `/#/l/${await encodeShare(shared)}`);
    renderEditor();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Label name' })).toHaveValue('Spice rack'));
    // The address goes back to the editor, so a reload does not open it again.
    expect(window.location.hash).toBe('#/');
    await userEvent.click(screen.getByRole('button', { name: 'Share link' }));
    const link = await screen.findByDisplayValue(/#\/l\//);
    expect((link as HTMLInputElement).value.startsWith(`${location.origin}/#/l/`)).toBe(true);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith((link as HTMLInputElement).value);
  });

  it('lists printed labels in the library and opens the print window for one again', async () => {
    renderEditor();
    const { printer } = await import('../printer');
    const print = vi.spyOn(printer, 'print').mockResolvedValue();
    onTestFinished(() => print.mockRestore());
    await connectDemo();
    await userEvent.keyboard('{Control>}p{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Print' });
    await userEvent.click(dialog.querySelector('.print-go')!);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Print' })).toBeNull());
    await userEvent.keyboard('{Control>}l{/Control}');
    await userEvent.click(await screen.findByRole('tab', { name: 'Printed' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Print My label again' }));
    expect(await screen.findByRole('dialog', { name: 'Print' })).toBeInTheDocument();
  });

  it('hugs text with its selection box: no space beside the words', () => {
    renderEditor();
    fireEvent.pointerDown(elements()[0], { button: 0 });
    const box = document.querySelector('.selection')!;
    // Corner handles only: text keeps its proportions.
    expect(document.querySelectorAll('.handle')).toHaveLength(4);
    const text = elements()[0].querySelector('text')!;
    const size = Number(text.getAttribute('font-size'));
    // jsdom measures 0.55 em a character.
    expect(Number(box.getAttribute('width'))).toBeCloseTo('Hello, label!'.length * 0.55 * size, 1);
    expect(Number(box.getAttribute('height'))).toBeCloseTo(size * 1.2, 1);
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

  it('selects all of an existing text on double-click, so typing replaces it', async () => {
    renderEditor();
    fireEvent.doubleClick(elements()[0]);
    const box = (await screen.findByRole('textbox', { name: 'Edit text' })) as HTMLTextAreaElement;
    expect(box).toHaveFocus();
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, 'Hello, label!'.length]);
    await userEvent.keyboard('Spices');
    await userEvent.keyboard('{Escape}');
    expect(elements()[0].querySelector('text')?.textContent).toBe('Spices');
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

  it('adds a frame in the picked style and switches it later', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add frame' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Dashed' }));
    expect(elements()).toHaveLength(2);
    expect(document.querySelector('.canvas-el [stroke-dasharray]')).not.toBeNull();
    const styles = screen.getByRole('listbox', { name: 'Frame styles' });
    expect(within(styles).getByRole('option', { name: 'Dashed' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(within(styles).getByRole('option', { name: 'Double' }));
    expect(within(styles).getByRole('option', { name: 'Double' })).toHaveAttribute('aria-selected', 'true');
  });

  it('turns a line vertical from the inspector', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Vertical' }));
    const w = screen.getByRole('spinbutton', { name: 'Width' }) as HTMLInputElement;
    const h = screen.getByRole('spinbutton', { name: 'Height' }) as HTMLInputElement;
    expect(Number(w.value)).toBe(1);
    expect(Number(h.value)).toBeGreaterThan(1);
  });

  it('places pasted SVG markup as an image sized to its viewBox', async () => {
    renderEditor();
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', {
      value: { files: [], getData: () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><path d="M0 0h40v10z"/></svg>' },
    });
    fireEvent(window, paste);
    await waitFor(() => expect(elements()).toHaveLength(2));
    const w = Number((screen.getByRole('spinbutton', { name: 'Width' }) as HTMLInputElement).value);
    const h = Number((screen.getByRole('spinbutton', { name: 'Height' }) as HTMLInputElement).value);
    expect(w / h).toBeCloseTo(4, 1);
    expect(screen.getByRole('radio', { name: 'Threshold' })).toHaveAttribute('aria-checked', 'true');
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

  it('opens templates from the header and from an empty label', async () => {
    renderApp(<Editor initialDoc={{ ...starterDoc(), elements: [] }} initialProfileId={null} initialDensity={2} />);
    await userEvent.click(screen.getByRole('button', { name: /start from one of [\d,]+ templates/i }));
    expect(await screen.findByRole('tab', { name: /templates/i })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(await screen.findByRole('tab', { name: /templates/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('nags while the design does not fit the loaded roll', async () => {
    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 50, heightMm: 30 }} initialProfileId={null} initialDensity={2} />);
    await connectDemo();
    // The design follows the roll on connect; undo puts the mismatch back.
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(window, { key: 'z', metaKey: true, ctrlKey: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Design is 50 × 30 mm, the printer has 40 × 12 mm labels.');
    await userEvent.click(screen.getByRole('button', { name: 'Match the roll' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('prints the alignment test with the saved offset for the printer', async () => {
    const { printer } = await import('../printer');
    const print = vi.spyOn(printer, 'print');
    renderApp(<Editor initialDoc={starterDoc()} initialProfileId={null} initialDensity={2} initialOffsets={{ D11: { x: 1.5, y: 0 } }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Connect printer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Demo printer' }));
    await userEvent.click(await screen.findByRole('button', { name: /print test/i }));
    await waitFor(() => expect(print).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ copies: 1, offset: { x: 1.5, y: 0 } })));
    print.mockRestore();
  });

  it('shades what the printhead misses and moves borders inside it', async () => {
    const frame = { ...createElement('frame', { widthMm: 30, heightMm: 15 }), id: 'border' };
    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 30, heightMm: 15, elements: [frame] }} initialProfileId={null} initialDensity={2} />);
    expect(document.querySelector('.unsafe-zone')).toBeNull();
    await connectDemo();
    // The design follows the 40 × 12 roll on connect; undo returns to 30 × 15, wider than the 12 mm head.
    fireEvent.keyDown(window, { key: 'z', metaKey: true, ctrlKey: true });
    await waitFor(() => expect(document.querySelector('.unsafe-zone')).not.toBeNull());
    fireEvent.pointerDown(document.querySelector('.canvas-el')!, { button: 0 });
    fireEvent.pointerUp(window);
    const y = Number((screen.getByRole('spinbutton', { name: 'Y' }) as HTMLInputElement).value);
    expect(y).toBeGreaterThanOrEqual(1.5);
  });

  it('marks details too fine for the printer and says what to change', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(document.querySelector('.print-issue-mark')).toBeNull();
    const stroke = screen.getByRole('spinbutton', { name: 'Stroke width' });
    await userEvent.clear(stroke);
    await userEvent.type(stroke, '0.1');
    expect(document.querySelector('.print-issue-mark')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Thinner than one printer dot');
  });

  it('offers to move a label onto 48 mm continuous paper when a thermal printer connects', async () => {
    const { printer, restore } = await useEscPosPrinter();
    onTestFinished(restore);
    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 30, heightMm: 15 }} initialProfileId={null} initialDensity={2} />);
    await act(() => printer.connect('bluetooth'));
    const dialog = await screen.findByRole('dialog', { name: 'Use 48 mm wide paper?' });
    expect(dialog).toHaveTextContent('MP583 prints on continuous paper 48 mm wide. This label is 30 × 15 mm.');
    const length = within(dialog).getByRole('spinbutton', { name: 'Length' });
    expect(length).toHaveValue(15);
    await userEvent.clear(length);
    await userEvent.type(length, '62');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use 48 × 62 mm' }));
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toHaveValue(48);
    expect(screen.getByRole('spinbutton', { name: 'Length' })).toHaveValue(62);
  });

  it('prints as wide as the paper on a printer whose head width is a guess', async () => {
    const { printer } = await import('../printer');
    const { EscPosPrinterClient } = await import('libniimai');
    const link = { name: 'MTP-4B_6DEF', write: async () => {}, onNotify: () => {}, onDisconnect: () => {}, disconnect: async () => {} };
    const target = printer as unknown as { createClient: () => Promise<unknown> };
    const original = target.createClient;
    target.createClient = async () => new EscPosPrinterClient(link, { prefix: '', confidence: 'medium', generic: true }, { chunkMs: 0, pauseMs: 1 });
    onTestFinished(() => void (target.createClient = original));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 48, heightMm: 25 }} initialProfileId={null} initialDensity={2} />);
    await act(() => printer.connect('bluetooth'));
    await userEvent.click(screen.getByRole('button', { name: 'Printer ready' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('48 mm print width')).toBeInTheDocument();
    const width = within(dialog).getByRole('spinbutton', { name: 'Paper width' });
    await userEvent.clear(width);
    await userEvent.type(width, '75');
    await waitFor(() => expect(within(dialog).getByText('72 mm print width')).toBeInTheDocument());
    expect(printer.getStatus().profile?.printheadPixels).toBe(576);
    // The width stays set when it matches the head, so it survives the next connection.
    await userEvent.clear(width);
    await userEvent.type(width, '72');
    expect(width).toHaveValue(72);
    expect(printer.getStatus().profile?.printheadPixels).toBe(576);
  });

  it('keeps a printer matched by its services, so it skips the NIIMBOT handshake next time', async () => {
    const { printer } = await import('../printer');
    const { EscPosPrinterClient } = await import('libniimai');
    const { getSetting } = await import('../storage/db');
    const link = { name: 'MTP-4B_6DEF', write: async () => {}, onNotify: () => {}, onDisconnect: () => {}, disconnect: async () => {} };
    const target = printer as unknown as { createClient: () => Promise<unknown> };
    const original = target.createClient;
    const remembered: unknown[] = [];
    target.createClient = async () =>
      Object.assign(new EscPosPrinterClient(link, { prefix: '', confidence: 'medium', generic: true }, { chunkMs: 0, pauseMs: 1 }), {
        matchedAs: 'escpos' as const,
        rememberMatches: (m: unknown) => remembered.push(m),
      });
    onTestFinished(() => void (target.createClient = original));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 48, heightMm: 25 }} initialProfileId={null} initialDensity={2} />);
    await act(() => printer.connect('bluetooth'));
    await waitFor(async () => expect(await getSetting('matchedPrinters')).toEqual({ 'MTP-4B_6DEF': 'escpos' }));
    await act(() => printer.disconnect());
    await act(() => printer.connect('bluetooth'));
    expect(remembered.at(-1)).toEqual({ 'MTP-4B_6DEF': 'escpos' });
  });

  it('sets a sticker roll in the printer window, feeds the paper, and prints each sticker followed by its gap', async () => {
    const { printer } = await import('../printer');
    const { EscPosPrinterClient, escposModelFor } = await import('libniimai');
    const sent: number[] = [];
    const link = { name: 'MP583', write: async (b: Uint8Array) => void sent.push(...b), onNotify: () => {}, onDisconnect: () => {}, disconnect: async () => {} };
    const target = printer as unknown as { createClient: () => Promise<unknown> };
    const original = target.createClient;
    target.createClient = async () => new EscPosPrinterClient(link, escposModelFor('MP583'), { chunkMs: 0, pauseMs: 1 });
    onTestFinished(() => void (target.createClient = original));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 48, heightMm: 25 }} initialProfileId={null} initialDensity={2} />);
    await act(() => printer.connect('bluetooth'));
    await userEvent.click(screen.getByRole('button', { name: 'Printer ready' }));
    const dialog = await screen.findByRole('dialog');
    // These printers have no reverse feed.
    expect(within(dialog).queryByRole('button', { name: 'Retract' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Feed' }));
    await waitFor(() => expect(sent).toEqual([0x1b, 0x33, 4, 0x0a, 0x1b, 0x32]));

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'Paper type' }), 'Stickers');
    const gap = within(dialog).getByRole('spinbutton', { name: 'Gap' });
    expect(gap).toHaveValue(2);
    await userEvent.clear(gap);
    await userEvent.type(gap, '3');
    expect(within(dialog).getByRole('combobox', { name: 'Paper type' })).toHaveValue('stickers');
    expect(within(dialog).getByText(/3 mm gap/)).toBeInTheDocument();

    // Narrower sticker paper: the label panel follows it.
    const paperWidth = within(dialog).getByRole('spinbutton', { name: 'Paper width' });
    expect(paperWidth).toHaveValue(48);
    await userEvent.clear(paperWidth);
    await userEvent.type(paperWidth, '40');
    expect(within(dialog).getByText(/Prints centred on the 48 mm head/)).toBeInTheDocument();

    sent.length = 0;
    // The printed page: the raster is stubbed, so hand the printer a blank one.
    const ink = { getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }), fillRect: () => {}, drawImage: () => {} };
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ink as never);
    onTestFinished(() => canvas.mockRestore());
    await userEvent.click(within(dialog).getByRole('button', { name: /Print test/ }));
    // 3 mm is 24 dots at 203 dpi, fed after the sticker with no tear-off feed.
    // The whole page streams out first, which takes a while on a slow machine.
    await waitFor(() => expect(sent.slice(-6)).toEqual([0x1b, 0x33, 24, 0x0a, 0x1b, 0x32]), { timeout: 10_000 });
    expect(sent.some((_, i) => sent[i] === 0x1b && sent[i + 1] === 0x64)).toBe(false);

    // The scale prints as one long strip across the head, with nothing fed after it.
    sent.length = 0;
    await userEvent.click(within(dialog).getByText('Line up stickers'));
    await userEvent.click(within(dialog).getByRole('button', { name: /Print scale/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Print the sticker scale?' })).getByRole('button', { name: 'Print scale' }));
    await waitFor(() => expect(sent.length).toBeGreaterThan(0), { timeout: 10_000 });
    expect(sent.some((_, i) => sent[i] === 0x1b && (sent[i + 1] === 0x64 || sent[i + 1] === 0x33))).toBe(false);
    // 40 × 30 mm stickers every 33 mm, centred on the 48 mm head: one from 10 to 40, the next at 43, the last at 76.
    expect(await within(dialog).findByRole('group', { name: 'Step 1 of 6' }, { timeout: 10_000 })).toBeInTheDocument();
    for (const [name, value] of [['Sticker top', '10'], ['Sticker bottom', '40'], ['Next sticker top', '43'], ['Last sticker top', '76'], ['Left edge', '4'], ['Right edge', '44']]) {
      const field = within(dialog).getByRole('spinbutton', { name });
      await userEvent.clear(field);
      await userEvent.type(field, value);
      await userEvent.click(within(dialog).getByRole('button', { name: /Next/ }));
    }
    expect(within(dialog).getByRole('status')).toHaveTextContent('40 × 30 mm stickers, 3 mm gap');
    sent.length = 0;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fix size, gap and position' }));
    // Sized for stickers about 30 mm, the 103 mm scale stopped 27 mm past the top at 76, so the paper feeds 6 mm (48 dots) to the next top at 109.
    await waitFor(() => expect(sent).toEqual([0x1b, 0x33, 48, 0x0a, 0x1b, 0x32]));
    expect(within(dialog).getByRole('spinbutton', { name: 'Label length' })).toHaveValue(30);
    expect(within(dialog).getByRole('spinbutton', { name: 'Paper width' })).toHaveValue(40);
    expect(within(dialog).getByRole('spinbutton', { name: 'Gap' })).toHaveValue(3);
    expect(within(dialog).getByRole('spinbutton', { name: 'Move right' })).toHaveValue(0);
    await userEvent.keyboard('{Escape}');
    const labelWidth = screen.getByRole('spinbutton', { name: 'Width' });
    expect(labelWidth).toHaveAttribute('max', '40');

    // Templates follow the sticker size the line-up found, and long formats are not offered first on stickers.
    await userEvent.click(screen.getByRole('button', { name: 'Templates' }));
    const library = await screen.findByRole('dialog', { name: 'Library' });
    expect(within(library).getByRole('radio', { name: '40 × 30' })).toHaveAttribute('aria-checked', 'true');
    expect(within(library).queryByRole('button', { name: /Continuous paper/ })).toBeNull();
    await userEvent.keyboard('{Escape}');

    // The 25 mm label is shorter than the 30 mm sticker: the rest of the sticker feeds before the gap, so the next print starts on a sticker.
    sent.length = 0;
    await userEvent.keyboard('{Control>}p{/Control}');
    const print = await screen.findByRole('dialog', { name: 'Print' });
    await userEvent.click(print.querySelector('.print-go')!);
    // 5 mm left on the sticker and the 3 mm gap: 8 mm, 64 dots.
    await waitFor(() => expect(sent.slice(-6)).toEqual([0x1b, 0x33, 64, 0x0a, 0x1b, 0x32]), { timeout: 10_000 });
  }, 30_000);

  it('remembers the label length set in the editor for the printer, and starts new labels on its paper', async () => {
    const { printer, restore } = await useEscPosPrinter();
    onTestFinished(restore);
    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 48, heightMm: 30 }} initialProfileId={null} initialDensity={2} />);
    await act(() => printer.connect('bluetooth'));
    const length = screen.getByRole('spinbutton', { name: 'Length' });
    await userEvent.clear(length);
    await userEvent.type(length, '62');
    // The printer window shows it, and it survives a reconnect.
    await act(() => printer.disconnect());
    await act(() => printer.connect('bluetooth'));
    await userEvent.click(screen.getByRole('button', { name: 'Printer ready' }));
    expect(within(await screen.findByRole('dialog')).getByRole('spinbutton', { name: 'Label length' })).toHaveValue(62);
    await userEvent.keyboard('{Escape}');
    fireEvent.keyDown(window, { key: 'n', metaKey: true, ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'New label' });
    expect(within(dialog).getByRole('button', { name: '48 × 62' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '48 × 15' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '40 × 12' })).toBeNull();
  });

  it('keeps NIIMBOT printing as it was: no receipt-printer controls, and the same print options', async () => {
    const stickerGaps = { D11: 3 };
    renderApp(<Editor initialDoc={starterDoc()} initialProfileId="escpos-58" initialDensity={2} initialStickerGaps={stickerGaps} initialPaperWidths={{ D11: 40 }} />);
    await connectDemo();
    const { printer } = await import('../printer');
    // The label panel keeps its roll sizes and paper types.
    expect(screen.getByRole('combobox', { name: 'Paper type' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Printer ready' }));
    const dialog = await screen.findByRole('dialog');
    for (const name of ['Feed', 'Retract']) expect(within(dialog).queryByRole('button', { name })).toBeNull();
    expect(within(dialog).queryByRole('spinbutton', { name: 'Paper width' })).toBeNull();
    expect(within(dialog).queryByRole('spinbutton', { name: 'Label length' })).toBeNull();
    const print = vi.spyOn(printer, 'print');
    await userEvent.click(within(dialog).getByRole('button', { name: /Print test/ }));
    await waitFor(() => expect(print).toHaveBeenCalled());
    expect(print.mock.calls[0][1]).toEqual({ density: 2, copies: 1, offset: { x: 0, y: 0 }, labelType: 1 });
  });

  it('shares the label length between the printer window and the start screen', async () => {
    const { printer, restore } = await useEscPosPrinter();
    onTestFinished(restore);
    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 48, heightMm: 30 }} initialProfileId={null} initialDensity={2} initialView="start" />);
    await act(() => printer.connect('bluetooth'));
    await userEvent.click(screen.getByRole('button', { name: 'Printer settings' }));
    const dialog = await screen.findByRole('dialog');
    const length = within(dialog).getByRole('spinbutton', { name: 'Label length' });
    expect(length).toHaveValue(30);
    await userEvent.clear(length);
    await userEvent.type(length, '25');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('spinbutton', { name: 'Length' })).toHaveValue(25);
    await userEvent.click(screen.getByRole('button', { name: /new label/i }));
    expect(await screen.findByRole('spinbutton', { name: 'Length' })).toHaveValue(25);
  });

  it('keeps the label when asked, and does not ask again on this connection', async () => {
    const { printer, restore } = await useEscPosPrinter();
    onTestFinished(restore);
    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 30, heightMm: 15 }} initialProfileId={null} initialDensity={2} />);
    await act(() => printer.connect('bluetooth'));
    await userEvent.click(await screen.findByRole('button', { name: 'Keep 30 × 15' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toHaveValue(30);
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    expect(screen.queryByRole('dialog', { name: 'Use 48 mm wide paper?' })).toBeNull();
  });

  it('zooms the canvas with buttons and shortcuts, and fits again', async () => {
    renderEditor();
    const level = screen.getByRole('button', { name: 'Fit to view' });
    expect(level).toHaveTextContent('Fit');
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(level).toHaveTextContent(/^\d+%$/);
    const zoomed = Number.parseInt(level.textContent!, 10);
    fireEvent.keyDown(window, { key: '=', metaKey: true, ctrlKey: true });
    await waitFor(() => expect(Number.parseInt(level.textContent!, 10)).toBeGreaterThan(zoomed));
    fireEvent.keyDown(window, { key: '-', metaKey: true, ctrlKey: true });
    await waitFor(() => expect(Number.parseInt(level.textContent!, 10)).toBe(zoomed));
    fireEvent.keyDown(window, { key: '0', metaKey: true, ctrlKey: true });
    await waitFor(() => expect(level).toHaveTextContent('Fit'));
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    await userEvent.click(level);
    expect(level).toHaveTextContent('Fit');
  });

  it('shows the size of the selected element under it', async () => {
    renderEditor();
    expect(document.querySelector('.size-tag')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const w = Number((screen.getByRole('spinbutton', { name: 'Width' }) as HTMLInputElement).value);
    const h = Number((screen.getByRole('spinbutton', { name: 'Height' }) as HTMLInputElement).value);
    expect(document.querySelector('.size-tag')).toHaveTextContent(`${w} × ${h} mm`);
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

  it('asks for the size of a roll the printer cannot measure, offering sizes that suit it', async () => {
    const { MockClient } = await import('libniimai');
    const spy = vi.spyOn(MockClient.prototype, 'getRfidInfo').mockReturnValue({
      labelRfidInfo: { tagPresent: true, barCode: 'roll-1', allPaper: 10, usedPaper: 1, consumablesType: 1 },
      paperInfo: undefined,
    });
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Connect printer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Demo printer' }));
    const dialog = await screen.findByRole('dialog', { name: 'What size is this roll?' });
    // The demo printer has a 12 mm head, so only strip labels are offered.
    expect(within(dialog).queryByRole('button', { name: '50 × 50' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: '30 × 15' }));
    await waitFor(() => expect(screen.getByRole('img', { name: /30 × 15 mm/ })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Label size: 30 × 15 mm' })).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole('button', { name: /new 40 × 12 label/i }));
    expect(screen.getByRole('img', { name: /40 × 12 mm/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Start screen' }));
    expect(screen.getByRole('heading', { name: 'What are we labelling?' })).toBeInTheDocument();
  });

  it('shows no open label on the start screen', async () => {
    renderApp(<Editor initialDoc={starterDoc()} initialProfileId={null} initialDensity={2} initialView="start" />);
    expect(screen.queryByRole('textbox', { name: 'Label name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^print/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Blank 40 × 12 mm' }));
    expect(screen.getByRole('textbox', { name: 'Label name' })).toBeInTheDocument();
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

  it('shades a cable label tail and keeps new elements on the flag', async () => {
    const { createDoc } = await import('../doc/model');
    renderApp(<Editor initialDoc={createDoc({ widthMm: 109, heightMm: 12.5, tailMm: 35 })} initialProfileId={null} initialDensity={2} />);
    expect(document.querySelector('.tail-zone rect[x="74"]')).not.toBeNull();
    expect(screen.getByText(/74 \+ 35 × 12.5 mm · tail blank/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const x = Number((screen.getByRole('spinbutton', { name: 'X' }) as HTMLInputElement).value);
    const w = Number((screen.getByRole('spinbutton', { name: 'Width' }) as HTMLInputElement).value);
    expect(x + w).toBeLessThanOrEqual(74);
  });

  it('shows the fold line and a preview of the repeated half', async () => {
    const { createDoc, createElement } = await import('../doc/model');
    const doc = createDoc({ widthMm: 109, heightMm: 12.5, tailMm: 35, fold: 'copy' });
    doc.elements.push(createElement('rect', { widthMm: 37, heightMm: 12.5 }));
    renderApp(<Editor initialDoc={doc} initialProfileId={null} initialDensity={2} />);
    expect(document.querySelector('.fold-line')?.getAttribute('x1')).toBe('37');
    expect(document.querySelector('.mirror-preview g[transform="translate(37 0)"]')).not.toBeNull();
    expect(screen.getByText(/mirrored/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Separate' }));
    expect(document.querySelector('.mirror-preview')).toBeNull();
    expect(document.querySelector('.fold-line')).not.toBeNull();
    await userEvent.click(screen.getByText('Custom size'));
    await userEvent.click(screen.getByRole('button', { name: 'Fold in the middle' }));
    expect(document.querySelector('.fold-line')).toBeNull();
  });

  it('prints with the paper type the roll reports, or the one chosen', async () => {
    const { printer } = await import('../printer');
    const print = vi.spyOn(printer, 'print').mockResolvedValue();
    renderEditor();
    await connectDemo();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Paper type' }), 'Continuous');
    fireEvent.keyDown(window, { key: 'p', metaKey: true, ctrlKey: true });
    await userEvent.click(await screen.findByRole('button', { name: /^print$/i }));
    await waitFor(() => expect(print).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ labelType: 3 })));
    print.mockRestore();
  });

  it('turns the artboard landscape, keeps the paper, and prints turned onto it', async () => {
    const { printer } = await import('../printer');
    const print = vi.spyOn(printer, 'print').mockResolvedValue();
    const { createDoc } = await import('../doc/model');
    renderApp(<Editor initialDoc={createDoc({ widthMm: 50, heightMm: 30 })} initialProfileId={null} initialDensity={2} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Landscape' }));
    expect(screen.getByRole('img', { name: /30 × 50 mm/ })).toBeInTheDocument();
    // The label panel keeps showing the paper.
    expect(screen.getByRole('button', { name: 'Label size: 50 × 30 mm' })).toBeInTheDocument();
    // Cable and flag labels wrap along the paper, so they are not offered.
    await userEvent.click(screen.getByText('Custom size'));
    expect(screen.queryByRole('button', { name: 'Cable label' })).toBeNull();
    // The loaded 40 × 12 roll resizes the paper, and the artboard follows turned.
    await connectDemo();
    await waitFor(() => expect(screen.getByRole('img', { name: /12 × 40 mm/ })).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(window, { key: 'p', metaKey: true, ctrlKey: true });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Match the roll' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: /^print$/i }));
    await waitFor(() => expect(print).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ rotate: 90 })));
    print.mockRestore();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('radio', { name: 'Portrait' }));
    expect(screen.getByRole('img', { name: /40 × 12 mm/ })).toBeInTheDocument();
  });

  it('keeps cable labels portrait', async () => {
    renderEditor();
    await userEvent.click(screen.getByText('Custom size'));
    await userEvent.click(screen.getByRole('button', { name: 'Cable label' }));
    expect(screen.queryByRole('radiogroup', { name: 'Orientation' })).toBeNull();
  });

  it('turns a label into a cable label and back from the settings', async () => {
    renderEditor();
    await userEvent.click(screen.getByText('Custom size'));
    await userEvent.click(screen.getByRole('button', { name: 'Cable label' }));
    expect(document.querySelector('.tail-zone')).not.toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Tail length' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Label size:/ }));
    await userEvent.click(screen.getByRole('option', { name: /^40 × 12 mm/ }));
    expect(document.querySelector('.tail-zone')).toBeNull();
  });

  it('opens in-place text editing from the Edit text button', async () => {
    renderEditor();
    fireEvent.pointerDown(elements()[0], { button: 0 });
    fireEvent.pointerUp(window);
    await userEvent.click(screen.getByRole('button', { name: 'Edit text' }));
    expect(screen.getByRole('textbox', { name: 'Edit text' })).toHaveFocus();
  });

  it('takes the file name once saved, records the printer, and renames only through Save as', async () => {
    const { printer, restore } = await useEscPosPrinter();
    onTestFinished(restore);
    const written: string[] = [];
    const handle = (name: string) => ({
      name,
      getFile: async () => new File([], name),
      createWritable: async () => ({ write: async (t: string) => void written.push(t), close: async () => {} }),
    });
    const picker = vi.fn(async () => handle('Pantry jars.niimai'));
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = picker;
    onTestFinished(() => void delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker);
    renderApp(<Editor initialDoc={{ ...starterDoc(), widthMm: 48, heightMm: 30 }} initialProfileId={null} initialDensity={2} />);
    expect(document.title).toBe('My label · niimai');
    await act(() => printer.connect('bluetooth'));
    await userEvent.keyboard('{Control>}s{/Control}');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Label name' })).toBeNull());
    const name = screen.getByRole('button', { name: 'Pantry jars' });
    expect(document.querySelector('.doc-printer')).toHaveTextContent('MP583');
    expect(document.title).toBe('Pantry jars · niimai');
    expect(JSON.parse(written[0])).toMatchObject({ printer: 'MP583' });
    // Undo leaves the file name alone.
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('button', { name: 'Pantry jars' })).toBeInTheDocument();
    picker.mockResolvedValueOnce(handle('Spice jars.niimai'));
    await userEvent.click(name);
    expect(await screen.findByRole('button', { name: 'Spice jars' })).toBeInTheDocument();
  });

  it('names an opened label after its file and keeps the demo out of it', async () => {
    const text = JSON.stringify({ ...starterDoc(), name: 'Inside name', printer: 'D110' });
    const file = { name: 'Garage shelf.niimai', getFile: async () => new File([text], 'Garage shelf.niimai'), createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
    (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = async () => [file];
    onTestFinished(() => void delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker);
    renderEditor();
    await connectDemo();
    expect(document.querySelector('.doc-printer')).toBeNull();
    await userEvent.keyboard('{Control>}o{/Control}');
    expect(await screen.findByRole('button', { name: 'Garage shelf' })).toBeInTheDocument();
    expect(document.querySelector('.doc-printer')).toHaveTextContent('D110');
  });

  it('turns text dynamic and counts numbers across a batch', async () => {
    const doc = starterDoc();
    renderApp(<Editor initialDoc={{ ...doc, elements: [{ ...createElement('text', doc), text: 'SN' } as never] }} initialProfileId={null} initialDensity={2} />);
    await userEvent.click(elements()[0]);
    await userEvent.click(screen.getByRole('switch', { name: 'Dynamic' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Insert field' })).getByRole('button', { name: /Number/ }));
    expect(screen.getAllByRole('listitem').map((p) => p.textContent)).toEqual(['SN ', 'Number']);
    expect(elements()[0].querySelector('text')).toHaveTextContent('SN 1');
    const { printer } = await import('../printer');
    const print = vi.spyOn(printer, 'print').mockResolvedValue();
    onTestFinished(() => print.mockRestore());
    await connectDemo();
    await userEvent.keyboard('{Control>}p{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Print' });
    const labels = within(dialog).getByRole('spinbutton', { name: 'Labels' });
    await userEvent.clear(labels);
    await userEvent.type(labels, '3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Print 3' }));
    await waitFor(() => expect(print).toHaveBeenCalledWith(expect.objectContaining({ count: 3 }), expect.objectContaining({ copies: 1 })));
    // The next run carries on where this one stopped.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Print' })).toBeNull());
    await userEvent.click(elements()[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Number options' }));
    expect(await screen.findByRole('spinbutton', { name: 'Start' })).toHaveValue(4);
  });

  it('keeps what was printed when dynamic is switched off, and brings the fields back', async () => {
    const doc = starterDoc();
    renderApp(<Editor initialDoc={{ ...doc, sequence: { start: 7, step: 1, digits: 3 }, elements: [{ ...createElement('text', doc), text: 'SN-{{Number}}', dynamic: true } as never] }} initialProfileId={null} initialDensity={2} />);
    await userEvent.click(elements()[0]);
    await userEvent.click(screen.getByRole('switch', { name: 'Dynamic' }));
    expect(elements()[0].querySelector('text')).toHaveTextContent('SN-007');
    expect(screen.queryByRole('list', { name: 'Dynamic content' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Dynamic' }));
    expect(screen.getByText('Its fields are kept. Switch on to bring them back.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Dynamic' }));
    expect(screen.getAllByRole('listitem').map((p) => p.textContent)).toEqual(['SN-', 'Number']);
  });

  it('fills fields from an added sheet and steps through its rows', async () => {
    const csv = 'Name,SKU\nCoffee,100\nTea,200\n';
    const file = { name: 'items.csv', getFile: async () => new File([csv], 'items.csv'), createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
    (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = async () => [file];
    onTestFinished(() => void delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker);
    const doc = starterDoc();
    renderApp(<Editor initialDoc={{ ...doc, elements: [{ ...createElement('text', doc), text: '{{Name}}', dynamic: true } as never] }} initialProfileId={null} initialDensity={2} />);
    expect(screen.getByText('Needs a sheet for {{Name}}')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add sheet' }));
    expect(await screen.findByText('items.csv')).toBeInTheDocument();
    expect(elements()[0].querySelector('text')).toHaveTextContent('Coffee');
    expect(screen.getByText('Row 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next row' }));
    expect(elements()[0].querySelector('text')).toHaveTextContent('Tea');
    await userEvent.click(screen.getByRole('button', { name: 'Remove sheet' }));
    expect(screen.queryByText('Row 1 of 2')).toBeNull();
  });

  it('folds panel sections, with position closed and style open to begin with, and remembers the choice', async () => {
    localStorage.removeItem('niimai:sections');
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const position = screen.getByRole('button', { name: 'Rectangle' });
    expect(position).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('spinbutton', { name: 'X' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Stroke' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(position);
    expect(screen.getByRole('spinbutton', { name: 'X' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('niimai:sections')!)).toEqual({ position: true });
    // Layer and delete buttons stay in the header while it is closed.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('keeps Dynamic in its own section after the style, opened by its switch', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Add text' }));
    await userEvent.keyboard('{Escape}');
    const titles = [...document.querySelectorAll('.inspector .section-toggle')].map((b) => b.textContent);
    expect(titles).toEqual(['Text', 'Style', 'Dynamic']);
    expect(screen.getByRole('button', { name: 'Dynamic' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(screen.getByRole('switch', { name: 'Dynamic' }));
    expect(screen.getByRole('button', { name: 'Dynamic' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Insert field' })).toBeInTheDocument();
  });

  it('offers the file and help actions from the More menu', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('menu', { name: 'More' });
    expect(within(menu).getByRole('menuitem', { name: 'Undo' })).toBeDisabled();
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Library' }));
    expect(await screen.findByRole('dialog', { name: 'Library' })).toBeInTheDocument();
  });

  it('has a GitHub link, help and about', () => {
    renderEditor();
    expect(screen.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute('href', 'https://github.com/theanam/niimai');
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '#/help');
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '#/about');
  });
});
