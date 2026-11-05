import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { offlinePlugin } from './src/offline/plugin';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages path.
  base: './',
  plugins: [react(), offlinePlugin()],
  // The app builds from libniimai's source, so a change there shows up at once.
  resolve: { alias: { libniimai: fileURLToPath(new URL('./packages/libniimai/src/index.ts', import.meta.url)) } },
  // The barcode encoders alone are ~400 kB; the app is still one screen.
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5197, strictPort: true },
  preview: { port: 5197, strictPort: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test/setup.ts'],
          css: false,
        },
      },
      'packages/libniimai',
    ],
  },
});
