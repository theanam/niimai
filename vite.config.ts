import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages path.
  base: './',
  plugins: [react()],
  // The barcode encoders alone are ~400 kB; the app is still one screen.
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5197, strictPort: true },
  preview: { port: 5197, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
