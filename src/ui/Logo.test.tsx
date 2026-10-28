import { render, screen } from '@testing-library/react';
import { Logo, LogoLockup } from './Logo';

describe('logo', () => {
  it('reads as "niimai" to assistive tech', () => {
    render(<LogoLockup />);
    expect(screen.getByRole('img', { name: 'niimai' })).toBeInTheDocument();
  });

  it('gives each mark its own hole mask, so several can share a page', () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    );
    const ids = [...container.querySelectorAll('mask')].map((m) => m.id);
    expect(new Set(ids).size).toBe(2);
    for (const path of container.querySelectorAll('path[mask]')) {
      expect(ids).toContain(/url\(#(.+)\)/.exec(path.getAttribute('mask')!)![1]);
    }
  });
});
