import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PartsEditor } from './PartsEditor';

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PartsEditor value={value} onChange={setValue} />
      <output aria-label="Value">{value}</output>
    </>
  );
}

const value = () => screen.getByRole('status', { name: 'Value' }).textContent;
const parts = () => screen.getAllByRole('listitem').map((p) => p.textContent);

describe('parts editor', () => {
  it('shows each field and run of words as a tag with its own remove button', async () => {
    render(<Harness initial="SN-{{Number}} for {{Name}}" />);
    expect(parts()).toEqual(['SN-', 'Number', ' for ', 'Name']);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Number' }));
    expect(value()).toBe('SN- for {{Name}}');
    await userEvent.click(screen.getByRole('button', { name: 'Remove “SN- for”' }));
    expect(value()).toBe('{{Name}}');
  });

  it('adds typed text at the end, turning written fields into tags', async () => {
    render(<Harness initial="{{Name}}" />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Add text' }), ' - {{{{SKU}}{Enter}');
    expect(value()).toBe('{{Name}} - {{SKU}}');
    expect(parts()).toEqual(['Name', ' - ', 'SKU']);
  });

  it('removes the last tag with Backspace in an empty input', async () => {
    render(<Harness initial="Hi {{Name}}" />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Add text' }), '{Backspace}');
    expect(value()).toBe('Hi ');
  });

  it('edits words in place, keeping line breaks', async () => {
    render(<Harness initial={'Line\none {{Date}}'} />);
    expect(parts()[0]).toBe('Line↵one ');
    await userEvent.click(screen.getByRole('button', { name: 'Line↵one' }));
    const input = screen.getByRole('textbox', { name: 'Edit text part' });
    fireEvent.change(input, { target: { value: 'Made↵on ' } });
    fireEvent.blur(input);
    expect(value()).toBe('Made\non {{Date}}');
  });

  it('marks a tag that holds only spaces', () => {
    render(<Harness initial="{{A}} {{B}}" />);
    expect(parts()[1]).toBe('␣');
  });
});
