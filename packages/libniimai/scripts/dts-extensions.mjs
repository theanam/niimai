// Adds .js to relative imports in the emitted .d.ts files, so projects that
// resolve modules the Node way (nodenext) find them.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist/', import.meta.url).pathname;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.d.ts'))) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8').replace(/((?:from\s+|import\()['"])(\.\.?\/[^'"]+?)(['"])/g, (m, a, spec, b) => (spec.endsWith('.js') ? m : `${a}${spec}.js${b}`));
  writeFileSync(path, text);
}
