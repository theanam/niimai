import { screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { resetDbConnection, saveLabel, listLabels } from '../storage/db';
import userEvent from '@testing-library/user-event';
import { createDoc } from '../doc/model';
import { renderApp } from '../test/render';
import { StartScreen } from './StartScreen';

const renderStart = (onBrowseTemplates = vi.fn(), extra: Partial<Parameters<typeof StartScreen>[0]> = {}) => {
  renderApp(
    <StartScreen
      status={{ state: 'disconnected', profile: null }}
      roll={{ size: null, key: null, needsSize: false }}
      defaultSize={{ widthMm: 50, heightMm: 30 }}
      onConnect={async () => {}}
      onSetRollSize={() => {}}
      onPrinterSettings={() => {}}
      onOpen={() => {}}
      onBlank={() => {}}
      onBrowseTemplates={onBrowseTemplates}
      {...extra}
    />,
  );
  return onBrowseTemplates;
};

describe('start screen', () => {
  it('shows a spinner on the connect button until the printer connects, keeping the button the same', async () => {
    let done = () => {};
    renderStart(vi.fn(), { onConnect: () => new Promise<void>((r) => (done = r)) });
    const demo = screen.getByRole('button', { name: /Demo/ });
    await userEvent.click(demo);
    expect(demo).toHaveAttribute('aria-busy', 'true');
    expect(demo.querySelector('.spin')).not.toBeNull();
    expect(demo).toHaveTextContent('Demo');
    expect(screen.getByRole('button', { name: /Bluetooth/ })).toBeDisabled();
    done();
    await waitFor(() => expect(demo).toHaveAttribute('aria-busy', 'false'));
    expect(demo.querySelector('.spin')).toBeNull();
  });

  it('says why Bluetooth is unavailable and links to the fix', () => {
    renderStart();
    // jsdom has no Web Bluetooth.
    expect(screen.getByText(/Needs Chrome or Edge\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How to fix' })).toHaveAttribute('href', '#/help/browsers');
  });

  it('offers the other USB list when the browser has both', async () => {
    const onConnect = vi.fn(async () => {});
    Object.defineProperty(navigator, 'serial', { value: {}, configurable: true });
    Object.defineProperty(navigator, 'usb', { value: { getDevices: async () => [], addEventListener() {}, removeEventListener() {} }, configurable: true });
    try {
      renderStart(vi.fn(), { onConnect });
      await userEvent.click(screen.getByRole('button', { name: /^USB$/ }));
      expect(onConnect).toHaveBeenLastCalledWith('serial');
      await userEvent.click(screen.getByRole('button', { name: 'USB printer not listed?' }));
      expect(onConnect).toHaveBeenLastCalledWith('usb');
    } finally {
      delete (navigator as unknown as Record<string, unknown>).serial;
      delete (navigator as unknown as Record<string, unknown>).usb;
    }
  });

  it('filters templates as you type', async () => {
    renderStart();
    const suggested = screen.getByRole('list', { name: 'Suggested templates' });
    expect(suggested.children.length).toBeGreaterThan(0);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'perfume');
    const matches = screen.getByRole('list', { name: 'Matching templates' });
    expect(matches.textContent?.toLowerCase()).toMatch(/perfume|decant|sample|tester/);
  });

  it('opens the library with the search', async () => {
    const browse = renderStart();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'perfume');
    await userEvent.click(screen.getByRole('button', { name: /see all matches/i }));
    expect(browse).toHaveBeenCalledWith({ query: 'perfume' });
  });

  it('opens every template', async () => {
    const browse = renderStart();
    await userEvent.click(screen.getByRole('button', { name: /all [\d,]+ templates/i }));
    expect(browse).toHaveBeenCalledWith(undefined);
  });

  it('says when nothing matches', async () => {
    renderStart();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'zzqqxx');
    expect(screen.getByText('No templates match at this size.')).toBeInTheDocument();
  });

  it('starts a label or templates from the loaded roll once connected', async () => {
    const onBlank = vi.fn();
    const browse = renderStart(vi.fn(), {
      status: { state: 'ready', profile: null, deviceName: 'D110', battery: 25, label: { remaining: 124 } },
      roll: { size: { widthMm: 30, heightMm: 15 }, key: 'r', needsSize: false, name: 'White 30 × 15' },
      onBlank,
    });
    expect(screen.getByText('124 labels left')).toBeInTheDocument();
    expect(screen.getByText('White 30 × 15')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /new 30 × 15 label/i }));
    expect(onBlank).toHaveBeenCalledWith({ widthMm: 30, heightMm: 15 });
    await userEvent.click(screen.getByRole('button', { name: /templates for this roll/i }));
    expect(browse).toHaveBeenCalledWith();
  });

  it('asks for the roll size when the printer cannot report it', async () => {
    const onSetRollSize = vi.fn();
    renderStart(vi.fn(), { status: { state: 'ready', profile: null }, roll: { size: null, key: 'r', needsSize: true }, onSetRollSize });
    await userEvent.click(screen.getByRole('button', { name: /set roll size/i }));
    expect(onSetRollSize).toHaveBeenCalled();
  });

  it('opens the printer settings from the connected printer', async () => {
    const onPrinterSettings = vi.fn();
    renderStart(vi.fn(), { status: { state: 'ready', profile: null, deviceName: 'MP583' }, onPrinterSettings });
    expect(screen.getByRole('heading', { name: 'MP583' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Printer settings' }));
    expect(onPrinterSettings).toHaveBeenCalled();
  });

  it('shows the sticker roll on a continuous-paper printer and opens its paper settings', async () => {
    const onPrinterSettings = vi.fn();
    const thermal = { id: 'auto:MP583', name: 'MP583', kind: 'thermal', dpi: 203, printheadPixels: 384, printDirection: 'top', printTask: 'B1', densityMin: 1, densityMax: 1, densityDefault: 1 } as const;
    renderStart(vi.fn(), { status: { state: 'ready', profile: thermal, canFeed: true }, stickerGap: 2.5, onPrinterSettings });
    const paper = screen.getByRole('button', { name: 'Paper settings' });
    expect(paper).toHaveTextContent('Stickers');
    expect(paper).toHaveTextContent('2.5 mm gap');
    await userEvent.click(paper);
    expect(onPrinterSettings).toHaveBeenCalled();
  });

  it('offers templates for the sticker size on a sticker roll, and long formats first only on continuous paper', () => {
    const thermal = { id: 'auto:MP583', name: 'MP583', kind: 'thermal', dpi: 203, printheadPixels: 384, printDirection: 'top', printTask: 'B1', densityMin: 1, densityMax: 1, densityDefault: 1 } as const;
    renderStart(vi.fn(), { status: { state: 'ready', profile: thermal, canFeed: true }, stickerGap: 2, defaultSize: { widthMm: 40, heightMm: 30 } });
    expect(screen.getByText(/laid out for 40 × 30 mm/)).toBeInTheDocument();
    expect(screen.queryByText(/Lists, planners and notes/)).toBeNull();
  });

  it('offers long-format templates first on continuous paper', () => {
    const thermal = { id: 'auto:MP583', name: 'MP583', kind: 'thermal', dpi: 203, printheadPixels: 384, printDirection: 'top', printTask: 'B1', densityMin: 1, densityMax: 1, densityDefault: 1 } as const;
    renderStart(vi.fn(), { status: { state: 'ready', profile: thermal, canFeed: true } });
    expect(screen.getByText(/Lists, planners and notes/)).toBeInTheDocument();
  });

  it('deletes any recent label after confirming', async () => {
    globalThis.indexedDB = new IDBFactory();
    resetDbConnection();
    await saveLabel({ ...createDoc(), name: 'Last used' });
    await saveLabel({ ...createDoc(), name: 'Old label' });
    renderStart();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Last used' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Last used' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Delete Old label' })).toBeInTheDocument();
    expect((await listLabels()).map((d) => d.name)).toEqual(['Old label']);
  });

  it('shows the printer each recent label was made for, and every label on request', async () => {
    globalThis.indexedDB = new IDBFactory();
    resetDbConnection();
    for (let i = 1; i <= 8; i++) await saveLabel({ ...createDoc(), name: `Label ${i}`, updatedAt: i, ...(i === 8 ? { printer: 'D110' } : {}) });
    renderStart();
    const recent = await screen.findByRole('list', { name: 'Recent labels' });
    expect(recent.children).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Open Label 8' })).toHaveTextContent('D110');
    await userEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(recent.children).toHaveLength(8);
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(recent.children).toHaveLength(6);
  });

  it('starts a 48 mm label of any length on continuous paper', async () => {
    const onBlank = vi.fn();
    renderStart(vi.fn(), {
      status: { state: 'ready', profile: { id: 'auto:MX06', name: 'MX06', dpi: 203, printheadPixels: 384, printDirection: 'top', printTask: 'B1', densityMin: 1, densityMax: 5, densityDefault: 3, kind: 'thermal' } },
      onBlank,
    });
    expect(screen.getByText('Continuous paper')).toBeInTheDocument();
    const length = screen.getByRole('spinbutton', { name: 'Length' });
    await userEvent.clear(length);
    await userEvent.type(length, '62');
    await userEvent.click(screen.getByRole('button', { name: /new label/i }));
    expect(onBlank).toHaveBeenCalledWith({ widthMm: 48, heightMm: 62 });
  });
});
