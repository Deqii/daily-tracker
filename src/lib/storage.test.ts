import { afterEach, describe, expect, it, vi } from 'vitest';
import { weekStart } from './date';
import {
  BACKUP_KEY,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  createDefaultUserState,
  loadState,
  write,
  type StorageSchema,
} from './storage';
import type { Task } from './types';

class FakeStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
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

function stubStorage(): FakeStorage {
  const fake = new FakeStorage();
  vi.stubGlobal('localStorage', fake);
  return fake;
}

function backupOf(fake: FakeStorage): Record<string, string> {
  const raw = fake.getItem(BACKUP_KEY);

  return raw === null ? {} : (JSON.parse(raw) as Record<string, string>);
}

function sampleTask(): Task {
  return {
    id: 'abcd1234',
    familyName: 'Push up routine',
    stat: 'STR',
    isAnchor: true,
    variants: [{ tier: 'ringan', description: '10 reps', points: 5 }],
    createdAt: '2026-10-04T10:15:30+07:00',
  };
}

const DATA_KEYS = (Object.keys(STORAGE_KEYS) as (keyof StorageSchema)[]).filter(
  (key) => key !== 'schemaVersion'
);

const WRONG_SHAPES: Record<keyof StorageSchema, unknown> = {
  schemaVersion: 'not-a-number',
  tasks: [{ id: 'abcd1234', familyName: 'Push up routine', isAnchor: true }],
  completions: [{}],
  dailyQuestLog: [{}],
  rewards: [{}],
  rewardPurchases: [{}],
  userState: {},
  milestoneEvents: [{ id: 'evt1', type: 'levelUp', localDate: '2026-10-10', from: 1, to: 2 }],
  theme: 'blue',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDefaultUserState defaults', () => {
  it('matches the PRD v2 shape', () => {
    const state = createDefaultUserState('2028-02-29');

    expect(state.rank).toBe('E');
    expect(state.freezesUsedThisWeek).toBe(0);
    expect(state.totalCompletions).toBe(0);
    expect(state.totalPurchases).toBe(0);
    expect(state.equippedTitle).toBeNull();
    expect(state.unlockedTitles).toEqual([]);
    expect(state.penaltyStats).toEqual([]);
    expect(state.statXP).toEqual({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });
  });

  it('lastFreezeWeekReset is a Monday for several today values', () => {
    const cases = ['2028-02-29', '2028-03-01', '2029-01-01', '2024-06-12'];

    for (const today of cases) {
      const state = createDefaultUserState(today);
      expect(state.lastFreezeWeekReset).toBe(weekStart(today));
    }
  });

  it('lastRolloverDate equals today', () => {
    const today = '2028-06-30';
    const state = createDefaultUserState(today);

    expect(state.lastRolloverDate).toBe(today);
  });
});

describe('write', () => {
  it('reports success and persists the value', () => {
    const fake = stubStorage();

    expect(write('tasks', [])).toEqual({ ok: true });
    expect(fake.getItem(STORAGE_KEYS.tasks)).toBe('[]');
  });

  it('reports QUOTA when setItem throws a quota error', () => {
    const fake = stubStorage();
    const quota = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
    vi.spyOn(fake, 'setItem').mockImplementation(() => {
      throw quota;
    });

    const result = write('tasks', []);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('QUOTA');
    }
  });

  it('reports UNKNOWN when setItem throws anything else', () => {
    const fake = stubStorage();
    vi.spyOn(fake, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });

    const result = write('tasks', []);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('UNKNOWN');
    }
  });

  it('reports UNAVAILABLE when localStorage is missing', () => {
    vi.stubGlobal('localStorage', undefined);

    const result = write('tasks', []);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('UNAVAILABLE');
    }
  });
});

