import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AppState } from '../engine/state';
import { toLocalDate } from '../lib/date';
import type { PenaltyNotice } from '../lib/penalty-notice';
import { emptyRewardFormDraft } from '../lib/reward-form';
import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  createDefaultUserState,
  type StorageFailure,
  type StorageReport,
  type StorageSchema,
} from '../lib/storage';
import { emptyTaskFormDraft, type TaskFormDraft } from '../lib/task-form';
import type { Stat } from '../lib/types';
import { createAppStore, type AppStore, type RankRoot, type VisibilityTarget } from './app';

const FIXTURE_URL = new URL('./__fixtures__/golden-run.json', import.meta.url);
const GENERATE = process.env.GOLDEN_RUN_GENERATE === '1';

const counts = (overrides: Partial<Record<Stat, number>> = {}): Record<Stat, number> => ({
  STR: 0,
  VIT: 0,
  INT: 0,
  DISC: 0,
  SOC: 0,
  ...overrides,
});

const taskDraft = (
  familyName: string,
  stat: Stat,
  isAnchor: boolean,
  points: string
): TaskFormDraft => ({
  ...emptyTaskFormDraft(),
  familyName,
  stat,
  isAnchor,
  variants: [{ tier: 'easy', description: 'one', points }],
});

interface TimerEvent {
  readonly kind: 'set' | 'clear';
  readonly delay?: number;
}

interface StepLog {
  readonly name: string;
  readonly writes: string[];
  readonly storage: Record<string, string | null>;
  readonly saveError: StorageFailure | null;
  readonly loadReport: StorageReport;
  readonly rankAttr: string | null;
  readonly milestoneEvents: AppState['milestoneEvents'];
  readonly penaltyNotice: PenaltyNotice | null;
  readonly timerEvents: TimerEvent[];
}

interface GoldenLog {
  readonly steps: StepLog[];
  readonly allWrites: string[];
}

class RecordingStorage implements Storage {
  private map = new Map<string, string>();
  private order: string[] = [];
  private calls = 0;
  failAt = Number.POSITIVE_INFINITY;

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.calls += 1;
    this.order.push(key);

    if (this.calls === this.failAt) {
      const error = new Error('quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    }

    this.map.set(key, value);
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  allWrites(): string[] {
    return [...this.order];
  }

  clearOrder(): void {
    this.order = [];
    this.calls = 0;
  }
}

class FakeVisibility implements VisibilityTarget {
  visibilityState = 'visible';

  private readonly listeners = new Set<() => void>();

  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener);
  }

