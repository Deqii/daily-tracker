import { formatLocalIsoDate } from './date';
import type { Completion, DailyQuestDay, Reward, RewardPurchase, Task, UserState } from './types';

/** Value type held under each localStorage key, per the PRD data model. */
export interface StorageSchema {
  schemaVersion: number;
  tasks: Task[];
  completions: Completion[];
  dailyQuestLog: DailyQuestDay[];
  rewards: Reward[];
  rewardPurchases: RewardPurchase[];
  userState: UserState;
}

export const SCHEMA_VERSION = 1;

export const STORAGE_KEYS: Record<keyof StorageSchema, string> = {
  schemaVersion: 'daily-tracker:schemaVersion',
  tasks: 'daily-tracker:tasks',
  completions: 'daily-tracker:completions',
  dailyQuestLog: 'daily-tracker:dailyQuestLog',
  rewards: 'daily-tracker:rewards',
  rewardPurchases: 'daily-tracker:rewardPurchases',
  userState: 'daily-tracker:userState',
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

export function createDefaultUserState(): UserState {
  const today = formatLocalIsoDate();

  return {
    lifetimeXP: 0,
    wallet: 0,
    statXP: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    currentStreak: 0,
    freezeUsedThisWeek: false,
    lastFreezeWeekReset: today,
    penaltyStats: [],
    equippedTitle: null,
    unlockedTitles: [],
    lastRolloverDate: today,
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

  if (key === 'userState') {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  return Array.isArray(value);
}
