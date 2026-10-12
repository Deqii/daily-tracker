import { describe, expect, it } from 'vitest';
import { TITLES, type TitleId } from '../engine/titles';
import { titleUnlockCondition } from './title-condition';

const EXPECTED: Record<TitleId, string> = {
  'streak-7': 'Reach a 7-day streak',
  'streak-30': 'Reach a 30-day streak',
  'first-reward': 'Buy your first reward',
  'rank-d': 'Reach Rank D',
  'rank-c': 'Reach Rank C',
  'rank-b': 'Reach Rank B',
  'rank-a': 'Reach Rank A',
  'rank-s': 'Reach Rank S',
  'completions-100': 'Complete 100 tasks',
};

describe('titleUnlockCondition', () => {
  it('returns the design §7 text for every catalog title', () => {
    for (const title of TITLES) {
      expect(titleUnlockCondition(title.id)).toBe(EXPECTED[title.id]);
    }
  });

  it('covers every catalog id and no others', () => {
    expect(TITLES.map((title) => title.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('renders every rank condition as Reach Rank {letter}', () => {
    for (const rank of ['D', 'C', 'B', 'A', 'S'] as const) {
      const id = `rank-${rank.toLowerCase()}` as TitleId;

      expect(titleUnlockCondition(id)).toBe(`Reach Rank ${rank}`);
    }
  });
});
