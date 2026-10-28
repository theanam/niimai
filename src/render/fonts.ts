/**
 * Google Fonts loading. The editor links each family's stylesheet so the page
 * can draw it; standalone output (raster, browser print) inlines the font files
 * as data URLs, since an SVG drawn as an image cannot fetch anything.
 */
const fam = (name: string): string => encodeURIComponent(name).replace(/%20/g, '+');

export const familyCssUrl = (family: string): string =>
  `https://fonts.googleapis.com/css2?family=${fam(family)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;

/** Fallback for families with fewer styles: Google rejects requests for styles a family lacks. */
const plainCssUrl = (family: string): string => `https://fonts.googleapis.com/css2?family=${fam(family)}&display=swap`;

const linked = new Map<string, Promise<void>>();

function addStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(new Error(`Stylesheet failed: ${href}`));
    };
    document.head.appendChild(link);
  });
}

/** Adds the family's stylesheet once. Resolves when its @font-face rules are registered. */
export function linkFont(family: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  let p = linked.get(family);
  if (!p) {
    p = addStylesheet(familyCssUrl(family))
      .catch(() => addStylesheet(plainCssUrl(family)))
      .catch(() => {});
    linked.set(family, p);
  }
  return p;
}

/**
 * Resolves once the family's regular and bold faces are ready to draw.
 * Waits for the stylesheet first: before it loads there is no @font-face for
 * document.fonts.load to wait on, and it would resolve straight away.
 */
export async function ensureFont(family: string): Promise<void> {
  await linkFont(family);
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.allSettled([document.fonts.load(`400 16px "${family}"`), document.fonts.load(`700 16px "${family}"`)]);
}

const embedded = new Map<string, Promise<string>>();

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchCss(family: string): Promise<string> {
  const res = await fetch(familyCssUrl(family));
  if (res.ok) return res.text();
  const plain = await fetch(plainCssUrl(family));
  if (!plain.ok) throw new Error(`Font ${family} unavailable`);
  return plain.text();
}

/** @font-face rules for the family with every font file inlined. Latin subset only, to keep it small. */
export function embedFontCss(family: string): Promise<string> {
  let hit = embedded.get(family);
  if (!hit) {
    hit = (async () => {
      const css = await fetchCss(family);
      const blocks = css.split(/(?=\/\*)/).filter((b) => /\/\*\s*latin\s*\*\//.test(b) || !b.startsWith('/*'));
      const rules = blocks.join('\n');
      const urls = [...new Set([...rules.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
      const data = await Promise.all(urls.map(toDataUrl));
      return urls.reduce((out, url, i) => out.split(url).join(data[i]), rules);
    })();
    hit.catch(() => embedded.delete(family));
    embedded.set(family, hit);
  }
  return hit;
}

export async function embedFonts(families: string[]): Promise<string> {
  const css = await Promise.allSettled(families.map(embedFontCss));
  return css.map((r) => (r.status === 'fulfilled' ? r.value : '')).join('\n');
}
