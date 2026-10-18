import { STORAGE_KEYS, type StorageSchema } from '../storage';
import { FIXTURES, FIXTURE_NAMES, type FixtureName } from './data';
import type { Theme } from '../../stores/theme';

/**
 * Seeds `localStorage` from `?fixture=<name>` before the app mounts.
 *
 * This module is only reachable from the build-mode gated dynamic import in
 * `src/main.ts`, so no fixture data or query-string handling is compiled into a
 * production build. The visual harness builds with `--mode visual` for exactly
 * that reason; see `docs/UI-REVAMP.md` §2.
 */
/**
 * Unique marker for `npm run check:no-fixtures`.
 *
 * `scripts/assert-no-fixtures.mjs` scans a production `dist/` for this string.
 * It is declared *and used* here, so Rollup cannot tree-shake it out of a
 * `--mode visual` build - otherwise the check would pass vacuously because the
 * string was never there in the first place.
 */
export const FIXTURE_MARKER = 'DT_PROTOTYPE_FIXTURE_DO_NOT_SHIP';

export function isFixtureEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'visual';
}

/**
 * The harness navigates to `/?fixture=<name>#/<page>`, so the parameter is in
 * `location.search` and the hash stays a clean route the router can match.
 */
function readRequestedName(): FixtureName | null {
  const requested = new URLSearchParams(window.location.search).get('fixture');

  if (requested === null) return null;

  return (FIXTURE_NAMES as string[]).includes(requested) ? (requested as FixtureName) : null;
}

function clearStorage(): void {
  try {
    localStorage.clear();
  } catch {
    // A storage-less environment cannot be seeded; the app still runs.
  }
}

/**
 * The theme seeded before this module ran, if any, as the storage layer's own
 * value type.
 *
 * The head script in `index.html` reads `daily-tracker:theme` before any module
 * executes, so a test harness can put the page in the light theme with
 * `context.addInitScript` on a fresh context. It writes the raw `light` the
 * prototypes use. `clearStorage()` would wipe that and the fixture's own
 * `theme: 'dark'` would win, putting the app in the dark theme while the
 * prototype rendered light - so the seeded value is re-applied here, encoded
 * the way `lib/storage` encodes it, which is what `stores/theme.ts` then reads.
 */
function readSeededTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.theme);
    const value = raw !== null && raw.startsWith('"') ? JSON.parse(raw) : raw;

    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Writes the fixture and returns. No-op when the build has fixtures disabled. */
export function applyFixture(): void {
  if (!isFixtureEnabled()) return;

  // Marks the document so a build can be proven to contain the fixtures.
  // `FIXTURE_MARKER` is only ever a data attribute, never anything visible.
  document.documentElement.dataset.prototypeFixture = FIXTURE_MARKER;

  const name = readRequestedName();
  if (name === null) return;

  const fixture = FIXTURES[name];
  const seededTheme = readSeededTheme();

  clearStorage();

  for (const [key, value] of Object.entries(fixture.schema) as [
    keyof StorageSchema,
    StorageSchema[keyof StorageSchema],
  ][]) {
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
  }

  for (const extra of fixture.extra ?? []) {
    localStorage.setItem(extra.key, JSON.stringify(extra.value));
  }

  if (seededTheme !== null) {
    localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(seededTheme));
  }
}
