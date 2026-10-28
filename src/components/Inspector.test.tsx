import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDoc, createElement } from '../doc/model';
import { renderApp } from '../test/render';
import { Inspector } from './Inspector';

const noop = () => {};
const noRoll = { size: null, key: null, needsSize: false };
const base = { onDuplicate: noop, onRemove: noop, onReorder: noop, onReplaceImage: noop, onReplaceIcon: noop, onSetRollSize: noop, roll: noRoll };

describe('inspector', () => {
  it('edits label size with presets and offers the detected roll', async () => {
    const onDocChange = vi.fn();
    renderApp(
      <Inspector
        {...base}
        doc={createDoc()}
        selected={null}
        roll={{ size: { widthMm: 50, heightMm: 30 }, key: 'x', needsSize: false }}
        onUpdate={noop}
        onDocChange={onDocChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '30 × 15' }));
    expect(onDocChange).toHaveBeenCalledWith({ widthMm: 30, heightMm: 15 });
    await userEvent.click(screen.getByTitle('Size of the loaded roll'));
    expect(onDocChange).toHaveBeenCalledWith({ widthMm: 50, heightMm: 30 });
  });

  it('asks for the size of a roll the printer cannot measure', async () => {
    const onSetRollSize = vi.fn();
    renderApp(
      <Inspector {...base} doc={createDoc()} selected={null} roll={{ size: null, key: 'abc', needsSize: true }} onSetRollSize={onSetRollSize} onUpdate={noop} onDocChange={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /roll size/i }));
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
});
