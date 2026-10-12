import { describe, expect, it } from 'vitest';
import { buildRewardList, purchaseCountLabel, rewardCountLabel } from './rewards-list';
import type { Reward, RewardPurchase } from './types';

function reward(id: string, cost: number): Reward {
  return { id, title: id, cost, createdAt: '2026-10-01T08:00:00+07:00' };
}

function purchase(id: string, rewardId: string): RewardPurchase {
  return {
    id,
    rewardId,
    rewardTitle: rewardId,
    costAtPurchase: 10,
    purchasedAt: '2026-10-02T08:00:00+07:00',
    localDate: '2026-10-02',
  };
}

describe('rewardCountLabel', () => {
  it('writes the item count shown next to the title', () => {
    expect(rewardCountLabel(5)).toBe('5 items');
    expect(rewardCountLabel(0)).toBe('0 items');
  });
});

describe('purchaseCountLabel', () => {
  it('uses the plural for zero and many', () => {
    expect(purchaseCountLabel(0)).toBe('Bought 0 times');
    expect(purchaseCountLabel(4)).toBe('Bought 4 times');
  });

  it('uses the singular for exactly one', () => {
    expect(purchaseCountLabel(1)).toBe('Bought 1 time');
  });
});

describe('buildRewardList', () => {
  it('keeps the stored order and counts the purchases per reward', () => {
    const rewards = [reward('main-game', 60), reward('kopi', 35), reward('buku', 150)];
    const purchases = [
      purchase('p1', 'main-game'),
      purchase('p2', 'main-game'),
      purchase('p3', 'kopi'),
    ];

    expect(buildRewardList(rewards, purchases, 65)).toEqual([
      { reward: rewards[0], purchaseCount: 2, locked: false },
      { reward: rewards[1], purchaseCount: 1, locked: false },
      { reward: rewards[2], purchaseCount: 0, locked: true },
    ]);
  });

  it('treats a reward costing exactly the balance as affordable', () => {
    const rewards = [reward('exact', 65), reward('over', 66)];

    expect(buildRewardList(rewards, [], 65)).toEqual([
      { reward: rewards[0], purchaseCount: 0, locked: false },
      { reward: rewards[1], purchaseCount: 0, locked: true },
    ]);
  });

  it('ignores purchases whose reward no longer exists', () => {
    const rewards = [reward('kept', 10)];

    expect(buildRewardList(rewards, [purchase('p1', 'deleted')], 0)).toEqual([
      { reward: rewards[0], purchaseCount: 0, locked: true },
    ]);
  });

  it('returns no rows when there are no rewards', () => {
    expect(buildRewardList([], [purchase('p1', 'main-game')], 65)).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const rewards = [reward('main-game', 60)];
    const purchases = [purchase('p1', 'main-game')];

    buildRewardList(rewards, purchases, 65);

    expect(rewards).toHaveLength(1);
    expect(purchases).toHaveLength(1);
  });
});
