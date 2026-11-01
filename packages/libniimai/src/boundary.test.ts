/** The library ships on its own, so its code may only import itself and its dependencies. */
import { readdirSync, readFileSync } from 'node:fs';
import pkg from '../package.json';

const deps = Object.keys(pkg.dependencies);
const dir = `${import.meta.dirname}/`;

describe('libniimai stands alone', () => {
  it('imports nothing from outside the package', () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const specs = [...readFileSync(dir + file, 'utf8').matchAll(/(?:from\s+|import\()'([^']+)'/g)].map((m) => m[1]);
      for (const spec of specs) expect(spec.startsWith('./') || deps.some((d) => spec === d || spec.startsWith(`${d}/`)), `${file}: ${spec}`).toBe(true);
    }
  });
});
