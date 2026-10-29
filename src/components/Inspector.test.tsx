import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDoc, createElement, type IconElement } from '../doc/model';
import { renderApp } from '../test/render';
import { Inspector } from './Inspector';

const noop = () => {};
const noRoll = { size: null, key: null, needsSize: false };
const base = { onDuplicate: noop, onRemove: noop, onReorder: noop, onReplaceImage: noop, onReplaceIcon: noop, onSetRollSize: noop, roll: noRoll };

describe('inspector', () => {
  it('picks a preset size from the dropdown, the loaded roll first', async () => {
    const onDocChange = vi.fn();
    renderApp(
      <Inspector {...base} doc={createDoc()} selected={null} roll={{ size: { widthMm: 50, heightMm: 30 }, key: 'x', needsSize: false }} onUpdate={noop} onDocChange={onDocChange} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Label size: 40 × 12 mm' }));
    const menu = screen.getByRole('listbox', { name: 'Label sizes' });
    expect(within(menu).getAllByRole('option')[0]).toHaveTextContent('50 × 30 mm');
    expect(within(menu).getByText('Loaded roll')).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('option', { name: /^30 × 15 mm/ }));
    expect(onDocChange).toHaveBeenCalledWith({ widthMm: 30, heightMm: 15, tailMm: undefined, fold: undefined });
  });

  it('keeps custom size tucked away for preset sizes and open for odd ones', () => {
    const { unmount } = renderApp(<Inspector {...base} doc={createDoc()} selected={null} onUpdate={noop} onDocChange={noop} />);
    expect(screen.getByText('Custom size').closest('details')).not.toHaveAttribute('open');
    unmount();
    renderApp(<Inspector {...base} doc={createDoc({ widthMm: 37, heightMm: 19 })} selected={null} onUpdate={noop} onDocChange={noop} />);
    expect(screen.getByText('Custom size').closest('details')).toHaveAttribute('open');
  });

  it('sets the paper type, defaulting to what the roll reports', async () => {
    const onDocChange = vi.fn();
    renderApp(<Inspector {...base} doc={createDoc()} selected={null} rollPaper="continuous" onUpdate={noop} onDocChange={onDocChange} />);
    const select = screen.getByRole('combobox', { name: 'Paper type' });
    expect(select).toHaveDisplayValue('From roll · Continuous');
    await userEvent.selectOptions(select, 'Black mark');
    expect(onDocChange).toHaveBeenCalledWith({ paper: 'blackmark' });
  });

  it('asks for the size of a roll the printer cannot measure', async () => {
    const onSetRollSize = vi.fn();
    renderApp(
      <Inspector {...base} doc={createDoc()} selected={null} roll={{ size: null, key: 'abc', needsSize: true }} onSetRollSize={onSetRollSize} onUpdate={noop} onDocChange={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /loaded roll/i }));
    expect(onSetRollSize).toHaveBeenCalled();
  });

  it('edits text style, leaving the words to the canvas', async () => {
    const doc = createDoc();
    const el = createElement('text', doc);
    const onUpdate = vi.fn();
    renderApp(<Inspector {...base} doc={doc} selected={el} onUpdate={onUpdate} onDocChange={noop} />);
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onUpdate).toHaveBeenCalledWith(el.id, { bold: true }, undefined);
    await userEvent.click(screen.getByRole('radio', { name: 'Align left' }));
    expect(onUpdate).toHaveBeenCalledWith(el.id, { align: 'left' }, undefined);
  });

  it('shows barcode errors', () => {
    const doc = createDoc();
    const el = createElement('barcode', doc, { format: 'ean13', value: 'x' } as never);
    renderApp(<Inspector {...base} doc={doc} selected={el} onUpdate={noop} onDocChange={noop} />);
    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('runs element actions', async () => {
    const doc = createDoc();
    const el = createElement('rect', doc);
    const onRemove = vi.fn();
    const onDuplicate = vi.fn();
    renderApp(<Inspector {...base} onRemove={onRemove} onDuplicate={onDuplicate} doc={doc} selected={el} onUpdate={noop} onDocChange={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDuplicate).toHaveBeenCalledWith(el);
    expect(onRemove).toHaveBeenCalledWith(el.id);
  });

  it('sets width and length directly on continuous paper, with no presets', async () => {
    const onDocChange = vi.fn();
    renderApp(<Inspector {...base} doc={createDoc({ widthMm: 48, heightMm: 30 })} selected={null} onUpdate={noop} onDocChange={onDocChange} continuous />);
    expect(screen.queryByRole('button', { name: /label size/i })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Paper type' })).toBeNull();
    const length = screen.getByRole('spinbutton', { name: 'Length' });
    await userEvent.clear(length);
    await userEvent.type(length, '75');
    expect(onDocChange).toHaveBeenLastCalledWith({ heightMm: 75 });
    const width = screen.getByRole('spinbutton', { name: 'Width' });
    await userEvent.clear(width);
    await userEvent.type(width, '60');
    // Never wider than the 48 mm print width.
    expect(onDocChange).toHaveBeenLastCalledWith({ widthMm: 48 });
  });

  it('shows the chosen icon on its button, and a placeholder before one is chosen', () => {
    const body = '<path d="M10 10h236v236z"/>';
    const icon = { ...createElement('icon', createDoc()), name: 'package', weight: 'bold', body } as IconElement;
    const { unmount } = renderApp(<Inspector {...base} doc={createDoc()} selected={icon} onUpdate={noop} onDocChange={noop} />);
    const button = screen.getByRole('button', { name: /package/i });
    expect(button.querySelector('svg.icon-preview path')?.getAttribute('d')).toBe('M10 10h236v236z');
    unmount();
    renderApp(<Inspector {...base} doc={createDoc()} selected={{ ...icon, name: '', body: '' } as IconElement} onUpdate={noop} onDocChange={noop} />);
    const empty = screen.getByRole('button', { name: /choose icon/i });
    expect(empty.querySelector('svg.icon-preview')).toBeNull();
  });
});
