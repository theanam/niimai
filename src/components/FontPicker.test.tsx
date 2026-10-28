import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/render';
import { FontPicker } from './FontPicker';

const rows = [
  ['inter', 'Inter', 'sans', [400], 1],
  ['lora', 'Lora', 'serif', [400], 1],
  ['pacifico', 'Pacifico', 'script', [400], 0],
];

describe('font picker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(rows))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists fonts by category with previews and picks one', async () => {
    const onChange = vi.fn();
    renderApp(<FontPicker value="Inter" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Font' }));
    expect(await screen.findByRole('option', { name: 'Lora' })).toHaveStyle({ fontFamily: "'Lora', sans-serif" });
    expect(document.querySelector('link[href*="family=Lora"][href*="text=Lora"]')).not.toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Handwriting' }));
    expect(screen.queryByRole('option', { name: 'Lora' })).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: 'Pacifico' }));
    expect(onChange).toHaveBeenCalledWith('Pacifico');
  });

  it('searches', async () => {
    renderApp(<FontPicker value="Inter" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Font' }));
    await screen.findByRole('option', { name: 'Lora' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Search fonts' }), 'pac');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Pacifico']);
  });
});
