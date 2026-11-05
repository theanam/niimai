import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** Files from public/ the app needs to open offline. Icon sets past the default style load on first use. */
export const PUBLIC_SHELL = ['./', 'manifest.webmanifest', 'logo.svg', 'apple-touch-icon.png', 'fonts/google-fonts.json', 'icons/meta.json', 'icons/regular.json'];

/** The service worker source with the files to cache on install and a version that changes with them. */
export function swSource(template: string, files: string[]): string {
  const precache = [...new Set([...PUBLIC_SHELL, ...files.filter((f) => !f.endsWith('.map') && f !== 'sw.js')])].sort();
  const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
  return template
    .replace(/^export /gm, '')
    .replace(/^const PRECACHE = .*$/m, `const PRECACHE = ${JSON.stringify(precache)};`)
    .replace(/^const VERSION = .*$/m, `const VERSION = '${version}';`);
}

/** Writes sw.js next to the build, listing every file the build wrote. */
export function offlinePlugin(): Plugin {
  return {
    name: 'niimai-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const template = readFileSync(fileURLToPath(new URL('./sw.js', import.meta.url)), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(template, Object.keys(bundle)) });
    },
  };
}
