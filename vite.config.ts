import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
    // tests/visual holds the Playwright fidelity suite, not Vitest tests.
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
  },
});
