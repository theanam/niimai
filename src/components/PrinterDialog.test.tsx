import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { findManualProfile } from '../printer/profiles';
import type { PrinterStatus } from '../printer/service';
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
  it('offers each way to connect and explains what is unavailable', async () => {
    const onConnect = vi.fn(async () => {});
    renderApp(<PrinterDialog {...base} status={{ state: 'disconnected', profile: null }} onConnect={onConnect} />);
    expect(screen.getByRole('heading', { name: 'Connect a printer' })).toBeInTheDocument();
    // jsdom has neither Web Bluetooth nor Web Serial.
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toBeDisabled();
    expect(screen.getAllByText(/Needs Chrome or Edge/).length).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: 'Demo printer' }));
    expect(onConnect).toHaveBeenCalledWith('demo');
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
});
