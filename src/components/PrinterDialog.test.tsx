import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { findManualProfile, type PrinterStatus } from 'libniimai';
import { renderApp } from '../test/render';
import { PrinterDialog } from './PrinterDialog';

const base = {
  open: true,
  onOpenChange: () => {},
  rollSize: null,
  manualProfileId: null,
  onConnect: async () => {},
  onDisconnect: async () => {},
  onManualProfile: () => {},
  onAlignmentTest: async () => {},
  offset: { x: 0, y: 0 },
  onOffset: () => {},
};
const ready = (extra: Partial<PrinterStatus> = {}): PrinterStatus => ({
  state: 'ready',
  profile: findManualProfile('b21')!,
  detectedModel: 'B21_C2B',
  deviceName: 'B21-C2BE513050609',
  battery: 64,
  ...extra,
});

describe('printer dialog', () => {
  it('lets a printer that never senses rolls set, then change, the roll size', async () => {
    const onSetRollSize = vi.fn();
    const label = { barcode: 'printer:QR380A-02B55B', manual: true };
    const { unmount } = renderApp(<PrinterDialog {...base} status={ready({ label })} rollNeedsSize rollManual onSetRollSize={onSetRollSize} />);
    await userEvent.click(screen.getByRole('button', { name: /Tell niimai this roll's size/ }));
    expect(screen.getByText(/remembers it for this printer/)).toBeInTheDocument();
    unmount();
    renderApp(<PrinterDialog {...base} status={ready({ label })} rollSize={{ widthMm: 76, heightMm: 100 }} rollManual onSetRollSize={onSetRollSize} />);
    await userEvent.click(screen.getByRole('button', { name: /Change roll size/ }));
    expect(onSetRollSize).toHaveBeenCalledTimes(2);
  });

  it('offers no roll size change for printers that read their rolls', () => {
    renderApp(<PrinterDialog {...base} status={ready({ label: { barcode: 'b' } })} rollSize={{ widthMm: 50, heightMm: 30 }} onSetRollSize={() => {}} />);
    expect(screen.queryByRole('button', { name: /Change roll size/ })).not.toBeInTheDocument();
  });

  it('offers each way to connect and explains what is unavailable', async () => {
    const onConnect = vi.fn(async () => {});
    renderApp(<PrinterDialog {...base} status={{ state: 'disconnected', profile: null }} onConnect={onConnect} />);
    expect(screen.getByRole('heading', { name: 'Connect a printer' })).toBeInTheDocument();
    // jsdom has neither Web Bluetooth nor Web Serial.
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toBeDisabled();
    expect(screen.getAllByText(/Needs Chrome or Edge/).length).toBe(2);
    expect(screen.getByRole('link', { name: 'How to fix Bluetooth and USB' })).toHaveAttribute('href', '#/help/browsers');
    await userEvent.click(screen.getByRole('button', { name: 'Demo printer' }));
    expect(onConnect).toHaveBeenCalledWith('demo');
  });

  it('sends USB to printers when a label printer type is picked', async () => {
    const onConnect = vi.fn(async () => {});
    Object.defineProperty(navigator, 'serial', { value: {}, configurable: true });
    Object.defineProperty(navigator, 'usb', { value: { getDevices: async () => [], addEventListener() {}, removeEventListener() {} }, configurable: true });
    try {
      renderApp(<PrinterDialog {...base} manualProfileId="tspl" status={{ state: 'disconnected', profile: null }} onConnect={onConnect} />);
      await userEvent.click(screen.getByRole('button', { name: 'USB cable' }));
      expect(onConnect).toHaveBeenLastCalledWith('usb');
      await userEvent.click(screen.getByRole('button', { name: /USB printer not listed/ }));
      expect(onConnect).toHaveBeenLastCalledWith('serial');
    } finally {
      delete (navigator as unknown as Record<string, unknown>).serial;
      delete (navigator as unknown as Record<string, unknown>).usb;
    }
  });

  it('shows the connected printer with battery and roll meters', () => {
    renderApp(
      <PrinterDialog {...base} status={ready({ label: { remaining: 137, capacity: 276 } })} rollSize={{ widthMm: 50, heightMm: 30 }} />,
    );
    expect(screen.getByRole('heading', { name: 'B21 family' })).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('50 × 30 mm')).toBeInTheDocument();
    expect(screen.getByText('137 labels left')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Roll' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('warns about an open lid and missing labels', () => {
    renderApp(<PrinterDialog {...base} status={ready({ lidClosed: false, paperInserted: false })} />);
    expect(screen.getByText('Lid is open')).toBeInTheDocument();
    expect(screen.getByText('No labels loaded')).toBeInTheDocument();
  });

  it('asks for the roll size when the printer cannot measure it', async () => {
    const onSetRollSize = vi.fn();
    renderApp(<PrinterDialog {...base} status={ready({ label: { barcode: 'x' } })} rollNeedsSize onSetRollSize={onSetRollSize} />);
    await userEvent.click(screen.getByRole('button', { name: /this roll's size/ }));
    expect(onSetRollSize).toHaveBeenCalled();
  });

  it('opens the printer type picker by itself for unrecognised printers', () => {
    renderApp(<PrinterDialog {...base} status={ready({ detectedModel: undefined, profile: null })} />);
    expect(screen.getByText('Printer not recognised').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Pick the closest type to start printing.')).toBeInTheDocument();
  });

  it('disconnects', async () => {
    const onDisconnect = vi.fn(async () => {});
    renderApp(<PrinterDialog {...base} status={ready()} onDisconnect={onDisconnect} />);
    await userEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(onDisconnect).toHaveBeenCalled();
  });

  it('prints a ruler test and nudges the print position', async () => {
    const onAlignmentTest = vi.fn(async () => {});
    const onOffset = vi.fn();
    renderApp(<PrinterDialog {...base} status={ready()} onAlignmentTest={onAlignmentTest} onOffset={onOffset} offset={{ x: 0.5, y: 0 }} />);
    expect(screen.queryByRole('button', { name: /calibrat/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /print test/i }));
    expect(onAlignmentTest).toHaveBeenCalled();
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Move down' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Move down' }), '-1');
    expect(onOffset).toHaveBeenLastCalledWith({ x: 0.5, y: -1 });
    await userEvent.click(screen.getByRole('button', { name: 'Reset position' }));
    expect(onOffset).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });

  it('cannot print a test while printing', () => {
    renderApp(<PrinterDialog {...base} status={ready({ state: 'printing' })} />);
    expect(screen.getByRole('button', { name: /print test/i })).toBeDisabled();
  });

  it('shows continuous paper for a cat printer and keeps the roll meter for NIIMBOT', () => {
    const cat = { ...findManualProfile('b1')!, id: 'auto:MX06', name: 'MX06', kind: 'thermal' as const };
    const { unmount } = renderApp(<PrinterDialog {...base} status={ready({ profile: cat, detectedModel: 'MX06' })} />);
    expect(screen.getByText('Continuous')).toBeInTheDocument();
    expect(screen.getByText('48 mm print width')).toBeInTheDocument();
    unmount();
    renderApp(<PrinterDialog {...base} status={ready()} rollSize={{ widthMm: 50, heightMm: 30 }} />);
    expect(screen.queryByText('Continuous')).toBeNull();
    expect(screen.getByText('50 × 30 mm')).toBeInTheDocument();
  });

  it('names the demo printer once', () => {
    renderApp(<PrinterDialog {...base} status={ready({ profile: { ...findManualProfile('d11')!, name: 'Demo printer' }, deviceName: 'Demo printer' })} />);
    expect(screen.getByRole('heading', { name: 'Demo printer' })).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('moves the paper half a millimetre per click on printers that cannot sense it, back only where the printer can', async () => {
    localStorage.removeItem('niimai:feedStep');
    const onFeed = vi.fn(async () => {});
    const { unmount } = renderApp(<PrinterDialog {...base} status={ready()} onFeed={onFeed} />);
    expect(screen.queryByRole('button', { name: 'Feed' })).not.toBeInTheDocument();
    unmount();
    const { rerender } = renderApp(<PrinterDialog {...base} status={ready({ canFeed: true })} onFeed={onFeed} />);
    expect(screen.queryByRole('button', { name: 'Retract' })).not.toBeInTheDocument();
    rerender(<PrinterDialog {...base} status={ready({ canFeed: true, canRetract: true })} onFeed={onFeed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Feed' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retract' }));
    expect(onFeed.mock.calls).toEqual([[0.5], [-0.5]]);
    rerender(<PrinterDialog {...base} status={ready({ canFeed: true, state: 'printing' })} onFeed={onFeed} />);
    expect(screen.getByRole('button', { name: 'Feed' })).toBeDisabled();
  });

  it('feeds by the length the user sets, and remembers it', async () => {
    localStorage.removeItem('niimai:feedStep');
    const onFeed = vi.fn(async () => {});
    const { unmount } = renderApp(<PrinterDialog {...base} status={ready({ canFeed: true })} onFeed={onFeed} />);
    const length = screen.getByRole('spinbutton', { name: 'Feed length' });
    expect(length).toHaveValue(0.5);
    await userEvent.clear(length);
    await userEvent.type(length, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Feed' }));
    expect(onFeed).toHaveBeenLastCalledWith(5);
    unmount();
    renderApp(<PrinterDialog {...base} status={ready({ canFeed: true })} onFeed={onFeed} />);
    expect(screen.getByRole('spinbutton', { name: 'Feed length' })).toHaveValue(5);
    localStorage.removeItem('niimai:feedStep');
  });

  it('sets a narrower paper width, and notes which part of wider paper prints', async () => {
    const onPaperWidth = vi.fn();
    const props = { ...base, status: ready({ canFeed: true }), headWidth: 48, onPaperWidth };
    const { rerender } = renderApp(<PrinterDialog {...props} paperWidth={48} />);
    const width = screen.getByRole('spinbutton', { name: 'Paper width' });
    expect(width).toHaveValue(48);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.clear(width);
    await userEvent.type(width, '40');
    expect(onPaperWidth).toHaveBeenLastCalledWith(40);
    rerender(<PrinterDialog {...props} paperWidth={40} />);
    expect(screen.getByText(/Prints centred on the 48 mm head/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<PrinterDialog {...props} paperWidth={58} labelLength={30} onLabelLength={onPaperWidth} />);
    // Width and length sit side by side.
    expect(screen.getByRole('spinbutton', { name: 'Label length' })).toHaveValue(30);
    // Wider paper is fine: a quiet note says which part prints.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Prints the middle 48 mm/)).toBeInTheDocument();
  });

  it('switches a printer that cannot sense the paper between continuous paper and stickers', async () => {
    const onStickerGap = vi.fn();
    const thermal = { ...findManualProfile('b1')!, name: 'MP583', kind: 'thermal' as const };
    const { rerender } = renderApp(<PrinterDialog {...base} status={ready({ canFeed: true, profile: thermal })} onStickerGap={onStickerGap} />);
    expect(screen.getByRole('combobox', { name: 'Paper type' })).toHaveValue('continuous');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Paper type' }), 'Stickers');
    expect(onStickerGap).toHaveBeenLastCalledWith(2);
    rerender(<PrinterDialog {...base} status={ready({ canFeed: true, profile: thermal })} stickerGap={2} onStickerGap={onStickerGap} />);
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Gap' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Gap' }), '3');
    expect(onStickerGap).toHaveBeenLastCalledWith(3);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Paper type' }), 'Continuous');
    expect(onStickerGap).toHaveBeenLastCalledWith(null);
  });

  it('shows how to measure and load stickers and continuous paper', async () => {
    const thermal = { ...findManualProfile('b1')!, name: 'MP583', kind: 'thermal' as const };
    const { unmount } = renderApp(<PrinterDialog {...base} status={ready({ canFeed: true, profile: thermal })} stickerGap={2} onStickerGap={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Paper guide' }));
    const guide = screen.getByRole('dialog', { name: 'Paper guide' });
    expect(guide).toHaveTextContent('Measure one sticker on its own');
    expect(guide).toHaveTextContent('One long strip');
    // The picked paper type is marked.
    expect(guide.querySelector('.mg-current')).toHaveTextContent('Stickers');
    await userEvent.click(screen.getByRole('tab', { name: 'Load' }));
    expect(screen.getByRole('tabpanel', { name: 'Load' })).toHaveTextContent('Put a gap on the print head');
    expect(screen.getByRole('tabpanel', { name: 'Load' })).toHaveTextContent('Peel printed stickers off');
    await userEvent.click(screen.getByRole('tab', { name: 'Line up' }));
    expect(screen.getByRole('tabpanel', { name: 'Line up' })).toHaveTextContent('Answer one question at a time.');
    expect(screen.getByRole('tabpanel', { name: 'Line up' })).toHaveTextContent('the next sticker starts at the print head');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Paper guide' })).toBeNull();
    // The printer window stays open.
    expect(screen.getByRole('combobox', { name: 'Paper type' })).toBeInTheDocument();
    unmount();
    renderApp(<PrinterDialog {...base} status={ready({ canFeed: true, profile: thermal })} onStickerGap={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Paper guide' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Load' }));
    expect(screen.getByRole('tabpanel', { name: 'Load' })).toHaveTextContent('Pull a little paper out');
    expect(screen.getByRole('tabpanel', { name: 'Load' })).not.toHaveTextContent('Put a gap');
    // Lining up is for sticker rolls.
    expect(screen.queryByRole('tab', { name: 'Line up' })).toBeNull();
  });

  it('opens the line-up steps from the sticker test', async () => {
    const thermal = { ...findManualProfile('b1')!, name: 'MP583', kind: 'thermal' as const };
    renderApp(<PrinterDialog {...base} status={ready({ canFeed: true, profile: thermal })} stickerGap={2} onStickerGap={() => {}} onStickerTest={async () => 120} onFeed={async () => {}} labelLength={30} onLabelLength={() => {}} paperWidth={48} onPaperWidth={() => {}} />);
    await userEvent.click(screen.getByText('Line up stickers'));
    await userEvent.click(screen.getByRole('button', { name: 'How it works' }));
    expect(screen.getByRole('tab', { name: 'Line up' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sizes the scale from about how long a sticker is, to save stickers', async () => {
    const thermal = { ...findManualProfile('b1')!, name: 'MP583', kind: 'thermal' as const };
    const onStickerTest = vi.fn(async (_about: number) => 70);
    renderApp(<PrinterDialog {...base} status={ready({ canFeed: true, profile: thermal })} stickerGap={2} onStickerGap={() => {}} onStickerTest={onStickerTest} onFeed={async () => {}} labelLength={30} onLabelLength={() => {}} paperWidth={48} onPaperWidth={() => {}} />);
    await userEvent.click(screen.getByText('Line up stickers'));
    // Starts from the length set, and says how much scale that prints.
    const about = screen.getByRole('spinbutton', { name: 'Sticker length, about' });
    expect(about).toHaveValue(30);
    expect(screen.getByText(/Prints 103 mm of scale/)).toBeInTheDocument();
    await userEvent.clear(about);
    await userEvent.type(about, '12');
    expect(screen.getByText(/Prints 67 mm of scale/)).toHaveTextContent('stickers up to 27 mm long');
    await userEvent.click(screen.getByRole('button', { name: 'Print scale' }));
    expect(onStickerTest).toHaveBeenCalledWith(12);
  });

  it('walks through reading the scale, then sets the sticker size, gap and position', async () => {
    const thermal = { ...findManualProfile('b1')!, name: 'MP583', kind: 'thermal' as const };
    const [onPaperWidth, onLabelLength, onStickerGap, onOffset] = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const onFeed = vi.fn(async (_mm: number) => {});
    renderApp(
      <PrinterDialog
        {...base}
        status={ready({ canFeed: true, profile: thermal })}
        stickerGap={2}
        onStickerGap={onStickerGap}
        onStickerTest={async () => 120}
        onFeed={onFeed}
        labelLength={30}
        onLabelLength={onLabelLength}
        paperWidth={48}
        headWidth={48}
        onPaperWidth={onPaperWidth}
        offset={{ x: 0, y: 1 }}
        onOffset={onOffset}
      />,
    );
    await userEvent.click(screen.getByText('Line up stickers'));
    await userEvent.click(screen.getByRole('button', { name: 'Print scale' }));
    const answer = async (name: string, value: string) => {
      const field = screen.getByRole('spinbutton', { name });
      expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
      await userEvent.clear(field);
      await userEvent.type(field, value);
      await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    };
    // One question at a time; a negative top is fine.
    expect(screen.getByRole('group', { name: 'Step 1 of 6' })).toHaveTextContent("What number is at that sticker's top edge?");
    await answer('Sticker top', '-2');
    await answer('Sticker bottom', '23');
    await answer('Next sticker top', '20');
    await answer('Last sticker top', '118');
    await answer('Left edge', '1');
    await answer('Right edge', '51');
    // A misread number shows what is wrong, and going back fixes it.
    expect(screen.getByRole('status')).toHaveTextContent("The next sticker's top must read more than this one's bottom.");
    expect(screen.getByRole('button', { name: 'Fix size, gap and position' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Check the numbers' }));
    for (let i = 0; i < 2; i++) await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Next sticker top' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Next sticker top' }), '28');
    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    // A 50 × 25 mm sticker 2 mm right of the head's middle, stickers every 30 mm.
    expect(screen.getByRole('status')).toHaveTextContent('50 × 25 mm stickers, 5 mm gap');
    // The working shows, so each number can be checked against the strip.
    expect(screen.getByRole('status')).toHaveTextContent('Gap 28 − 23 = 5 mm');
    await userEvent.click(screen.getByRole('button', { name: 'Fix size, gap and position' }));
    expect(onPaperWidth).toHaveBeenLastCalledWith(50);
    expect(onLabelLength).toHaveBeenLastCalledWith(25);
    expect(onStickerGap).toHaveBeenLastCalledWith(5);
    expect(onOffset).toHaveBeenLastCalledWith({ x: 2, y: 0 });
    // The 120 mm scale stopped 2 mm past the top at 118: on to the next at 148.
    expect(onFeed).toHaveBeenLastCalledWith(28);
  });

  it('hides the paper guide on printers that sense the paper', () => {
    renderApp(<PrinterDialog {...base} status={ready()} />);
    expect(screen.queryByRole('button', { name: 'Paper guide' })).toBeNull();
  });

  it('offers receipt, label and cat printer types for a printer it does not recognise', async () => {
    const onManualProfile = vi.fn();
    const { rerender } = renderApp(<PrinterDialog {...base} status={{ state: 'disconnected', profile: null }} onManualProfile={onManualProfile} />);
    const select = screen.getByRole('combobox', { name: /Printer type, if not recognised/ });
    await userEvent.selectOptions(select, 'Receipt printer, 80 mm');
    expect(onManualProfile).toHaveBeenLastCalledWith('escpos-80');
    rerender(<PrinterDialog {...base} status={{ state: 'disconnected', profile: null }} manualProfileId="escpos-80" onManualProfile={onManualProfile} />);
    expect(screen.getByText(/lists every nearby device/)).toBeInTheDocument();
  });
});