describe('loadState', () => {
  it('reports a first run on empty storage and writes defaults', () => {
    const fake = stubStorage();
    const { state, report } = loadState('2026-10-10');

    expect(report).toEqual({
      firstRun: true,
      recoveredKeys: [],
      backupKeys: [],
      schemaMismatch: null,
    });
    expect(state.tasks).toEqual([]);
    expect(state.userState.lastRolloverDate).toBe('2026-10-10');
    expect(fake.getItem(STORAGE_KEYS.schemaVersion)).toBe(String(SCHEMA_VERSION));
    expect(fake.getItem(STORAGE_KEYS.theme)).toBe('"dark"');
  });

  it('uses stored data when the schema version matches', () => {
    const fake = stubStorage();
    const task = sampleTask();
    fake.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
    fake.setItem(STORAGE_KEYS.tasks, JSON.stringify([task]));

    const { state, report } = loadState('2026-10-10');

    expect(report.firstRun).toBe(false);
    expect(report.schemaMismatch).toBeNull();
    expect(report.recoveredKeys).toEqual([]);
    expect(report.backupKeys).toEqual([]);
    expect(state.tasks).toEqual([task]);
  });

  it('never throws when getItem throws', () => {
    const throwing = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {},
      removeItem() {},
      clear() {},
      key() {
        return null;
      },
      length: 0,
    } as unknown as Storage;
    vi.stubGlobal('localStorage', throwing);

    const { state, report } = loadState('2026-10-10');

    expect(report.firstRun).toBe(true);
    expect(state.tasks).toEqual([]);
  });

  it('never throws when setItem fails during recovery', () => {
    const fake = stubStorage();
    vi.spyOn(fake, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });

    const { state, report } = loadState('2026-10-10');

    expect(report.firstRun).toBe(true);
    expect(state.tasks).toEqual([]);
  });

  describe('corrupted JSON per key', () => {
    for (const key of DATA_KEYS) {
      it(`recovers ${key}`, () => {
        const fake = stubStorage();
        const storageKey = STORAGE_KEYS[key];
        fake.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
        fake.setItem(storageKey, '{not valid json');

        const { report } = loadState('2026-10-10');

        expect(report.schemaMismatch).toBeNull();
        expect(report.recoveredKeys).toContain(storageKey);
        expect(report.backupKeys).toContain(storageKey);
        expect(backupOf(fake)[storageKey]).toBe('{not valid json');
        expect(fake.getItem(storageKey)).not.toBe('{not valid json');
      });
    }
  });

  describe('wrong shape per key', () => {
    for (const key of DATA_KEYS) {
      it(`recovers ${key}`, () => {
        const fake = stubStorage();
        const storageKey = STORAGE_KEYS[key];
        const raw = JSON.stringify(WRONG_SHAPES[key]);
        fake.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
        fake.setItem(storageKey, raw);

        const { report } = loadState('2026-10-10');

        expect(report.schemaMismatch).toBeNull();
        expect(report.recoveredKeys).toContain(storageKey);
        expect(backupOf(fake)[storageKey]).toBe(raw);
      });
    }

    it('replaces a corrupt tasks value with defaults', () => {
      const fake = stubStorage();
      fake.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
      fake.setItem(STORAGE_KEYS.tasks, JSON.stringify(WRONG_SHAPES.tasks));

      const { state } = loadState('2026-10-10');

      expect(state.tasks).toEqual([]);
    });
  });

  it('reports a missing schema version while other keys exist as a mismatch', () => {
    const fake = stubStorage();
    const raw = JSON.stringify([sampleTask()]);
    fake.setItem(STORAGE_KEYS.tasks, raw);

    const { state, report } = loadState('2026-10-10');

    expect(report.firstRun).toBe(false);
    expect(report.schemaMismatch).toEqual({ found: null, expected: SCHEMA_VERSION });
    expect(state.tasks).toEqual([]);
    expect(report.recoveredKeys).toContain(STORAGE_KEYS.tasks);
    expect(backupOf(fake)[STORAGE_KEYS.tasks]).toBe(raw);
  });

  it('reports a different schema version as a mismatch and discards every key', () => {
    const fake = stubStorage();
    const raw = JSON.stringify([sampleTask()]);
    fake.setItem(STORAGE_KEYS.schemaVersion, '1');
    fake.setItem(STORAGE_KEYS.tasks, raw);

    const { state, report } = loadState('2026-10-10');

    expect(report.schemaMismatch).toEqual({ found: 1, expected: SCHEMA_VERSION });
    expect(state.tasks).toEqual([]);
    expect(report.recoveredKeys).toEqual(
      expect.arrayContaining([STORAGE_KEYS.schemaVersion, STORAGE_KEYS.tasks])
    );
    const backup = backupOf(fake);
    expect(backup[STORAGE_KEYS.tasks]).toBe(raw);
    expect(backup[STORAGE_KEYS.schemaVersion]).toBe('1');
    expect(fake.getItem(STORAGE_KEYS.schemaVersion)).toBe(String(SCHEMA_VERSION));
  });

  it('keeps only the latest raw value per key across recoveries', () => {
    const fake = stubStorage();
    fake.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
    fake.setItem(STORAGE_KEYS.tasks, 'first-bad');
    loadState('2026-10-10');
    fake.setItem(STORAGE_KEYS.tasks, 'second-bad');
    loadState('2026-10-10');

    const backup = backupOf(fake);

    expect(backup[STORAGE_KEYS.tasks]).toBe('second-bad');
    expect(Object.keys(backup)).toEqual([STORAGE_KEYS.tasks]);
  });
});
