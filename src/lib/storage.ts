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

export function read<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
  const raw = window.localStorage.getItem(STORAGE_KEYS[key]);

  if (raw === null) {
    return null;
  }

  return JSON.parse(raw) as StorageSchema[K];
}

export function write<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
  window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
}
