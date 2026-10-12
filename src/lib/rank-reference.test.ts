import { describe, expect, it } from 'vitest';
import {
  rankLevelRange,
  rankMaxPoints,
  rankMultiplier,
  rankReferenceRows,
} from './rank-reference';

describe('rankLevelRange', () => {
  it('joins a closed range with an en dash', () => {
    expect(rankLevelRange(1, 5)).toBe('1–5');
    expect(rankLevelRange(21, 35)).toBe('21–35');
  });

  it('marks the open-ended top rank with a plus', () => {
    expect(rankLevelRange(51, Number.POSITIVE_INFINITY)).toBe('51+');
  });
});

describe('rankMultiplier', () => {
  it('keeps a trailing decimal for whole multipliers', () => {
    expect(rankMultiplier(1)).toBe('×1.0');
  });

  it('renders the fractional multipliers verbatim', () => {
    expect(rankMultiplier(0.5)).toBe('×0.5');
    expect(rankMultiplier(0.7)).toBe('×0.7');
    expect(rankMultiplier(0.85)).toBe('×0.85');
    expect(rankMultiplier(1.15)).toBe('×1.15');
    expect(rankMultiplier(1.3)).toBe('×1.3');
  });
});

describe('rankMaxPoints', () => {
  it('renders a numeric cap as a string', () => {
    expect(rankMaxPoints(15)).toBe('15');
  });

  it('renders an uncapped rank as unlimited', () => {
    expect(rankMaxPoints(null)).toBe('unlimited');
  });
});

describe('rankReferenceRows', () => {
  it('matches the PRD rank table, lowest rank first', () => {
    expect(rankReferenceRows()).toEqual([
      {
        rank: 'E',
        levelRange: '1–5',
        freezesPerWeek: 1,
        maxPointsPerTask: '15',
        multiplier: '×0.5',
        penalty: 5,
      },
      {
        rank: 'D',
        levelRange: '6–10',
        freezesPerWeek: 1,
        maxPointsPerTask: '25',
        multiplier: '×0.7',
        penalty: 8,
      },
      {
        rank: 'C',
        levelRange: '11–20',
        freezesPerWeek: 2,
        maxPointsPerTask: '40',
        multiplier: '×0.85',
        penalty: 13,
      },
      {
        rank: 'B',
        levelRange: '21–35',
        freezesPerWeek: 2,
        maxPointsPerTask: '60',
        multiplier: '×1.0',
        penalty: 20,
      },
      {
        rank: 'A',
        levelRange: '36–50',
        freezesPerWeek: 3,
        maxPointsPerTask: '90',
        multiplier: '×1.15',
        penalty: 30,
      },
      {
        rank: 'S',
        levelRange: '51+',
        freezesPerWeek: 3,
        maxPointsPerTask: 'unlimited',
        multiplier: '×1.3',
        penalty: 45,
      },
    ]);
  });
});
