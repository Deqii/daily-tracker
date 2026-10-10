import { describe, expect, it } from 'vitest';
import type { Rank } from '../lib/types';
import type { StatXP } from './balance';
import { getRankConfig, rank, resolveRank } from './rank';

const statXP = (values: Partial<StatXP>): StatXP => ({
  STR: 0,
  VIT: 0,
  INT: 0,
  DISC: 0,
  SOC: 0,
  ...values,
});

const balanced: StatXP = statXP({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 100 });
const unbalanced: StatXP = statXP({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 10 });
const allEven: StatXP = statXP({ STR: 72, VIT: 72, INT: 72, DISC: 72, SOC: 72 });

describe('resolveRank', () => {
  it('matches Appendix A scenario 3: the drop is immediate and ungated', () => {
    expect(resolveRank('D', 5, allEven)).toEqual({ rank: 'E', change: 'down', blocked: false });
  });

  it('drops across several ranks and ignores the balance gate on the way down', () => {
    expect(resolveRank('C', 4, unbalanced)).toEqual({ rank: 'E', change: 'down', blocked: false });
  });

  it('matches scenario 4 rank resolution lines', () => {
    expect(resolveRank('E', 6, unbalanced)).toEqual({ rank: 'E', change: null, blocked: true });
    expect(resolveRank('E', 6, balanced)).toEqual({ rank: 'D', change: 'up', blocked: false });
    expect(resolveRank('E', 12, balanced)).toEqual({ rank: 'C', change: 'up', blocked: false });
    expect(resolveRank('D', 4, balanced)).toEqual({ rank: 'E', change: 'down', blocked: false });
  });

  it('is unchanged when the current rank already equals the level rank', () => {
    expect(resolveRank('D', 7, unbalanced)).toEqual({ rank: 'D', change: null, blocked: false });
  });

  it('re-climbing after a drop needs the balance gate again', () => {
    expect(resolveRank('D', 4, balanced)).toEqual({ rank: 'E', change: 'down', blocked: false });
    expect(resolveRank('E', 6, unbalanced)).toEqual({ rank: 'E', change: null, blocked: true });
    expect(resolveRank('E', 6, balanced)).toEqual({ rank: 'D', change: 'up', blocked: false });
  });
});

describe('rank', () => {
  const transitions: [level: number, expected: Rank][] = [
    [1, 'E'],
    [5, 'E'],
    [6, 'D'],
    [10, 'D'],
    [11, 'C'],
    [20, 'C'],
    [21, 'B'],
    [35, 'B'],
    [36, 'A'],
    [50, 'A'],
    [51, 'S'],
    [999, 'S'],
  ];

  it.each(transitions)('maps level %i to rank %s (PRD Appendix B)', (level, expected) => {
    expect(rank(level)).toBe(expected);
  });
});

describe('getRankConfig', () => {
  it('returns the Rank table row for each rank (PRD §2.1)', () => {
    expect(getRankConfig('E')).toEqual({
      rank: 'E',
      minLevel: 1,
      maxLevel: 5,
      freezesPerWeek: 1,
      maxPointsPerTask: 15,
      xpMultiplier: 0.5,
      penalty: 5,
    });
    expect(getRankConfig('D')).toEqual({
      rank: 'D',
      minLevel: 6,
      maxLevel: 10,
      freezesPerWeek: 1,
      maxPointsPerTask: 25,
      xpMultiplier: 0.7,
      penalty: 8,
    });
    expect(getRankConfig('C')).toEqual({
      rank: 'C',
      minLevel: 11,
      maxLevel: 20,
      freezesPerWeek: 2,
      maxPointsPerTask: 40,
      xpMultiplier: 0.85,
      penalty: 13,
    });
    expect(getRankConfig('B')).toEqual({
      rank: 'B',
      minLevel: 21,
      maxLevel: 35,
      freezesPerWeek: 2,
      maxPointsPerTask: 60,
      xpMultiplier: 1,
      penalty: 20,
    });
    expect(getRankConfig('A')).toEqual({
      rank: 'A',
      minLevel: 36,
      maxLevel: 50,
      freezesPerWeek: 3,
      maxPointsPerTask: 90,
      xpMultiplier: 1.15,
      penalty: 30,
    });
    expect(getRankConfig('S')).toEqual({
      rank: 'S',
      minLevel: 51,
      maxLevel: Number.POSITIVE_INFINITY,
      freezesPerWeek: 3,
      maxPointsPerTask: null,
      xpMultiplier: 1.3,
      penalty: 45,
    });
  });

  it('covers every level with exactly one rank', () => {
    for (let level = 1; level <= 60; level += 1) {
      const matches = (['E', 'D', 'C', 'B', 'A', 'S'] as const).filter(
        (target) =>
          level >= getRankConfig(target).minLevel && level <= getRankConfig(target).maxLevel
      );

      expect(matches).toEqual([rank(level)]);
    }
  });
});
