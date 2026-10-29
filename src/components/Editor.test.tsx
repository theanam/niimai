import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    await userEvent.click(screen.getByRole('button', { name: 'Add QR code' }));
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
    const { MockClient } = await import('../printer/mock');
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
