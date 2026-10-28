import { waitFor } from '@testing-library/react';
import { ensureFont, linkFont } from './fonts';

describe('font loading', () => {
  it('adds each family stylesheet once', () => {
    void linkFont('Lobster');
    void linkFont('Lobster');
    expect(document.querySelectorAll('link[href*="family=Lobster"]')).toHaveLength(1);
  });

  it('waits for the stylesheet before waiting for the font', async () => {
    const load = vi.fn(async () => []);
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true });
    let done = false;
    const p = ensureFont('Pacifico').then(() => (done = true));
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    document.querySelector<HTMLLinkElement>('link[href*="family=Pacifico"]')!.dispatchEvent(new Event('load'));
    await p;
    expect(done).toBe(true);
    expect(load).toHaveBeenCalledWith('700 16px "Pacifico"');
  });

  it('falls back to the plain stylesheet when the styled one fails', async () => {
    void linkFont('Bebas Neue');
    const first = document.querySelector<HTMLLinkElement>('link[href*="family=Bebas+Neue:ital"]')!;
    first.dispatchEvent(new Event('error'));
    const hrefs = () => [...document.querySelectorAll('link')].map((l) => l.getAttribute('href'));
    await waitFor(() => expect(hrefs()).toContain('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap'));
  });
});
