import { defineConfig } from '@playwright/test';

/**
 * Determinism notes (UI Revamp Issue 0).
 *
 * - `@playwright/test` is pinned to an exact version in package.json and the
 *   browser is installed with `npx playwright install chromium`, which resolves a
 *   single Chromium build. `tests/visual/README.md` records the build the diffs
 *   were last taken with.
 * - Rendering is identical on both sides: fixed clock, Asia/Jakarta, id-ID,
 *   dark, reduced motion, animations frozen at their end state, particles and
 *   the scan sweep hidden, and the same local woff2 files (see
 *   `scripts/copy-visual-fonts.mjs`).
 */
const APP_PORT = 4173;
const PROTO_PORT = 4174;

export default defineConfig({
  testDir: 'tests/visual',
  // Web fonts, the particle canvas and the .boot entrance all need a moment.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // `build:visual` compiles the ?fixture= seeder in; `npm run build` never does.
      command: `npm run build:visual && npm run preview -- --port ${APP_PORT} --strictPort`,
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Serves docs/prototype/ at / and tests/visual/fonts/ at /__fonts__/.
      command: `node scripts/serve-prototypes.mjs --port ${PROTO_PORT}`,
      port: PROTO_PORT,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
