/**
 * The Google Fonts catalogue, modelled on theanam/pinwheel-studio. The list
 * lives in public/fonts/google-fonts.json (rebuilt by `npm run fonts`) and
 * loads on first use of the picker.
 */
export type FontCategory = 'sans' | 'serif' | 'display' | 'script' | 'mono';

export interface FontEntry {
  id: string;
  name: string;
  cat: FontCategory;
  weights: number[];
  italic: boolean;
}

export const CATEGORIES: { id: FontCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sans', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'script', label: 'Handwriting' },
  { id: 'mono', label: 'Mono' },
];

const KNOWN = new Set<FontCategory>(['sans', 'serif', 'display', 'script', 'mono']);

export function parseCatalog(rows: unknown): FontEntry[] {
  return (Array.isArray(rows) ? rows : [])
    .filter((r): r is [string, string, string, number[], number] => Array.isArray(r) && typeof r[1] === 'string' && Array.isArray(r[3]) && r[3].length > 0)
    .map(([id, name, cat, weights, italic]) => ({
      id,
      name,
      cat: KNOWN.has(cat as FontCategory) ? (cat as FontCategory) : 'sans',
      weights: [...weights].sort((a, b) => a - b),
      italic: !!italic,
    }));
}

/** Case-insensitive search within a category; names that start with the query rank first. */
export function filterFonts(list: FontEntry[], query: string, cat: FontCategory | 'all' = 'all'): FontEntry[] {
  const q = query.trim().toLowerCase();
  const inCat = cat === 'all' ? list : list.filter((f) => f.cat === cat);
  if (!q) return inCat;
  const starts: FontEntry[] = [];
  const contains: FontEntry[] = [];
  for (const f of inCat) {
    const name = f.name.toLowerCase();
    if (name.startsWith(q)) starts.push(f);
    else if (name.includes(q)) contains.push(f);
  }
  return [...starts, ...contains];
}

const fam = (name: string): string => encodeURIComponent(name).replace(/%20/g, '+');

/** A tiny stylesheet carrying only the glyphs of the family's own name, for picker previews. */
export function previewUrl(f: FontEntry): string {
  const weight = f.weights.includes(400) ? 400 : f.weights[0];
  return `https://fonts.googleapis.com/css2?family=${fam(f.name)}:wght@${weight}&text=${encodeURIComponent(f.name)}&display=swap`;
}

let catalog: Promise<FontEntry[]> | null = null;

export function loadCatalog(): Promise<FontEntry[]> {
  catalog ??= fetch(`${import.meta.env.BASE_URL}fonts/google-fonts.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Font list unavailable'))))
    .then(parseCatalog);
  catalog.catch(() => (catalog = null));
  return catalog;
}
