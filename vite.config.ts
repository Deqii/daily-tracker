import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), tailwindcss()],
  build: {
    // The visual build carries the `?fixture=` seeder, so it must never land in
    // the directory `npm run build` owns and `check:no-fixtures` scans.
    outDir: mode === 'visual' ? 'dist-visual' : 'dist',
  },
  test: {
    include: ['src/**/*.test.ts'],
    // tests/visual holds the Playwright fidelity suite, not Vitest tests.
    exclude: ['tests/**', 'node_modules/**', 'dist/**', 'dist-visual/**'],
  },
}));
