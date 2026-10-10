import { describe, expect, it } from 'vitest';
import { addDays, eachDay } from '../lib/date';
import type { Stat, Task } from '../lib/types';
import { getQuestStats, selectDailyTasks } from './daily';

const task = (id: string, stat: Stat, isAnchor: boolean): Task => ({
  id,
  familyName: `Task ${id}`,
  stat,
  isAnchor,
  variants: [{ tier: 'ringan', description: 'A short effort', points: 5 }],
  createdAt: '2026-10-10T10:00:00+07:00',
});

const pushes = [
  task('push-01', 'STR', true),
  task('push-02', 'STR', false),
  task('push-03', 'STR', false),
  task('push-04', 'STR', false),
];

const water = [task('water-01', 'VIT', true), task('water-02', 'VIT', false)];

const solo = [task('solo-01', 'INT', false)];

describe('getQuestStats', () => {
  it('returns an empty list for no tasks', () => {
    expect(getQuestStats([])).toEqual([]);
  });

  it('returns stats in the fixed order regardless of input order', () => {
    const mixed = [...pushes, ...water, ...solo].reverse();

    expect(getQuestStats(mixed)).toEqual(['STR', 'VIT', 'INT']);
  });

  it('omits stats without any task and includes stats that have only anchors', () => {
    const tasks = [task('plank', 'DISC', true), ...water];

    expect(getQuestStats(tasks)).toEqual(['VIT', 'DISC']);
  });
});

describe('selectDailyTasks', () => {
  it('is deterministic for the same tasks and date', () => {
    expect(selectDailyTasks(pushes, '2026-10-10')).toEqual(selectDailyTasks(pushes, '2026-10-10'));
  });

  it('does not depend on the input order', () => {
    const shuffled = [...pushes, ...water, ...solo].reverse();

    expect(selectDailyTasks(shuffled, '2026-10-10')).toEqual(
      selectDailyTasks([...pushes, ...water, ...solo], '2026-10-10')
    );
  });

  it('picks one rotating task per quest-active stat and never an anchor', () => {
    const tasks = [...pushes, ...water, ...solo];
    const picks = selectDailyTasks(tasks, '2026-10-10');

    expect(Object.keys(picks).sort()).toEqual(['INT', 'STR', 'VIT']);
    expect(picks.INT).toBe('solo-01');
    expect(picks.VIT).toBe('water-02');
    expect(pushes.filter((t) => t.isAnchor).map((t) => t.id)).not.toContain(picks.STR);
  });

  it('returns an empty object when there is nothing to pick', () => {
    expect(selectDailyTasks([], '2026-10-10')).toEqual({});
    expect(selectDailyTasks([task('plank', 'SOC', true)], '2026-10-10')).toEqual({});
  });

  it('a stat with a single rotating task always gets that task', () => {
    for (const date of ['2026-10-10', '2026-10-11', '2026-10-12']) {
      expect(selectDailyTasks([...solo, ...water], date).INT).toBe('solo-01');
    }
  });

  it('each of three candidates appears at least once over 60 consecutive dates', () => {
    const candidates = pushes.filter((t) => !t.isAnchor).map((t) => t.id);
    const days = eachDay('2029-12-25', addDays('2029-12-25', 60));
    const seen = new Set<string>();

    for (const date of days) {
      const pick = selectDailyTasks(pushes, date).STR;

      if (pick !== undefined) {
        seen.add(pick);
      }
    }

    for (const id of candidates) {
      expect(seen.has(id)).toBe(true);
    }
  });

  it('works across month and year boundaries with valid, deterministic picks', () => {
    const dates = ['2029-12-31', '2030-01-01', '2030-02-28', '2031-01-01'];

    for (const date of dates) {
      const picks = selectDailyTasks(pushes, date);

      expect(pushes.map((t) => t.id)).toContain(picks.STR);
      expect(picks).toEqual(selectDailyTasks(pushes, date));
    }
  });
});
