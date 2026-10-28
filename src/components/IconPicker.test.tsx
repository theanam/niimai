import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { renderApp } from '../test/render';
import { IconPicker } from './IconPicker';

describe('icon picker', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => new Response(readFileSync(`public/icons/${String(url).split('/').pop()}`, 'utf8'))),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('searches and picks an icon in the chosen weight', async () => {
    const onPick = vi.fn();
    renderApp(<IconPicker open onOpenChange={() => {}} weight="bold" onPick={onPick} />);
    await screen.findByRole('list', { name: 'Icons' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search icons' }), 'package');
    await userEvent.click(screen.getByRole('radio', { name: 'Fill' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Package' }));
    expect(onPick).toHaveBeenCalledWith({ name: 'package', weight: 'fill', body: expect.stringMatching(/^<path d="M/) });
  });

  it('filters by category', async () => {
    renderApp(<IconPicker open onOpenChange={() => {}} weight="bold" onPick={() => {}} />);
    await screen.findByRole('list', { name: 'Icons' });
    await userEvent.click(screen.getByRole('button', { name: /^Weather/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sun' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Package' })).toBeNull();
  });
});
