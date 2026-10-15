import { STORAGE_KEYS, type StorageSchema } from '../storage';
import { FIXTURES, FIXTURE_NAMES, type FixtureName } from './data';

/**
 * Seeds `localStorage` from `?fixture=<name>` before the app mounts.
 *
 * This module is only reachable from the build-mode gated dynamic import in
 * `src/main.ts`, so no fixture data or query-string handling is compiled into a
 * production build. The visual harness builds with `--mode visual` for exactly
 * that reason; see `docs/UI-REVAMP.md` §2.
 */
export function isFixtureEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'visual';
}

/**
 * The harness navigates to `/#/today?fixture=today`, so the parameter sits in
 * the hash fragment, not in `location.search`. Both are accepted.
 */
function readRequestedName(): FixtureName | null {
  const hash = window.location.hash;
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const requested = new URLSearchParams(`${window.location.search}&${hashQuery}`).get('fixture');

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

/** Writes the fixture and returns. No-op when the build has fixtures disabled. */
export function applyFixture(): void {
  if (!isFixtureEnabled()) return;

  const name = readRequestedName();
  if (name === null) return;

  const fixture = FIXTURES[name];

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
}
