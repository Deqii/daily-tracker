import { describe, expect, it } from 'vitest';
import { selectRewardPreview } from './rewards-preview';
import type { Reward } from './types';

function reward(id: string, cost: number): Reward {
  return { id, title: id, cost, createdAt: '2026-10-01T08:00:00+07:00' };
}

describe('selectRewardPreview', () => {
  it('picks the most expensive affordable reward and the most expensive locked one', () => {
    const rewards = [
      reward('main-game', 60),
      reward('kopi', 35),
      reward('buku', 150),
      reward('jajan', 250),
      reward('bioskop', 800),
    ];

    expect(selectRewardPreview(rewards, 65)).toEqual([
      { reward: rewards[0], locked: false },
      { reward: rewards[4], locked: true },
    ]);
  });

  it('treats a reward costing exactly the balance as affordable', () => {
    const rewards = [reward('exact', 65), reward('over', 66)];

    expect(selectRewardPreview(rewards, 65)).toEqual([
      { reward: rewards[0], locked: false },
      { reward: rewards[1], locked: true },
    ]);
  });

  it('returns only the affordable row when nothing is locked', () => {
    const rewards = [reward('cheap', 10), reward('pricier', 40)];

    expect(selectRewardPreview(rewards, 50)).toEqual([{ reward: rewards[1], locked: false }]);
  });

  it('returns only the locked row when nothing is affordable', () => {
    const rewards = [reward('expensive', 100), reward('priciest', 300)];

    expect(selectRewardPreview(rewards, 0)).toEqual([{ reward: rewards[1], locked: true }]);
  });

  it('returns no rows when there are no rewards', () => {
    expect(selectRewardPreview([], 65)).toEqual([]);
  });

  it('keeps the first reward on a cost tie', () => {
    const rewards = [reward('first', 50), reward('second', 50)];

    expect(selectRewardPreview(rewards, 0)).toEqual([{ reward: rewards[0], locked: true }]);
  });
});
