/** The library ships on its own, so its code may only import itself and its dependencies. */
import { readdirSync, readFileSync } from 'node:fs';
import pkg from '../package.json';

const deps = Object.keys(pkg.dependencies);
const dir = `${import.meta.dirname}/`;
const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

/** A file's local imports, as file names; `values` leaves out type-only imports. */
function imports(file: string, { values = false } = {}): string[] {
  const code = readFileSync(dir + file, 'utf8');
  return [...code.matchAll(/import\s+(type\s+)?[^;]*?from\s+'(\.\/[^']+)'|import\('(\.\/[^']+)'\)/g)]
    .filter((m) => !(values && m[1]))
    .map((m) => `${(m[2] ?? m[3]).slice(2)}.ts`);
}

/** Each printer family's own code. */
const FAMILIES = ['escpos.ts', 'cat.ts', 'tspl.ts', 'marklife.ts'];
/** The NIIMBOT path and the parts every printer shares. */
const CORE = ['service.ts', 'client.ts', 'profiles.ts', 'paper.ts', 'ble.ts', 'mock.ts', 'routed.ts'];

describe('libniimai stands alone', () => {
  it('imports nothing from outside the package', () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const specs = [...readFileSync(dir + file, 'utf8').matchAll(/(?:from\s+|import\()'([^']+)'/g)].map((m) => m[1]);
      for (const spec of specs) expect(spec.startsWith('./') || deps.some((d) => spec === d || spec.startsWith(`${d}/`)), `${file}: ${spec}`).toBe(true);
    }
  });

  it('keeps each printer family to its own code and the shared thermal base', () => {
    for (const file of FAMILIES) {
      const local = imports(file);
      expect(local.filter((f) => FAMILIES.includes(f)), `${file} imports another family`).toEqual([]);
      for (const f of local) expect(['thermal.ts', 'profiles.ts'], `${file}: ${f}`).toContain(f);
    }
    expect(imports('thermal.ts').filter((f) => FAMILIES.includes(f) || f === 'catalog.ts')).toEqual([]);
  });

  it('keeps the NIIMBOT path and the shared service free of other printers', () => {
    for (const file of CORE) {
      const local = imports(file);
      for (const f of local) expect([...FAMILIES, 'thermal.ts', 'catalog.ts', 'bluetooth.ts'], `${file} reaches ${f}`).not.toContain(f);
    }
  });

  it('meets every family in one place only: the Bluetooth router and the catalog', () => {
    const mixers = sources.filter((f) => imports(f, { values: true }).filter((i) => FAMILIES.includes(i)).length > 1);
    expect(mixers.sort()).toEqual(['bluetooth.ts', 'catalog.ts']);
  });

  it('reaches label and receipt printers over USB only through the catalog', () => {
    expect(imports('usb.ts', { values: true }).filter((f) => FAMILIES.includes(f) || f === 'bluetooth.ts')).toEqual([]);
  });

  it('loads niimbluelib only on demand, so pages that never meet a NIIMBOT never load it', () => {
    for (const file of sources) {
      const code = readFileSync(dir + file, 'utf8');
      const eager = [...code.matchAll(/^import\s+(?!type\b)[^;]*from\s+'@mmote\/niimbluelib'/gm)];
      expect(eager, file).toHaveLength(0);
    }
  });
});
