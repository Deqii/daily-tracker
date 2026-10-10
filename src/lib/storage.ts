import { toLocalDate, weekStart } from './date';
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

/** A missing or corrupted entry both read as `null`, so `initializeStorage` refills either. */
export function read<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
  const raw = window.localStorage.getItem(STORAGE_KEYS[key]);

  if (raw === null) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isStoredValue(key, parsed) ? (parsed as StorageSchema[K]) : null;
}

export function write<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
  window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
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

export function initializeStorage(): void {
  writeIfAbsent('schemaVersion', SCHEMA_VERSION);
  writeIfAbsent('tasks', []);
  writeIfAbsent('completions', []);
  writeIfAbsent('dailyQuestLog', []);
  writeIfAbsent('rewards', []);
  writeIfAbsent('rewardPurchases', []);
  writeIfAbsent('userState', createDefaultUserState());
  writeIfAbsent('milestoneEvents', []);
  writeIfAbsent('theme', 'dark');
}

function writeIfAbsent<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
  if (read(key) === null) {
    write(key, value);
  }
}

function isStoredValue<K extends keyof StorageSchema>(
  key: K,
  value: unknown
): value is StorageSchema[K] {
  if (key === 'schemaVersion') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (key === 'theme') {
    return value === 'dark' || value === 'light';
  }

  if (key === 'userState') {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  return Array.isArray(value);
}
