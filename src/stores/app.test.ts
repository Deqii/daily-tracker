import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../engine/state';
import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  createDefaultUserState,
  type StorageSchema,
} from '../lib/storage';
import { emptyTaskFormDraft, type TaskFormDraft } from '../lib/task-form';
import { emptyRewardFormDraft, type RewardFormDraft } from '../lib/reward-form';
import type { DailyQuestDay, Reward, Task } from '../lib/types';
import {
  createAppStore,
  millisecondsUntilNextMidnight,
  setRankAttribute,
  type VisibilityTarget,
} from './app';

class FakeStorage implements Storage {
  private map = new Map<string, string>();

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
    this.map.set(key, value);
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

const TODAY = '2026-10-11';

function baseSchema(today: string): StorageSchema {
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

function stubStorage(): FakeStorage {
  const fake = new FakeStorage();
  vi.stubGlobal('localStorage', fake);
  return fake;
}

function seed(fake: FakeStorage, overrides: Partial<StorageSchema> = {}): void {
  const schema: StorageSchema = { ...baseSchema(TODAY), ...overrides };

  for (const key of Object.keys(schema) as (keyof StorageSchema)[]) {
    fake.setItem(STORAGE_KEYS[key], JSON.stringify(schema[key]));
  }
}

function anchorTask(): Task {
  return {
    id: 'task0001',
    familyName: 'Morning plank',
    stat: 'STR',
    isAnchor: true,
    variants: [{ tier: 'easy', description: '60 seconds', points: 5 }],
    createdAt: '2026-10-01T08:00:00+07:00',
  };
}

function rotatingTask(id: string, familyName: string, stat: Task['stat']): Task {
  return {
    id,
    familyName,
    stat,
    isAnchor: false,
    variants: [{ tier: 'easy', description: '1 rep', points: 5 }],
    createdAt: '2026-10-01T08:00:00+07:00',
  };
}

function aReward(cost = 10): Reward {
  return { id: 'rew00001', title: 'Kopi susu', cost, createdAt: '2026-10-01T08:00:00+07:00' };
}

function idFactory(): () => string {
  let next = 0;
  return () => `id${String(next++).padStart(6, '0')}`;
}

function read<T>(store: { subscribe: (run: (value: T) => void) => () => void }): T {
  let value: T | undefined;
  const unsubscribe = store.subscribe((next) => {
    value = next;
  });
  unsubscribe();
  return value as T;
}

function plainRoot(): {
  values: Record<string, string>;
  setAttribute: (n: string, v: string) => void;
} {
  const values: Record<string, string> = {};

  return {
    values,
    setAttribute(name, value) {
      values[name] = value;
    },
  };
}

function openDayOf(state: AppState): DailyQuestDay {
  const day = state.dailyQuestLog.find((entry) => entry.date === TODAY && !entry.closed);

  if (day === undefined) {
    throw new Error('expected an open day');
  }

  return day;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('millisecondsUntilNextMidnight', () => {
  it('measures the time to the next local midnight', () => {
    expect(millisecondsUntilNextMidnight(new Date(2026, 9, 11, 0, 0, 0))).toBe(86400000);
    expect(millisecondsUntilNextMidnight(new Date(2026, 9, 11, 23, 59, 30))).toBe(30000);
  });
});

describe('setRankAttribute', () => {
  it('writes data-rank on a plain root object', () => {
    const calls: [string, string][] = [];
    const root = {
      setAttribute: (name: string, value: string): void => {
        calls.push([name, value]);
      },
    };

    setRankAttribute(root, 'C');

    expect(calls).toEqual([['data-rank', 'C']]);
  });
});

describe('createAppStore', () => {
  it('hydrates from storage, opens today, and writes data-rank', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, { tasks: [anchorTask()] });
    const root = plainRoot();
    const store = createAppStore({ root, newId: idFactory() });

    const state = read(store);

    expect(state.tasks).toHaveLength(1);
    expect(state.userState.lastRolloverDate).toBe(TODAY);
    expect(state.dailyQuestLog.some((day) => day.date === TODAY && !day.closed)).toBe(true);
    expect(root.values['data-rank']).toBe('E');

    store.teardown();
  });

  it('closes a missed day on load and applies the penalty', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [anchorTask()],
      userState: {
        ...createDefaultUserState('2026-10-10'),
        lifetimeXP: 100,
        wallet: 100,
        lastRolloverDate: '2026-10-10',
      },
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    const state = read(store);
    const closed = state.dailyQuestLog.find((day) => day.date === '2026-10-10');

    expect(closed?.closed).toBe(true);
    expect(closed?.freezeUsed).toBe(true);
    expect(closed?.netPointsChange).toBe(-5);
    expect(state.userState.lifetimeXP).toBe(95);
    expect(state.userState.wallet).toBe(95);
    expect(state.userState.lastRolloverDate).toBe(TODAY);

    store.teardown();
  });

  it('runs rollover at local midnight and re-arms for the next day', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 23, 59, 30));
    const fake = stubStorage();
    seed(fake);
    const store = createAppStore({ root: null, newId: idFactory() });

