/**
 * The service worker that lets niimai open and print without a connection.
 * The build (offlinePlugin in vite.config.ts) fills in PRECACHE with every
 * file it writes and VERSION with their hash, then serves this as sw.js.
 * The app shell is cached on install; icons and Google Fonts are kept as
 * they are first used, so labels made online still draw offline.
 */
const PRECACHE = /** @type {string[]} */ ([]);
const VERSION = 'dev';

const SHELL = `niimai-shell-${VERSION}`;
const RUNTIME = 'niimai-runtime';
const FONTS = 'niimai-fonts';
/** Servers send Vary: Origin, and module scripts carry an Origin the install requests did not. */
const MATCH = { ignoreSearch: true, ignoreVary: true };
/** Font files are small but the font picker previews hundreds; the oldest go past this many. */
export const MAX_FONT_ENTRIES = 400;

/**
 * How a request is answered: 'page' tries the network and falls back to the
 * cached app, 'cache' serves a cached copy first, 'fonts' serves a cached
 * Google Fonts file and keeps it, and null leaves the request alone.
 * @param {URL} url
 * @param {string} mode the request's mode ('navigate' for pages)
 * @param {string} origin the app's own origin
 * @returns {'page' | 'cache' | 'fonts' | null}
 */
export function strategy(url, mode, origin) {
  if (url.origin === origin) {
    if (mode === 'navigate') return 'page';
    return url.pathname.endsWith('/sw.js') ? null : 'cache';
  }
  if (url.hostname === 'fonts.gstatic.com') return 'fonts';
  // Full family stylesheets; the font picker's preview sheets (text=) come and go.
  if (url.hostname === 'fonts.googleapis.com' && !url.searchParams.has('text')) return 'fonts';
  return null;
}

/** @param {Cache} cache */
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FONT_ENTRIES)).map((k) => cache.delete(k)));
}

/**
 * @param {Request} request
 * @param {string} name the cache that keeps the reply
 */
async function cached(request, name) {
  // Font stylesheets differ only by their query, so it counts here.
  const hit = await caches.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  // Opaque replies (stylesheets linked without CORS) still draw, so they are kept too.
  if (res.ok || res.type === 'opaque') {
    const cache = await caches.open(name);
    await cache.put(request, res.clone());
    if (name === FONTS) void trim(cache);
  }
  return res;
}

/** @param {Request} request */
async function page(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match('./', MATCH)) ?? (await caches.match('index.html', MATCH)) ?? Response.error();
  }
}

if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
  sw.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(SHELL)
        .then((cache) => cache.addAll(PRECACHE))
        .then(() => sw.skipWaiting()),
    );
  });
  sw.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((names) => Promise.all(names.filter((n) => n.startsWith('niimai-shell-') && n !== SHELL).map((n) => caches.delete(n))))
        .then(() => sw.clients.claim()),
    );
  });
  sw.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const how = strategy(new URL(request.url), request.mode, sw.location.origin);
    if (how === 'page') event.respondWith(page(request));
    else if (how === 'cache') event.respondWith(caches.match(request, MATCH).then((hit) => hit ?? cached(request, RUNTIME)));
    else if (how === 'fonts') event.respondWith(cached(request, FONTS));
  });
}
