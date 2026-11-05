import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_FONT_ENTRIES, strategy } from './sw.js';
import { PUBLIC_SHELL, swSource } from './plugin';
import { registerOffline, warmFonts } from './register';

const origin = 'https://niimai.app';
const at = (url: string) => new URL(url, origin);

describe('offline service worker', () => {
  it('serves pages from the network first and app files from the cache', () => {
    expect(strategy(at('/'), 'navigate', origin)).toBe('page');
    expect(strategy(at('/assets/index-abc123.js'), 'cors', origin)).toBe('cache');
    expect(strategy(at('/icons/fill.json'), 'cors', origin)).toBe('cache');
    // The worker itself always comes from the network, so updates arrive.
    expect(strategy(at('/sw.js'), 'same-origin', origin)).toBeNull();
  });

  it('keeps Google Fonts used on labels, and leaves picker previews and other sites alone', () => {
    expect(strategy(new URL('https://fonts.googleapis.com/css2?family=Inter&display=swap'), 'no-cors', origin)).toBe('fonts');
    expect(strategy(new URL('https://fonts.gstatic.com/s/inter/v1/a.woff2'), 'cors', origin)).toBe('fonts');
    expect(strategy(new URL('https://fonts.googleapis.com/css2?family=Inter&text=Inter'), 'no-cors', origin)).toBeNull();
    expect(strategy(new URL('https://github.com/theanam/niimai'), 'navigate', origin)).toBeNull();
    expect(MAX_FONT_ENTRIES).toBeGreaterThan(100);
  });

  it('builds a worker that caches every built file, with a version that follows them', () => {
    const template = readFileSync(resolve(__dirname, 'sw.js'), 'utf8');
    const a = swSource(template, ['index.html', 'assets/index-1.js', 'assets/index-1.js.map', 'assets/index-1.css']);
    const precache = JSON.parse(/const PRECACHE = (.*);/.exec(a)![1]) as string[];
    expect(precache).toEqual(expect.arrayContaining([...PUBLIC_SHELL, 'index.html', 'assets/index-1.js', 'assets/index-1.css']));
    expect(precache).not.toContain('assets/index-1.js.map');
    expect(a).not.toMatch(/^export /m);
    const b = swSource(template, ['index.html', 'assets/index-2.js']);
    expect(/VERSION = '(\w+)'/.exec(a)![1]).not.toBe(/VERSION = '(\w+)'/.exec(b)![1]);
  });

  it('registers only in a built copy with service workers', async () => {
    const register = vi.fn(async () => ({}) as ServiceWorkerRegistration);
    const nav = { serviceWorker: { register, controller: {}, addEventListener: vi.fn() } } as unknown as Navigator;
    expect(await registerOffline(nav, false)).toBeNull();
    expect(register).not.toHaveBeenCalled();
    await registerOffline(nav, true);
    expect(register).toHaveBeenCalledWith('./sw.js');
    expect(await registerOffline({} as Navigator, true)).toBeNull();
    const failing = { serviceWorker: { register: async () => Promise.reject(new Error('blocked')), controller: {} } } as unknown as Navigator;
    expect(await registerOffline(failing, true)).toBeNull();
  });

  it('fetches again the label fonts loaded before the worker took over', async () => {
    const get = vi.fn(async (_url: string) => new Response(''));
    await warmFonts(
      [
        'https://fonts.googleapis.com/css2?family=Inter&display=swap',
        'https://fonts.gstatic.com/s/inter/a.woff2',
        'https://fonts.googleapis.com/css2?family=Inter&text=Inter',
        'http://localhost/assets/index.js',
      ],
      get as unknown as typeof fetch,
    );
    expect(get.mock.calls.map((c) => c[0])).toEqual(['https://fonts.googleapis.com/css2?family=Inter&display=swap', 'https://fonts.gstatic.com/s/inter/a.woff2']);
  });
});