    expect(read<AppState>(store).userState.lastRolloverDate).toBe('2026-10-11');

    vi.advanceTimersByTime(30000);
    expect(read<AppState>(store).userState.lastRolloverDate).toBe('2026-10-12');

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(read<AppState>(store).userState.lastRolloverDate).toBe('2026-10-13');

    store.teardown();
  });

  it('runs rollover when the tab becomes visible again', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0));
    const fake = stubStorage();
    seed(fake);
    const visibility = new FakeVisibility();
    const store = createAppStore({ visibility, root: null, newId: idFactory() });

    expect(read<AppState>(store).userState.lastRolloverDate).toBe('2026-10-11');

    vi.setSystemTime(new Date(2026, 9, 12, 8, 0, 0));
    visibility.visibilityState = 'hidden';
    visibility.dispatch();
    expect(read<AppState>(store).userState.lastRolloverDate).toBe('2026-10-11');

    visibility.visibilityState = 'visible';
    visibility.dispatch();
    expect(read<AppState>(store).userState.lastRolloverDate).toBe('2026-10-12');

    store.teardown();

    vi.setSystemTime(new Date(2026, 9, 13, 8, 0, 0));
    visibility.dispatch();
    expect(read<AppState>(store).userState.lastRolloverDate).toBe('2026-10-12');
  });

  it('keeps the in-memory state and sets saveError on a failed write, then clears it', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      rewards: [aReward(10)],
      userState: { ...createDefaultUserState(TODAY), wallet: 100 },
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    const failing = vi.spyOn(fake, 'setItem').mockImplementation(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });

    const first = store.purchaseReward('rew00001');

    expect(first.ok).toBe(true);
    expect(read(store.saveError)).toBe('QUOTA');
    expect(read<AppState>(store).userState.wallet).toBe(90);

    failing.mockRestore();

    const second = store.purchaseReward('rew00001');

    expect(second.ok).toBe(true);
    expect(read(store.saveError)).toBeNull();

    store.teardown();
  });

  it('completes a quest row through the engine and persists it', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, { tasks: [anchorTask()] });
    const store = createAppStore({ root: null, newId: idFactory() });

    const result = store.completeTask('task0001', null);

    expect(result.ok).toBe(true);
    const state = read<AppState>(store);
    expect(state.completions).toHaveLength(1);
    expect(state.userState.lifetimeXP).toBe(3);
    expect(state.userState.wallet).toBe(3);
    expect(JSON.parse(fake.getItem(STORAGE_KEYS.completions) ?? '[]')).toHaveLength(1);

    store.teardown();
  });

  it('derives level, progress, rank, freezes, streak, and quest rows', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [anchorTask()],
      userState: {
        ...createDefaultUserState(TODAY),
        lifetimeXP: 65,
        wallet: 65,
        statXP: { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 },
      },
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    expect(read(store.level)).toBe(3);
    expect(read(store.levelProgress)).toEqual({
      level: 3,
      xpIntoLevel: 9,
      xpForThisLevel: 70,
      ratio: 9 / 70,
    });
    expect(read(store.rank)).toBe('E');
    expect(read(store.levelRank)).toBe('E');
    expect(read(store.statXP)).toEqual({ STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 });
    expect(read(store.freezesLeft)).toBe(1);
    expect(read(store.streak)).toBe(0);
    expect(read(store.penaltyStats)).toEqual([]);

    const rows = read(store.questRows);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stat).toBe('STR');
    expect(rows[0]?.required).toBe(1);
    expect(rows[0]?.rows[0]?.task.id).toBe('task0001');
    expect(rows[0]?.rows[0]?.isAnchor).toBe(true);
    expect(rows[0]?.rows[0]?.points).toEqual({ min: 3, max: 3 });
    expect(rows[0]?.rows[0]?.options).toEqual([
      { tier: 'easy', description: '60 seconds', points: 3 },
    ]);

    store.teardown();
  });

  it('derives the awarded point range for a task with effort variants', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [
        {
          id: 'task0003',
          familyName: 'Push up routine',
          stat: 'STR',
          isAnchor: true,
          variants: [
            { tier: 'easy', description: '10x2 set', points: 5 },
            { tier: 'medium', description: '20x3 set', points: 9 },
            { tier: 'hard', description: '30x4 set or jogging 2km', points: 15 },
          ],
          createdAt: '2026-10-01T08:00:00+07:00',
        },
      ],
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    const rows = read(store.questRows);

    expect(rows[0]?.rows[0]?.points).toEqual({ min: 3, max: 8 });
    expect(rows[0]?.rows[0]?.options).toEqual([
      { tier: 'easy', description: '10x2 set', points: 3 },
      { tier: 'medium', description: '20x3 set', points: 5 },
      { tier: 'hard', description: '30x4 set or jogging 2km', points: 8 },
    ]);

    store.teardown();
  });

  it('derives the equipped title name, or null when none is equipped', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      userState: {
        ...createDefaultUserState(TODAY),
        equippedTitle: 'streak-7',
        unlockedTitles: ['streak-7'],
      },
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    expect(read(store.equippedTitle)).toBe('Konsisten 7 hari');
    store.teardown();

    seed(stubStorage());
    const empty = createAppStore({ root: null, newId: idFactory() });

    expect(read(empty.equippedTitle)).toBeNull();
    empty.teardown();
  });

  it('reports a blocked rank-up with the gate threshold', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      userState: {
        ...createDefaultUserState(TODAY),
        lifetimeXP: 350,
        wallet: 0,
        rank: 'E',
        statXP: { STR: 100, VIT: 5, INT: 0, DISC: 0, SOC: 0 },
      },
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    expect(read(store.levelRank)).toBe('D');
    expect(read(store.rankGate)).toEqual({
      blocked: true,
      levelRank: 'D',
      weakest: 'VIT',
      threshold: 27,
      current: 5,
    });

    store.teardown();
  });

  it('derives the penalized stats from the open day requirement', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [
        {
          id: 'task0002',
          familyName: 'Chat 1 temen',
          stat: 'SOC',
          isAnchor: true,
          variants: [{ tier: 'easy', description: '1 chat', points: 5 }],
          createdAt: '2026-10-01T08:00:00+07:00',
        },
      ],
      dailyQuestLog: [
        {
          date: TODAY,
          selectedTaskIdPerStat: { SOC: 'task0002' },
          requiredCompletions: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 2 },
          actualCompletions: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 1 },
          netPointsChange: 3,
          freezeUsed: false,
          closed: false,
          lifetimeXPEnd: null,
          levelEnd: null,
          rankEnd: null,
        },
      ],
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    expect(read(store.penaltyStats)).toEqual(['SOC']);

    store.teardown();
  });

  it('derives the Rewards preview from the wallet balance', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    const createdAt = '2026-10-01T08:00:00+07:00';
    seed(fake, {
      rewards: [
        { id: 'rew00001', title: 'Main game 2 jam', cost: 60, createdAt },
        { id: 'rew00002', title: 'Nonton bioskop', cost: 800, createdAt },
      ],
      userState: { ...createDefaultUserState(TODAY), wallet: 65 },
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    expect(read(store.rewardPreview)).toEqual([
      {
        reward: { id: 'rew00001', title: 'Main game 2 jam', cost: 60, createdAt },
        locked: false,
      },
      {
        reward: { id: 'rew00002', title: 'Nonton bioskop', cost: 800, createdAt },
        locked: true,
      },
    ]);

    store.teardown();
  });

  it('saves a new task from a form draft and persists it', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake);
    const store = createAppStore({ root: null, newId: idFactory() });

    const form: TaskFormDraft = {
      ...emptyTaskFormDraft(),
      familyName: '  Push up routine  ',
      stat: 'STR',
      isAnchor: true,
      variants: [
        { tier: 'easy', description: '10x2 set', points: '5' },
        { tier: 'medium', description: '', points: '' },
        { tier: 'hard', description: '30x4 set', points: '15' },
      ],
    };

    store.saveTask(form, null);

    const state = read<AppState>(store);

    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toMatchObject({
      id: 'id000000',
      familyName: 'Push up routine',
      stat: 'STR',
      isAnchor: true,
      variants: [
        { tier: 'easy', description: '10x2 set', points: 5 },
        { tier: 'hard', description: '30x4 set', points: 15 },
      ],
    });
    expect(state.tasks[0]?.createdAt.startsWith('2026-10-11T09:00:00')).toBe(true);
    expect(JSON.parse(fake.getItem(STORAGE_KEYS.tasks) ?? '[]')).toHaveLength(1);

    store.teardown();
  });

  it('edits a task in place, keeping its id and creation time', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 10, 0, 0));
    const fake = stubStorage();
    seed(fake, { tasks: [anchorTask()] });
    const store = createAppStore({ root: null, newId: idFactory() });

    const form: TaskFormDraft = {
      ...emptyTaskFormDraft(),
      familyName: 'Morning plank',
      stat: 'VIT',
      isAnchor: false,
      variants: [{ tier: 'medium', description: '2 minutes', points: '8' }],
    };

    store.saveTask(form, 'task0001');

    const state = read<AppState>(store);

    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toEqual({
      id: 'task0001',
      familyName: 'Morning plank',
      stat: 'VIT',
      isAnchor: false,
      variants: [{ tier: 'medium', description: '2 minutes', points: 8 }],
      createdAt: '2026-10-01T08:00:00+07:00',
    });

    store.teardown();
  });

  it('saves a new reward from a form draft and persists it', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, { rewards: [aReward()] });
    const store = createAppStore({ root: null, newId: idFactory() });

    const form: RewardFormDraft = {
      ...emptyRewardFormDraft(),
      title: '  Main game 2 jam  ',
      cost: '60',
    };

    store.saveReward(form, null);

    const state = read<AppState>(store);

    expect(state.rewards).toHaveLength(2);
    expect(state.rewards[1]).toMatchObject({
      id: 'id000000',
      title: 'Main game 2 jam',
      cost: 60,
    });
    expect(state.rewards[1]?.createdAt.startsWith('2026-10-11T09:00:00')).toBe(true);
    expect(JSON.parse(fake.getItem(STORAGE_KEYS.rewards) ?? '[]')).toHaveLength(2);

    store.teardown();
  });

  it('edits a reward in place, keeping its id and creation time', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 10, 0, 0));
    const fake = stubStorage();
    seed(fake, { rewards: [aReward()] });
    const store = createAppStore({ root: null, newId: idFactory() });

    const form: RewardFormDraft = { title: 'Main game 2 jam', cost: '120' };

    store.saveReward(form, 'rew00001');

    const state = read<AppState>(store);

    expect(state.rewards).toHaveLength(1);
    expect(state.rewards[0]).toEqual({
      id: 'rew00001',
      title: 'Main game 2 jam',
      cost: 120,
      createdAt: '2026-10-01T08:00:00+07:00',
    });
    expect(JSON.parse(fake.getItem(STORAGE_KEYS.rewards) ?? '[]')).toEqual([
      {
        id: 'rew00001',
        title: 'Main game 2 jam',
        cost: 120,
        createdAt: '2026-10-01T08:00:00+07:00',
      },
    ]);

    store.teardown();
  });

  it('deletes a task and persists the change', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [
        anchorTask(),
        rotatingTask('task0002', 'Dead hang', 'STR'),
        rotatingTask('task0003', 'Jogging', 'VIT'),
      ],
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    store.deleteTask('task0001');

    const state = read<AppState>(store);

    expect(state.tasks.map((task) => task.id)).toEqual(['task0002', 'task0003']);
    expect(JSON.parse(fake.getItem(STORAGE_KEYS.tasks) ?? '[]')).toHaveLength(2);

    store.teardown();
  });

  it('ignores a delete for an unknown task id', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, { tasks: [anchorTask()] });
    const store = createAppStore({ root: null, newId: idFactory() });

    store.deleteTask('does-not-exist');

    expect(read<AppState>(store).tasks).toHaveLength(1);

    store.teardown();
  });

  it('re-picks a replacement rotating task when the open day pick is deleted', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [rotatingTask('task0001', 'Task A', 'STR'), rotatingTask('task0002', 'Task B', 'STR')],
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    const picked = openDayOf(read<AppState>(store)).selectedTaskIdPerStat.STR;
    expect(picked).toBeDefined();
    if (picked === undefined) {
      return;
    }

    store.deleteTask(picked);

    const state = read<AppState>(store);
    const day = openDayOf(state);
    const remaining = picked === 'task0001' ? 'task0002' : 'task0001';

    expect(state.tasks.map((task) => task.id)).toEqual([remaining]);
    expect(day.selectedTaskIdPerStat.STR).toBe(remaining);

    store.teardown();
  });

  it('re-picks the deleted rotating pick by the seeded rule', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [
        rotatingTask('task0001', 'Task A', 'STR'),
        rotatingTask('task0002', 'Task B', 'STR'),
        rotatingTask('task0003', 'Task C', 'STR'),
        rotatingTask('task0004', 'Task D', 'STR'),
      ],
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    const picked = openDayOf(read<AppState>(store)).selectedTaskIdPerStat.STR;
    expect(picked).toBeDefined();
    if (picked === undefined) {
      return;
    }

    store.deleteTask(picked);

    const day = openDayOf(read<AppState>(store));

    expect(day.selectedTaskIdPerStat.STR).not.toBe(picked);
    expect(day.selectedTaskIdPerStat.STR).toBeDefined();
    expect(day.date).toBe(TODAY);

    store.teardown();
  });

  it('leaves the open day pick unchanged when a non-picked rotating task is deleted', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    const ids = ['task0001', 'task0002', 'task0003'];
    seed(fake, {
      tasks: ids.map((id) => rotatingTask(id, `Task ${id}`, 'STR')),
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    const picked = openDayOf(read<AppState>(store)).selectedTaskIdPerStat.STR;
    expect(picked).toBeDefined();
    if (picked === undefined) {
      return;
    }

    const other = ids.find((id) => id !== picked);
    expect(other).toBeDefined();
    if (other === undefined) {
      return;
    }

    store.deleteTask(other);

    const state = read<AppState>(store);

    expect(state.tasks.map((task) => task.id)).not.toContain(other);
    expect(openDayOf(state).selectedTaskIdPerStat.STR).toBe(picked);

    store.teardown();
  });

  it('deleting an anchor task does not touch the rotating pick', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, {
      tasks: [
        anchorTask(),
        rotatingTask('task0002', 'Task B', 'STR'),
        rotatingTask('task0003', 'Task C', 'STR'),
      ],
    });
    const store = createAppStore({ root: null, newId: idFactory() });

    const picked = openDayOf(read<AppState>(store)).selectedTaskIdPerStat.STR;
    expect(picked).toBeDefined();
    if (picked === undefined) {
      return;
    }

    store.deleteTask('task0001');

    const state = read<AppState>(store);

    expect(state.tasks.map((task) => task.id)).toEqual(['task0002', 'task0003']);
    expect(openDayOf(state).selectedTaskIdPerStat.STR).toBe(picked);

    store.teardown();
  });

  it('clears the pick when the deleted rotating task was the only one in its stat', () => {
    vi.setSystemTime(new Date(2026, 9, 11, 9, 0, 0));
    const fake = stubStorage();
    seed(fake, { tasks: [rotatingTask('task0001', 'Task A', 'STR')] });
    const store = createAppStore({ root: null, newId: idFactory() });

    store.deleteTask('task0001');

    const day = openDayOf(read<AppState>(store));

    expect(day.selectedTaskIdPerStat.STR).toBeUndefined();

    store.teardown();
  });
});
