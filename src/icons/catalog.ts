/**
 * Phosphor Icons (MIT), built into public/icons/ by `npm run icons`. The
 * catalog and each weight's shapes load on first use.
 */
export type IconWeight = 'regular' | 'bold' | 'fill';

export const ICON_WEIGHTS: { value: IconWeight; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
  { value: 'fill', label: 'Fill' },
];

export interface IconEntry {
  name: string;
  categories: string[];
  /** Lowercased name and tags, for search. */
  haystack: string;
}

export interface IconCatalog {
  categories: string[];
  icons: IconEntry[];
}

export function parseIconMeta(raw: unknown): IconCatalog {
  const data = raw as { categories?: unknown; icons?: unknown };
  const categories = Array.isArray(data?.categories) ? data.categories.filter((c): c is string => typeof c === 'string') : [];
  const icons = (Array.isArray(data?.icons) ? data.icons : [])
    .filter((r): r is [string, number[], string] => Array.isArray(r) && typeof r[0] === 'string')
    .map(([name, cats, tags]) => ({
      name,
      categories: (Array.isArray(cats) ? cats : []).map((i) => categories[i]).filter(Boolean),
      haystack: `${name.replace(/-/g, ' ')} ${typeof tags === 'string' ? tags : ''}`.toLowerCase(),
    }));
  return { categories, icons };
}

/** Name matches rank ahead of tag matches. */
export function filterIcons(icons: IconEntry[], query: string, category: string | null = null): IconEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const inCat = category ? icons.filter((i) => i.categories.includes(category)) : icons;
  if (!words.length) return inCat;
  const hits = inCat.filter((i) => words.every((w) => i.haystack.includes(w)));
  const byName = (i: IconEntry) => words.every((w) => i.name.includes(w));
  return [...hits.filter(byName), ...hits.filter((i) => !byName(i))];
}

/**
 * Rebuilds icon markup from path data alone. Icon shapes travel inside label
 * files, so anything else (scripts, handlers, links) is dropped on the way in.
 */
export function sanitizeIconBody(body: string): string {
  return [...body.matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)]
    .map((m) => m[1].replace(/[^0-9a-zA-Z.,\-\s]/g, ''))
    .filter(Boolean)
    .map((d) => `<path d="${d}"/>`)
    .join('');
}

const base = (): string => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';

function fetchJson(file: string): Promise<unknown> {
  return fetch(`${base()}icons/${file}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Icons unavailable'))));
}

let meta: Promise<IconCatalog> | null = null;
export function loadIconCatalog(): Promise<IconCatalog> {
  meta ??= fetchJson('meta.json').then(parseIconMeta);
  meta.catch(() => (meta = null));
  return meta;
}

const shapes = new Map<IconWeight, Promise<Record<string, string>>>();
export function loadIconShapes(weight: IconWeight): Promise<Record<string, string>> {
  let p = shapes.get(weight);
  if (!p) {
    p = fetchJson(`${weight}.json`) as Promise<Record<string, string>>;
    p.catch(() => shapes.delete(weight));
    shapes.set(weight, p);
  }
  return p;
}

/** The sanitised shape of one icon in one weight. */
export async function iconBody(name: string, weight: IconWeight): Promise<string> {
  const body = (await loadIconShapes(weight))[name];
  if (!body) throw new Error(`Icon ${name} not found`);
  return sanitizeIconBody(body);
}

/** "arrow-circle-up" → "Arrow circle up". */
export const iconLabel = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
