import { describe, expect, it } from 'vitest';
import {
  groupTasksByStat,
  hasEffortVariants,
  overCapLabel,
  singleTierVariant,
  statSectionLabel,
  taskCountLabel,
  taskPointsLabel,
  taskTag,
  variantPointsLabel,
  type TaskStatGroup,
} from './tasks-list';
import type { Stat, Task } from './types';

function groupOf(groups: readonly TaskStatGroup[], stat: Stat): TaskStatGroup {
  const group = groups.find((entry) => entry.stat === stat);

  if (group === undefined) {
    throw new Error(`missing group ${stat}`);
  }

  return group;
}

function task(id: string, stat: Stat, isAnchor: boolean, points: number[]): Task {
  return {
    id,
    familyName: id,
    stat,
    isAnchor,
    variants: points.map((value, index) => ({
      tier: index === 0 ? 'ringan' : index === 1 ? 'sedang' : 'berat',
      description: id,
      points: value,
    })),
    createdAt: '2026-10-01T08:00:00+07:00',
  };
}

describe('statSectionLabel', () => {
  it('labels every stat as written on the Tasks page', () => {
    expect(statSectionLabel('STR')).toBe('Strength (Str)');
    expect(statSectionLabel('VIT')).toBe('Vitality (Vit)');
    expect(statSectionLabel('INT')).toBe('Intellect (Int)');
    expect(statSectionLabel('DISC')).toBe('Discipline (Disc)');
    expect(statSectionLabel('SOC')).toBe('Social (Soc)');
  });
});

describe('groupTasksByStat', () => {
  it('returns the five stats in fixed order with their tasks', () => {
    const tasks = [
      task('push-up', 'STR', false, [5, 9, 15]),
      task('water', 'VIT', true, [5]),
      task('read', 'INT', false, [5]),
      task('pray', 'DISC', true, [5]),
      task('chat', 'SOC', false, [5]),
      task('dead-hang', 'STR', false, [8]),
    ];

    const groups = groupTasksByStat(tasks);

    expect(groups.map((group) => group.stat)).toEqual(['STR', 'VIT', 'INT', 'DISC', 'SOC']);
    expect(groupOf(groups, 'STR').tasks.map((entry) => entry.id)).toEqual(['push-up', 'dead-hang']);
    expect(groupOf(groups, 'VIT').tasks.map((entry) => entry.id)).toEqual(['water']);
    expect(groupOf(groups, 'SOC').tasks.map((entry) => entry.id)).toEqual(['chat']);
  });

  it('gives a stat with no tasks an empty section', () => {
    const groups = groupTasksByStat([task('push-up', 'STR', false, [5])]);

    expect(groups).toHaveLength(5);
    expect(groupOf(groups, 'VIT').tasks).toEqual([]);
  });

  it('returns five empty sections for no tasks', () => {
    const groups = groupTasksByStat([]);

    expect(groups).toHaveLength(5);
    expect(groups.every((group) => group.tasks.length === 0)).toBe(true);
  });

  it('does not mutate the input', () => {
    const tasks = [task('push-up', 'STR', false, [5])];
    const snapshot = structuredClone(tasks);

    groupTasksByStat(tasks);

    expect(tasks).toEqual(snapshot);
  });
});

describe('taskTag', () => {
  it('tags an anchor task as Anchor', () => {
    expect(taskTag(task('pray', 'DISC', true, [5]))).toBe('Anchor');
  });

  it('tags a rotating task as Rotating', () => {
    expect(taskTag(task('read', 'INT', false, [5]))).toBe('Rotating');
  });
});

describe('taskPointsLabel', () => {
  it('shows one value for a single-tier task', () => {
    expect(taskPointsLabel(task('water', 'VIT', true, [5]))).toBe('5 pts');
  });

  it('shows the lowest to highest variant for a family', () => {
    expect(taskPointsLabel(task('push-up', 'STR', false, [5, 9, 15]))).toBe('5 to 15 pts');
  });

  it('shows one value when every variant shares the same points', () => {
    expect(taskPointsLabel(task('stretch', 'VIT', false, [4, 4]))).toBe('4 pts');
  });
});

describe('taskCountLabel', () => {
  it('renders the task-family count next to the title', () => {
    expect(taskCountLabel(11)).toBe('11 tasks');
  });
});

describe('hasEffortVariants', () => {
  it('is false for a single-tier task', () => {
    expect(hasEffortVariants(task('water', 'VIT', true, [5]))).toBe(false);
  });

  it('is true for a task with several variants', () => {
    expect(hasEffortVariants(task('push-up', 'STR', false, [5, 9, 15]))).toBe(true);
    expect(hasEffortVariants(task('stretch', 'VIT', false, [4, 4]))).toBe(true);
  });
});

describe('singleTierVariant', () => {
  it('returns the one variant of a single-tier task', () => {
    const water = task('water', 'VIT', true, [5]);

    expect(singleTierVariant(water)).toEqual(water.variants[0]);
  });

  it('returns null for a task with no variants', () => {
    const empty: Task = {
      id: 'empty',
      familyName: 'empty',
      stat: 'STR',
      isAnchor: false,
      variants: [],
      createdAt: '2026-10-01T08:00:00+07:00',
    };

    expect(singleTierVariant(empty)).toBeNull();
  });

  it('does not mutate the input', () => {
    const water = task('water', 'VIT', true, [5]);
    const snapshot = structuredClone(water);

    singleTierVariant(water);

    expect(water).toEqual(snapshot);
  });
});

describe('variantPointsLabel', () => {
  it('shows a variant point value before the multiplier', () => {
    expect(variantPointsLabel(5)).toBe('5 pts');
    expect(variantPointsLabel(15)).toBe('15 pts');
  });
});

describe('overCapLabel', () => {
  it('flags a variant stored above the rank cap with the cap it counts as', () => {
    expect(overCapLabel(20, 15)).toBe('Over cap: counts as 15');
  });

  it('is null when the variant is within the cap or exactly at it', () => {
    expect(overCapLabel(10, 15)).toBeNull();
    expect(overCapLabel(15, 15)).toBeNull();
  });

  it('is null at an uncapped rank', () => {
    expect(overCapLabel(500, null)).toBeNull();
  });
});
