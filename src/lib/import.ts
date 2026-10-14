import type { ExportState } from './export';
import { isValidStoredValue, type StoredKey } from './storage-validate';

/** Why an import was rejected; maps to the reasons listed in `design.md` §7. */
export type ImportError = 'INVALID_JSON' | 'NEWER_VERSION' | 'INVALID_DATA';

export type ImportResult = { ok: true; state: ExportState } | { ok: false; error: ImportError };

const STATE_KEYS = [
  'tasks',
  'completions',
  'dailyQuestLog',
  'rewards',
  'rewardPurchases',
  'userState',
  'milestoneEvents',
] as const satisfies readonly StoredKey[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses an exported file and validates it before it may replace the live data (PRD §6; D18, D22).
 * A file that is not JSON, is from a newer schema, or has a missing or malformed slice is rejected,
 * so a failed import changes nothing. The `recoveryBackup` field and any unknown fields are ignored.
 */
export function parseImport(text: string, currentSchemaVersion: number): ImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'INVALID_DATA' };
  }

  const version = parsed.schemaVersion;

  if (typeof version !== 'number' || !Number.isFinite(version)) {
    return { ok: false, error: 'INVALID_DATA' };
  }

  if (version > currentSchemaVersion) {
    return { ok: false, error: 'NEWER_VERSION' };
  }

  if (version !== currentSchemaVersion) {
    return { ok: false, error: 'INVALID_DATA' };
  }

  const state: Record<string, unknown> = {};

  for (const key of STATE_KEYS) {
    const value = parsed[key];

    if (!isValidStoredValue(key, value)) {
      return { ok: false, error: 'INVALID_DATA' };
    }

    state[key] = value;
  }

  return { ok: true, state: state as unknown as ExportState };
}
