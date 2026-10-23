import { describe, expect, it } from 'vitest';
import {
  TASKS_STATS,
  TASKS_TIERS,
  capHint,
  drawerDraftToTaskFormDraft,
  emptyDrawerDraft,
  emptyTasksFilter,
  filterTasks,
  overCapBanner,
  overCapVariantCount,
  pickedTaskIds,
  rankCap,
  statDisplay,
  taskToDrawerDraft,
  tasksSummary,
  validateDrawerDraft,
  variantXp,
  type DrawerDraft,
} from './tasks-page';
import type { DailyQuestDay, Rank, Stat, Task } from './types';

function task(id: string, stat: Stat, isAnchor: boolean, points: number[]): Task {
  return {
    id,
    familyName: id,
    stat,
    isAnchor,
    variants: points.map((value, index) => ({
      tier: index === 0 ? 'easy' : index === 1 ? 'medium' : 'hard',
      description: id,
      points: value,
    })),
    createdAt: '2026-10-01T08:00:00+07:00',
  };
}

function day(selectedTaskIdPerStat: DailyQuestDay['selectedTaskIdPerStat']): DailyQuestDay {
  return {
    date: '2026-10-15',
    selectedTaskIdPerStat,
    requiredCompletions: { STR: 1, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    actualCompletions: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    netPointsChange: 0,
    freezeUsed: false,
    closed: false,
    lifetimeXPEnd: null,
    levelEnd: null,
    rankEnd: null,
  };
}

function draft(overrides: Partial<DrawerDraft> = {}): DrawerDraft {
  return { ...emptyDrawerDraft(), familyName: 'Push up', ...overrides };
}

describe('TASKS_STATS', () => {
  it('lists the five stats in the prototype order with their labels', () => {
    expect(TASKS_STATS.map((entry) => entry.stat)).toEqual(['STR', 'VIT', 'INT', 'DISC', 'SOC']);
    expect(TASKS_STATS.map((entry) => entry.label)).toEqual([
      'Strength (Str)',
      'Vitality (Vit)',
      'Intellect (Int)',
      'Discipline (Disc)',
      'Social (Soc)',
    ]);
    expect(TASKS_STATS.map((entry) => entry.short)).toEqual(['Str', 'Vit', 'Int', 'Disc', 'Soc']);
  });
});

describe('TASKS_TIERS', () => {
  it('lists easy, medium and hard in the prototype order', () => {
    expect(TASKS_TIERS.map((entry) => entry.tier)).toEqual(['easy', 'medium', 'hard']);
    expect(TASKS_TIERS.map((entry) => entry.name)).toEqual(['Easy', 'Medium', 'Hard']);
  });
});

describe('filterTasks', () => {
  const tasks = [
    task('Push up routine', 'STR', false, [5]),
    task('Squat', 'STR', true, [5]),
    task('Minum air', 'VIT', true, [3]),
  ];

  it('returns every task for the empty filter, in stored order', () => {
    expect(filterTasks(tasks, emptyTasksFilter()).map((entry) => entry.id)).toEqual([
      'Push up routine',
      'Squat',
      'Minum air',
    ]);
  });

  it('matches the query case-insensitively on the family name', () => {
    expect(filterTasks(tasks, { ...emptyTasksFilter(), query: 'PUSH' }).map((t) => t.id)).toEqual([
      'Push up routine',
    ]);
  });

  it('combines the stat and type filters', () => {
    expect(
      filterTasks(tasks, { query: '', stat: 'STR', type: 'Anchor' }).map((entry) => entry.id)
    ).toEqual(['Squat']);
  });

  it('returns nothing when no task matches', () => {
    expect(filterTasks(tasks, { query: 'zzz', stat: 'ALL', type: 'ALL' })).toEqual([]);
  });
});

describe('tasksSummary', () => {
  it('counts total, anchors and rotating tasks', () => {
    const tasks = [
      task('push', 'STR', false, [5]),
      task('water', 'VIT', true, [3]),
      task('pray', 'DISC', true, [3]),
    ];

    expect(tasksSummary(tasks)).toBe('3 tasks · 2 anchor · 1 rotating');
  });

  it('works for an empty library', () => {
    expect(tasksSummary([])).toBe('0 tasks · 0 anchor · 0 rotating');
  });
});

describe('overCapVariantCount and overCapBanner', () => {
  const tasks = [
    task('push', 'STR', false, [5, 20, 30]),
    task('read', 'INT', false, [3]),
    task('focus', 'DISC', false, [6, 16]),
  ];

  it('counts every variant above the cap across tasks', () => {
    expect(overCapVariantCount(tasks, 15)).toBe(3);
  });

  it('counts nothing at an uncapped rank', () => {
    expect(overCapVariantCount(tasks, null)).toBe(0);
  });

  it('builds the singular banner copy', () => {
    expect(overCapBanner([task('focus', 'DISC', false, [16])], 15, 'E')).toEqual({
      count: 1,
      label: '1 variant over the cap',
      detail: 'Max 15 points at Rank E. Over-cap variants count as 15.',
    });
  });

  it('builds the plural banner copy', () => {
    expect(overCapBanner(tasks, 15, 'D')).toMatchObject({
      count: 3,
      label: '3 variants over the cap',
    });
  });

  it('hides the banner when nothing is over the cap or the rank is uncapped', () => {
    expect(overCapBanner([task('read', 'INT', false, [3])], 15, 'E')).toBeNull();
    expect(overCapBanner(tasks, null, 'S')).toBeNull();
  });
});

describe('pickedTaskIds', () => {
  it('collects the open day selections without duplicates', () => {
    const ids = pickedTaskIds(day({ STR: 'a', VIT: 'b', INT: 'a', SOC: 'c' }));

    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });

  it('is empty before the first day exists', () => {
    expect(pickedTaskIds(undefined).size).toBe(0);
  });
});

describe('rankCap and capHint', () => {
  it('reads the cap from the engine for every rank', () => {
    const caps = (['E', 'D', 'C', 'B', 'A', 'S'] as Rank[]).map((rank) => rankCap(rank));

    expect(caps).toEqual([15, 25, 40, 60, 90, null]);
  });

  it('prints the cap line at a capped rank', () => {
    expect(capHint('E')).toBe('Up to 3 tiers · Max 15 pts at Rank E');
  });

  it('omits the cap line at an uncapped rank', () => {
    expect(capHint('S')).toBe('Up to 3 tiers');
  });
});

describe('variantXp', () => {
  it('uses the engine cap and multiplier for the XP preview', () => {
    expect(variantXp(5, 'E')).toBe(3);
    expect(variantXp(25, 'E')).toBe(8);
    expect(variantXp(25, 'S')).toBe(33);
  });
});

describe('emptyDrawerDraft', () => {
  it('starts with easy enabled and its prototype defaults', () => {
    const value = emptyDrawerDraft();

    expect(value.familyName).toBe('');
    expect(value.stat).toBe('STR');
    expect(value.isAnchor).toBe(false);
    expect(value.variants).toEqual([
      { tier: 'easy', enabled: true, description: '', points: '5' },
      { tier: 'medium', enabled: false, description: '', points: '12' },
      { tier: 'hard', enabled: false, description: '', points: '25' },
    ]);
  });
});

describe('taskToDrawerDraft', () => {
  it('enables the stored tiers and keeps the others at their defaults', () => {
    const value = taskToDrawerDraft({
      ...task('push', 'VIT', true, [5, 12]),
      familyName: 'Push up',
    });

    expect(value).toEqual({
      familyName: 'Push up',
      stat: 'VIT',
      isAnchor: true,
      variants: [
        { tier: 'easy', enabled: true, description: 'push', points: '5' },
        { tier: 'medium', enabled: true, description: 'push', points: '12' },
        { tier: 'hard', enabled: false, description: '', points: '25' },
      ],
    });
  });
});

describe('validateDrawerDraft', () => {
  it('accepts a valid single-tier draft', () => {
    const errors = validateDrawerDraft(
      draft({ variants: [{ tier: 'easy', enabled: true, description: '10 reps', points: '5' }] }),
      'E'
    );

    expect(errors.valid).toBe(true);
    expect(errors.familyName).toBe(false);
  });

  it('reports the name before any tier problem', () => {
    const errors = validateDrawerDraft(
      draft({
        familyName: '  ',
        variants: [{ tier: 'easy', enabled: true, description: '', points: '' }],
      }),
      'E'
    );

    expect(errors.familyName).toBe(true);
    expect(errors.valid).toBe(false);
  });

  it('requires a description before points', () => {
    const errors = validateDrawerDraft(
      draft({ variants: [{ tier: 'easy', enabled: true, description: '', points: '' }] }),
      'E'
    );

    expect(errors.variants[0]).toEqual({
      description: true,
      points: null,
      overCap: null,
    });
  });

  it('distinguishes missing points from invalid points', () => {
    const missing = validateDrawerDraft(
      draft({ variants: [{ tier: 'easy', enabled: true, description: '10 reps', points: '' }] }),
      'E'
    );
    const invalid = validateDrawerDraft(
      draft({ variants: [{ tier: 'easy', enabled: true, description: '10 reps', points: '2.5' }] }),
      'E'
    );

    expect(missing.variants[0]?.points).toBe('MISSING');
    expect(invalid.variants[0]?.points).toBe('INVALID');
  });

  it('rejects points above the rank cap and reports the cap', () => {
    const errors = validateDrawerDraft(
      draft({ variants: [{ tier: 'easy', enabled: true, description: '10 reps', points: '16' }] }),
      'E'
    );

    expect(errors.variants[0]?.overCap).toBe(15);
    expect(errors.valid).toBe(false);
  });

  it('ignores disabled tiers entirely', () => {
    const errors = validateDrawerDraft(
      draft({
        variants: [
          { tier: 'easy', enabled: true, description: '10 reps', points: '5' },
          { tier: 'medium', enabled: false, description: '', points: 'bad' },
        ],
      }),
      'E'
    );

    expect(errors.valid).toBe(true);
    expect(errors.variants[1]).toEqual({ description: false, points: null, overCap: null });
  });

  it('asks for a variant only when nothing else is wrong', () => {
    const errors = validateDrawerDraft(
      draft({
        variants: [
          { tier: 'easy', enabled: false, description: '', points: '' },
          { tier: 'medium', enabled: false, description: '', points: '' },
        ],
      }),
      'E'
    );

    expect(errors.noVariant).toBe(true);
    expect(errors.valid).toBe(false);
  });

  it('does not show the no-variant message while the name is missing', () => {
    const errors = validateDrawerDraft(
      draft({
        familyName: '',
        variants: [{ tier: 'easy', enabled: false, description: '', points: '' }],
      }),
      'E'
    );

    expect(errors.familyName).toBe(true);
    expect(errors.noVariant).toBe(false);
  });

  it('accepts points exactly at the cap', () => {
    const errors = validateDrawerDraft(
      draft({ variants: [{ tier: 'easy', enabled: true, description: '10 reps', points: '15' }] }),
      'E'
    );

    expect(errors.valid).toBe(true);
  });
});

describe('drawerDraftToTaskFormDraft', () => {
  it('keeps every tier in order and blanks the disabled rows', () => {
    const form = drawerDraftToTaskFormDraft(
      draft({
        variants: [
          { tier: 'easy', enabled: true, description: '10 reps', points: '5' },
          { tier: 'medium', enabled: false, description: '20 reps', points: '12' },
          { tier: 'hard', enabled: true, description: '30 reps', points: '25' },
        ],
      })
    );

    expect(form).toEqual({
      familyName: 'Push up',
      stat: 'STR',
      isAnchor: false,
      variants: [
        { tier: 'easy', description: '10 reps', points: '5' },
        { tier: 'medium', description: '', points: '' },
        { tier: 'hard', description: '30 reps', points: '25' },
      ],
    });
  });
});

describe('statDisplay', () => {
  it('returns the label for a stat', () => {
    expect(statDisplay('DISC')).toMatchObject({
      stat: 'DISC',
      label: 'Discipline (Disc)',
      short: 'Disc',
    });
  });
});
