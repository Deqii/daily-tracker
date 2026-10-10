import { toLocalDate, weekStart } from './date';
import { isValidStoredValue, type StoredKey } from './storage-validate';
import type {
  Completion,
  DailyQuestDay,
  MilestoneEvent,
  Reward,
  RewardPurchase,
  Task,
  UserState,
} from './types';

export type { LocalDate, MilestoneEvent, Rank, Stat, Tier, Timestamp } from './types';
export { STATS, RANKS, TIERS } from './types';

/** Value type held under each localStorage key, per the PRD data model. */
export interface StorageSchema {
  schemaVersion: number;
  tasks: Task[];
  completions: Completion[];
  dailyQuestLog: DailyQuestDay[];
  rewards: Reward[];
  rewardPurchases: RewardPurchase[];
  userState: UserState;
  milestoneEvents: MilestoneEvent[];
  theme: 'dark' | 'light';
}

export const SCHEMA_VERSION = 2;

export const STORAGE_KEYS: Record<keyof StorageSchema, string> = {
  schemaVersion: 'daily-tracker:schemaVersion',
  tasks: 'daily-tracker:tasks',
  completions: 'daily-tracker:completions',
  dailyQuestLog: 'daily-tracker:dailyQuestLog',
  rewards: 'daily-tracker:rewards',
  rewardPurchases: 'daily-tracker:rewardPurchases',
  userState: 'daily-tracker:userState',
  milestoneEvents: 'daily-tracker:milestoneEvents',
  theme: 'daily-tracker:theme',
};

/** Raw text of discarded values, kept as the latest copy per key (D22). */
export const BACKUP_KEY = 'daily-tracker:backup';

const STORAGE_KEY_ORDER = Object.keys(STORAGE_KEYS) as (keyof StorageSchema)[];

export type StorageFailure = 'QUOTA' | 'UNAVAILABLE' | 'UNKNOWN';

/** A write either succeeds or reports why it failed; it never throws (PRD 2.2). */
export type WriteResult = { ok: true } | { ok: false; error: StorageFailure };

export interface SchemaMismatch {
  found: number | null;
  expected: number;
}

export interface StorageReport {
  firstRun: boolean;
  recoveredKeys: string[];
  backupKeys: string[];
  schemaMismatch: SchemaMismatch | null;
}

export interface LoadStateResult {
  state: StorageSchema;
  report: StorageReport;
}

type BackupRecord = Record<string, string>;

type ReadResult = { ok: true; raw: string | null } | { ok: false };
type ParseResult = { ok: true; value: unknown } | { ok: false };

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readRaw(key: string): ReadResult {
  const storage = getStorage();

  if (storage === null) {
    return { ok: false };
  }

  try {
    return { ok: true, raw: storage.getItem(key) };
  } catch {
    return { ok: false };
  }
}

function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { name, code } = error as { name?: unknown; code?: unknown };

  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

function writeRaw(key: string, raw: string): WriteResult {
  const storage = getStorage();

  if (storage === null) {
    return { ok: false, error: 'UNAVAILABLE' };
  }

  try {
    storage.setItem(key, raw);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: isQuotaError(error) ? 'QUOTA' : 'UNKNOWN' };
  }
}

function parseRaw(raw: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createDefaultUserState(today?: string): UserState {
  const day = today ?? toLocalDate(new Date());

  return {
    lifetimeXP: 0,
    wallet: 0,
    statXP: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    rank: 'E',
    currentStreak: 0,
    freezesUsedThisWeek: 0,
    lastFreezeWeekReset: weekStart(day),
    penaltyStats: [],
    equippedTitle: null,
    unlockedTitles: [],
    totalCompletions: 0,
    totalPurchases: 0,
    lastRolloverDate: day,
  };
}

/** Validated write. Storage failures are reported, never thrown (PRD 2.2). */
export function write<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): WriteResult {
  let raw: string;

  try {
    raw = JSON.stringify(value);
  } catch {
    return { ok: false, error: 'UNKNOWN' };
  }

  return writeRaw(STORAGE_KEYS[key], raw);
}

function isStoredValue<K extends keyof StorageSchema>(
  key: K,
  value: unknown
): value is StorageSchema[K] {
  return isValidStoredValue(key as StoredKey, value);
}

