import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), tailwindcss()],
  build: {
    // The visual build carries the `?fixture=` seeder, so it must never land in
    // the directory `npm run build` owns and `check:no-fixtures` scans.
    outDir: mode === 'visual' ? 'dist-visual' : 'dist',
    // The prototypes serve their CSS unminified. Lightning CSS (Vite's CSS
    // minifier) rewrites `background:none` to `background:0 0`, which Chromium
    // serialises as `background-position:0px 0px` instead of the unminified
    // `0% 0%` and makes the computed-style diff report a property that paints
    // identically. Keep the visual build unminified so both sides are measured
    // from the same text; production builds keep CSS minification.
    ...(mode === 'visual' ? { cssMinify: false as const } : {}),
  },
  test: {
    include: ['src/**/*.test.ts'],
    // tests/visual holds the Playwright fidelity suite, not Vitest tests.
    exclude: ['tests/**', 'node_modules/**', 'dist/**', 'dist-visual/**'],
  },
}));
