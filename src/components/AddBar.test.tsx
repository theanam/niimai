import * as Tooltip from '@radix-ui/react-tooltip';
import { act, render, screen } from '@testing-library/react';
import { AddBar } from './AddBar';

const tooltipSide = async () => {
  render(
    <Tooltip.Provider delayDuration={0}>
      <AddBar onAdd={() => {}} />
    </Tooltip.Provider>,
  );
  act(() => screen.getByRole('button', { name: 'Add text' }).focus());
  const tip = await screen.findByRole('tooltip');
  return tip.closest('[data-side]')?.getAttribute('data-side') ?? tip.parentElement?.querySelector('[data-side]')?.getAttribute('data-side');
};

describe('add bar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows tooltips beside the tools', async () => {
    expect(document.querySelector('[data-side]')).toBeNull();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    await expect(tooltipSide()).resolves.toBe('right');
  });

  it('shows tooltips below the tools when the bar runs across a narrow screen', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    await expect(tooltipSide()).resolves.toBe('bottom');
  });
});