function writeDefault(key: keyof StorageSchema, today: string): WriteResult {
  switch (key) {
    case 'schemaVersion':
      return write('schemaVersion', SCHEMA_VERSION);
    case 'tasks':
      return write('tasks', []);
    case 'completions':
      return write('completions', []);
    case 'dailyQuestLog':
      return write('dailyQuestLog', []);
    case 'rewards':
      return write('rewards', []);
    case 'rewardPurchases':
      return write('rewardPurchases', []);
    case 'userState':
      return write('userState', createDefaultUserState(today));
    case 'milestoneEvents':
      return write('milestoneEvents', []);
    case 'theme':
      return write('theme', 'dark');
  }
}

function readBackup(): BackupRecord {
  const read = readRaw(BACKUP_KEY);

  if (!read.ok || read.raw === null) {
    return {};
  }

  const parsed = parseRaw(read.raw);

  if (!parsed.ok || !isPlainObject(parsed.value)) {
    return {};
  }

  const record: BackupRecord = {};

  for (const [key, value] of Object.entries(parsed.value)) {
    if (typeof value === 'string') {
      record[key] = value;
    }
  }

  return record;
}

function writeBackup(record: BackupRecord): WriteResult {
  let raw: string;

  try {
    raw = JSON.stringify(record);
  } catch {
    return { ok: false, error: 'UNKNOWN' };
  }

  return writeRaw(BACKUP_KEY, raw);
}

function parseVersion(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }

  const parsed = parseRaw(raw);

  if (!parsed.ok || typeof parsed.value !== 'number' || !Number.isFinite(parsed.value)) {
    return null;
  }

  return parsed.value;
}

interface Discard {
  key: keyof StorageSchema;
  raw: string;
}

function assign<K extends keyof StorageSchema>(
  state: StorageSchema,
  key: K,
  value: StorageSchema[K]
): void {
  state[key] = value;
}

function defaultsFor(today: string): StorageSchema {
  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    completions: [],
    dailyQuestLog: [],
    rewards: [],
    rewardPurchases: [],
    userState: createDefaultUserState(today),
    milestoneEvents: [],
    theme: 'dark',
  };
}

/**
 * Guarded load: validates every key, discards (never silently) anything corrupt or
 * from another schema version, and returns the usable state plus a data-only report.
 */
export function loadState(today: string): LoadStateResult {
  const report: StorageReport = {
    firstRun: false,
    recoveredKeys: [],
    backupKeys: [],
    schemaMismatch: null,
  };

  const raws = new Map<keyof StorageSchema, string | null>();

  for (const key of STORAGE_KEY_ORDER) {
    const read = readRaw(STORAGE_KEYS[key]);
    raws.set(key, read.ok ? read.raw : null);
  }

  const state = defaultsFor(today);

  if (STORAGE_KEY_ORDER.every((key) => raws.get(key) === null)) {
    report.firstRun = true;

    for (const key of STORAGE_KEY_ORDER) {
      writeDefault(key, today);
    }

    return { state, report };
  }

  const version = parseVersion(raws.get('schemaVersion') ?? null);
  const versionMatches = version === SCHEMA_VERSION;

  if (!versionMatches) {
    report.schemaMismatch = { found: version, expected: SCHEMA_VERSION };
  }

  const missing: (keyof StorageSchema)[] = [];
  const discarded: Discard[] = [];

  for (const key of STORAGE_KEY_ORDER) {
    const raw = raws.get(key) ?? null;

    if (raw === null) {
      missing.push(key);
      continue;
    }

    if (versionMatches && key !== 'schemaVersion') {
      const parsed = parseRaw(raw);

      if (parsed.ok && isStoredValue(key, parsed.value)) {
        assign(state, key, parsed.value);
        continue;
      }
    } else if (versionMatches) {
      continue;
    }

    discarded.push({ key, raw });
  }

  if (discarded.length > 0) {
    const backup = readBackup();

    for (const { key, raw } of discarded) {
      backup[STORAGE_KEYS[key]] = raw;
      report.recoveredKeys.push(STORAGE_KEYS[key]);
    }

    if (writeBackup(backup).ok) {
      report.backupKeys = [...report.recoveredKeys];
    }

    for (const { key } of discarded) {
      writeDefault(key, today);
    }
  }

  for (const key of missing) {
    writeDefault(key, today);
  }

  return { state, report };
}
