import { screen } from '@testing-library/react';
import { toast } from 'sonner';
import { renderApp } from '../test/render';
import { connectFailed, setupHref, SupportNote } from './setup';

describe('browser setup links', () => {
  it('links an unavailable connection to its Help topic', () => {
    renderApp(<SupportNote issue={{ reason: 'Needs a Chrome flag on Linux', topic: 'linux' }} />);
    expect(screen.getByText(/Needs a Chrome flag on Linux\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How to fix' })).toHaveAttribute('href', '#/help/linux');
  });

  it('offers the fix on connect errors the browser causes, and only on those', () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => 1);
    try {
      connectFailed(new Error('Web Bluetooth API globally disabled.'));
      const [, options] = error.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
      expect(options.action.label).toBe('How to fix');
      options.action.onClick();
      expect(window.location.hash).toBe(setupHref('brave'));
      connectFailed(new Error('Printer stopped responding'));
      expect(error.mock.calls[1]).toEqual(['Printer stopped responding', undefined]);
    } finally {
      error.mockRestore();
      window.location.hash = '';
    }
  });
});