  dispatch(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

function read<T>(store: { subscribe: (run: (value: T) => void) => () => void }): T {
  let value: T | undefined;
  const unsubscribe = store.subscribe((next) => {
    value = next;
  });
  unsubscribe();
  return value as T;
}

function seed(storage: RecordingStorage): void {
  const userState = {
    ...createDefaultUserState('2026-10-11'),
    lifetimeXP: 100,
    wallet: 100,
    statXP: counts({ STR: 20, VIT: 20, INT: 20, DISC: 20, SOC: 20 }),
  };
  const schema: StorageSchema = {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    completions: [],
    dailyQuestLog: [],
    rewards: [],
    rewardPurchases: [],
    userState,
    milestoneEvents: [],
    theme: 'dark',
  };

  for (const key of Object.keys(schema) as (keyof StorageSchema)[]) {
    storage.setItem(STORAGE_KEYS[key], JSON.stringify(schema[key]));
  }

  storage.clearOrder();
}

function fixedNow(day: number): Date {
  const date = new Date(2026, 9, day, 9, 0, 0);
  date.getTimezoneOffset = () => -420;
  return date;
}

function runGolden(): GoldenLog {
  const storage = new RecordingStorage();
  seed(storage);
  vi.stubGlobal('localStorage', storage);

  let simulatedDay = 11;
  const now = (): Date => fixedNow(simulatedDay);
  const timerEvents: TimerEvent[] = [];
  const setTimer = (_handler: () => void, delay: number): ReturnType<typeof setTimeout> => {
    timerEvents.push({ kind: 'set', delay });
    return delay as unknown as ReturnType<typeof setTimeout>;
  };
  const clearTimer = (): void => {
    timerEvents.push({ kind: 'clear' });
  };
  const visibility = new FakeVisibility();
  const root: RankRoot & { values: Record<string, string> } = {
    values: {},
    setAttribute(name, value) {
      this.values[name] = value;
    },
  };

  let nextId = 0;
  const newId = (): string => `id${String(nextId++).padStart(4, '0')}`;
  const store: AppStore = createAppStore({
    now,
    setTimer,
    clearTimer,
    visibility,
    root,
    newId,
  });

  const steps: StepLog[] = [];
  let writeStart = 0;
  let timerStart = 0;

  const record = (name: string): void => {
    const state = read<AppState>(store);
    const values: Record<string, string | null> = {};

    for (const key of storage.keys().sort()) {
      values[key] = storage.getItem(key);
    }

    steps.push({
      name,
      writes: storage.allWrites().slice(writeStart),
      storage: values,
      saveError: read(store.saveError),
      loadReport: read(store.loadReport),
      rankAttr: root.values['data-rank'] ?? null,
      milestoneEvents: state.milestoneEvents,
      penaltyNotice: read(store.penaltyNotice),
      timerEvents: timerEvents.slice(timerStart),
    });
    writeStart = storage.allWrites().length;
    timerStart = timerEvents.length;
  };

  record('boot');

  const strId = store.saveTask(taskDraft('Morning plank', 'STR', true, '5'), null);
  const vitId = store.saveTask(taskDraft('Evening walk', 'VIT', false, '5'), null);
  const intId = store.saveTask(taskDraft('Read a chapter', 'INT', true, '10'), null);
  const discId = store.saveTask(taskDraft('Inbox zero', 'DISC', false, '5'), null);
  record('add tasks');

  expect(store.completeTask(strId, null).ok).toBe(true);
  expect(store.completeTask(vitId, null).ok).toBe(true);
  expect(store.completeTask(intId, null).ok).toBe(true);
  record('complete three tasks');

  simulatedDay = 12;
  visibility.dispatch();
  record('rollover to day 2');

  simulatedDay = 13;
  visibility.dispatch();
  record('miss day 2 and rollover');

  simulatedDay = 14;
  visibility.dispatch();
  record('miss day 3 and rollover');

  const rewardId = store.saveReward(
    { ...emptyRewardFormDraft(), title: 'Coffee', cost: '5' },
    null
  );
  record('add reward');

  expect(store.purchaseReward(rewardId).ok).toBe(true);
  record('purchase reward');

  store.saveReward({ ...emptyRewardFormDraft(), title: 'Tea', cost: '7' }, rewardId);
  record('edit reward');

  store.deleteReward(rewardId);
  record('delete reward');

  store.saveTask(taskDraft('Morning plank v2', 'STR', true, '7'), strId);
  record('edit task');

  store.deleteTask(discId);
  record('delete task');

  store.acknowledgePenaltyNotice();
  record('acknowledge penalty notice');

  const current = read<AppState>(store);
  store.importState({ ...current, userState: { ...current.userState, wallet: 50 } });
  record('import state');

  storage.failAt = storage.allWrites().length + 3;
  store.saveReward({ ...emptyRewardFormDraft(), title: 'Quota', cost: '1' }, null);
  record('quota failure on third write');

  storage.failAt = Number.POSITIVE_INFINITY;
  store.saveReward({ ...emptyRewardFormDraft(), title: 'Recovery', cost: '1' }, null);
  record('recover after quota failure');

  store.teardown();
  record('teardown');

  vi.unstubAllGlobals();

  return { steps, allWrites: storage.allWrites() };
}

function loadFixture(): GoldenLog {
  try {
    return JSON.parse(readFileSync(FIXTURE_URL, 'utf8')) as GoldenLog;
  } catch {
    throw new Error(
      'golden-run.json is missing; generate it once with GOLDEN_RUN_GENERATE=1 npx vitest run src/stores/golden-run.test.ts'
    );
  }
}

const golden = runGolden();

if (GENERATE) {
  writeFileSync(FIXTURE_URL, `${JSON.stringify(golden, null, 2)}\n`);
}

describe('golden store run', () => {
  it('matches the committed fixture exactly', () => {
    if (GENERATE) return;

    expect(golden).toEqual(loadFixture());
  });

  it('is deterministic across two fresh runs', () => {
    expect(runGolden()).toEqual(golden);
  });

  it('uses a stable local date and UTC offset in every timezone', () => {
    const now = fixedNow(11);

    expect(toLocalDate(now)).toBe('2026-10-11');
    expect(now.getTimezoneOffset()).toBe(-420);
  });
});
