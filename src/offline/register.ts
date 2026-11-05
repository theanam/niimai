const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * Fetches again the Google Fonts the page loaded before the service worker
 * took over, so the worker keeps them for offline use.
 */
export function warmFonts(urls: string[], get: typeof fetch = fetch): Promise<unknown> {
  return Promise.all(urls.filter((u) => FONT_HOSTS.test(u) && !u.includes('text=')).map((u) => get(u).catch(() => null)));
}

/** Registers the service worker that keeps the app working offline. Only built copies have one. */
export function registerOffline(nav: Navigator = navigator, enabled = import.meta.env.PROD): Promise<ServiceWorkerRegistration | null> {
  if (!enabled || !('serviceWorker' in nav)) return Promise.resolve(null);
  if (!nav.serviceWorker.controller) {
    nav.serviceWorker.addEventListener('controllerchange', () => void warmFonts(performance.getEntriesByType('resource').map((e) => e.name)), { once: true });
  }
  // Relative, so it works from any GitHub Pages path; a failure only means no offline copy.
  return nav.serviceWorker.register('./sw.js').catch(() => null);
}
