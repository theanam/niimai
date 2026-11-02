import { screen } from '@testing-library/react';
import type { PrinterStatus } from 'libniimai';
import { renderApp } from '../test/render';
import { Header } from './Header';

const renderHeader = (printer: PrinterStatus) =>
  renderApp(
    <Header name="Label" onRename={() => {}} onSaveAs={() => {}} onHome={() => {}} canUndo={false} canRedo={false} preview={false} printer={printer} onAction={() => {}} />,
  );

describe('header', () => {
  it('spins in place of the dot while connecting, keeping the Connect label', () => {
    renderHeader({ state: 'connecting', profile: null });
    const chip = screen.getByRole('button', { name: 'Connecting…' });
    expect(chip).toHaveTextContent('Connect');
    expect(chip.querySelector('.chip-spin')).not.toBeNull();
    expect(chip.querySelector('.dot')).toBeNull();
  });

  it('shows the dot when not connecting', () => {
    renderHeader({ state: 'disconnected', profile: null });
    const chip = screen.getByRole('button', { name: 'Connect printer' });
    expect(chip.querySelector('.dot')).not.toBeNull();
    expect(chip.querySelector('.chip-spin')).toBeNull();
  });
});
