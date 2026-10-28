// Builds public/icons/ from Phosphor Icons (MIT, https://phosphoricons.com).
//   npm run icons
// meta.json:     { categories: string[], icons: [name, categoryIndexes, tags][] }
// <weight>.json: { [name]: svg inner markup } for each weight that prints well.
// Thin and light strokes break up on a 203 dpi thermal head, and duotone needs
// grey, so only regular, bold and fill ship.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('../node_modules/@phosphor-icons/core/', import.meta.url));
const { icons } = await import(path.join(pkgDir, 'dist/index.mjs'));
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const WEIGHTS = ['regular', 'bold', 'fill'];
const categories = [...new Set(icons.flatMap((i) => i.categories))].sort();
const meta = {
  categories,
  icons: icons.map((i) => [i.name, i.categories.map((c) => categories.indexOf(c)), i.tags.filter((t) => !t.startsWith('*')).join(' ')]),
};
writeFileSync(new URL('meta.json', out), JSON.stringify(meta));

for (const weight of WEIGHTS) {
  const shapes = {};
  for (const { name } of icons) {
    const file = path.join(pkgDir, 'assets', weight, weight === 'regular' ? `${name}.svg` : `${name}-${weight}.svg`);
    const svg = readFileSync(file, 'utf8');
    shapes[name] = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  }
  writeFileSync(new URL(`${weight}.json`, out), JSON.stringify(shapes));
}
console.log(`Wrote ${icons.length} icons × ${WEIGHTS.length} weights, ${categories.length} categories`);

// Shapes for the icons templates use, bundled so templates lay out without a fetch.
const kindIcons = JSON.parse(readFileSync(new URL('../src/templates/kind-icons.json', import.meta.url), 'utf8'));
const known = new Set(icons.map((i) => i.name));
const missing = Object.entries(kindIcons).filter(([, name]) => !known.has(name));
if (missing.length) throw new Error(`Unknown icons in kind-icons.json: ${missing.map(([k, n]) => `${k} → ${n}`).join(', ')}`);
const templateShapes = {};
for (const name of new Set(Object.values(kindIcons))) {
  const svg = readFileSync(path.join(pkgDir, 'assets', 'fill', `${name}-fill.svg`), 'utf8');
  templateShapes[name] = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}
writeFileSync(new URL('../src/templates/icon-shapes.json', import.meta.url), JSON.stringify(templateShapes));
console.log(`Bundled ${Object.keys(templateShapes).length} icons for templates`);
