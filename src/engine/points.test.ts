import { describe, expect, it } from 'vitest';
import type { Rank, Task } from '../lib/types';
import { isWithinPointCap, pointsAwarded, taskExceedsPointCap } from './points';

describe('pointsAwarded', () => {
  describe('rank E (cap 15, multiplier 0.5)', () => {
    it('awards ceil(nominal x multiplier) at and below the cap', () => {
      expect(pointsAwarded(5, 'E')).toBe(3);
      expect(pointsAwarded(15, 'E')).toBe(8);
    });

    it('clamps a nominal above the cap to the cap', () => {
      expect(pointsAwarded(16, 'E')).toBe(8);
      expect(pointsAwarded(40, 'E')).toBe(8);
    });
  });

  describe('every rank', () => {
    const cappedRanks: { rank: Rank; cap: number; multiplier: number }[] = [
      { rank: 'E', cap: 15, multiplier: 0.5 },
      { rank: 'D', cap: 25, multiplier: 0.7 },
      { rank: 'C', cap: 40, multiplier: 0.85 },
      { rank: 'B', cap: 60, multiplier: 1 },
      { rank: 'A', cap: 90, multiplier: 1.15 },
    ];

    it.each(cappedRanks)(
      'rank $rank awards ceil(cap x multiplier) at the cap and one above it',
      ({ rank, cap, multiplier }) => {
        const atCap = Math.ceil(cap * multiplier);

        expect(pointsAwarded(cap, rank)).toBe(atCap);
        expect(pointsAwarded(cap + 1, rank)).toBe(atCap);
      }
    );

    it('rank S is uncapped and accepts large values', () => {
      expect(pointsAwarded(1000, 'S')).toBe(1300);
    });
  });
});

describe('isWithinPointCap', () => {
  it('rejects non-integers, non-finite values, and values below 1', () => {
    const invalid = [0, 0.5, 2.5, -1, Number.NaN, Number.POSITIVE_INFINITY];

    for (const points of invalid) {
      expect(isWithinPointCap(points, 'E')).toEqual({
        ok: false,
        reason: 'INVALID_NUMBER',
        cap: 15,
      });
    }
  });

  it('accepts a value at the cap', () => {
    expect(isWithinPointCap(15, 'E')).toEqual({ ok: true });
  });

  it('reports a value above the cap together with the cap', () => {
    expect(isWithinPointCap(16, 'E')).toEqual({ ok: false, reason: 'ABOVE_CAP', cap: 15 });
  });

  it('has no cap at rank S, so large values are accepted', () => {
    expect(isWithinPointCap(1000, 'S')).toEqual({ ok: true });
    expect(isWithinPointCap(1, 'S')).toEqual({ ok: true });
    expect(isWithinPointCap(1.5, 'S').ok).toBe(false);
  });
});

describe('taskExceedsPointCap', () => {
  const task: Task = {
    id: 'task0001',
    familyName: 'Push up routine',
    stat: 'STR',
    isAnchor: true,
    variants: [
      { tier: 'ringan', description: '10 reps', points: 5 },
      { tier: 'berat', description: '40 reps', points: 40 },
    ],
    createdAt: '2026-10-10T10:00:00+07:00',
  };

  it('is true when a variant is above the cap', () => {
    expect(taskExceedsPointCap(task, 'E')).toBe(true);
  });

  it('is false when every variant fits the cap', () => {
    expect(taskExceedsPointCap(task, 'B')).toBe(false);
  });

  it('is true when a variant is not a whole number of 1 or more', () => {
    const invalidTask: Task = {
      ...task,
      variants: [{ tier: 'ringan', description: '10 reps', points: 0.5 }],
    };

    expect(taskExceedsPointCap(invalidTask, 'S')).toBe(true);
  });
});
