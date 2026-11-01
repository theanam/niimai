import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'libniimai' },
    // niimbluelib stays a dependency, loaded on demand by the user's bundler.
    rolldownOptions: { external: [/^@mmote\/niimbluelib/] },
    // Bundlers minify the app that uses it; readable code is easier to debug.
    minify: false,
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    name: 'libniimai',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
