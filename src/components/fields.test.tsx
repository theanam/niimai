import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderApp } from '../test/render';
import { NumberField } from './fields';

function Field({ onChange }: { onChange: (v: number) => void }) {
  const [value, setValue] = useState(48);
  return <NumberField label="Paper width" value={value} min={10} max={112} step={1} onChange={(v) => (setValue(v), onChange(v))} />;
}

describe('number field', () => {
  it('lets a number pass through values below the minimum while it is typed, and caps it at the maximum', async () => {
    const onChange = vi.fn();
    renderApp(<Field onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Paper width' });
    await userEvent.clear(input);
    await userEvent.type(input, '40');
    expect(input).toHaveValue(40);
    expect(onChange.mock.calls).toEqual([[40]]);
    await userEvent.type(input, '0');
    expect(onChange).toHaveBeenLastCalledWith(112);
  });

  it('goes back to the last value when left below the minimum', async () => {
    renderApp(<Field onChange={() => {}} />);
    const input = screen.getByRole('spinbutton', { name: 'Paper width' });
    await userEvent.clear(input);
    await userEvent.type(input, '4');
    await userEvent.tab();
    expect(input).toHaveValue(48);
  });
});
