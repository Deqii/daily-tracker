import { describe, expect, it } from 'vitest';
import type { Reward, RewardPurchase, UserState } from '../lib/types';
import { purchaseReward } from './purchase';
import type { AppState } from './state';

const reward = (id: string, title: string, cost: number): Reward => ({
  id,
  title,
  cost,
  createdAt: '2026-10-01T00:00:00+00:00',
});

const userState = (wallet: number, totalPurchases = 0): UserState => ({
  lifetimeXP: 100,
  wallet,
  statXP: { STR: 20, VIT: 20, INT: 20, DISC: 20, SOC: 20 },
  rank: 'E',
  currentStreak: 0,
  freezesUsedThisWeek: 0,
  lastFreezeWeekReset: '2026-10-05',
  penaltyStats: [],
  equippedTitle: null,
  unlockedTitles: [],
  totalCompletions: 0,
  totalPurchases,
  lastRolloverDate: '2026-10-10',
});

const makeState = (
  options: { wallet?: number; rewards?: Reward[]; purchases?: RewardPurchase[] } = {}
): AppState => ({
  tasks: [],
  completions: [],
  dailyQuestLog: [],
  rewards: options.rewards ?? [reward('r1', 'Teh', 10)],
  rewardPurchases: options.purchases ?? [],
  userState: userState(options.wallet ?? 100),
  milestoneEvents: [],
});

const ids = (): (() => string) => {
  let next = 0;

  return () => `id${++next}`;
};

const now = new Date('2026-10-10T12:00:00');

describe('purchaseReward', () => {
  it('deducts the cost from Wallet only and leaves an exact balance at 0', () => {
    const result = purchaseReward(makeState({ wallet: 10 }), 'r1', now, ids());

    if (!result.ok) {
      throw new Error('Expected a successful purchase');
    }

    expect(result.value.state.userState.wallet).toBe(0);
    expect(result.value.state.userState.lifetimeXP).toBe(100);
    expect(result.value.state.userState.statXP).toEqual({
      STR: 20,
      VIT: 20,
      INT: 20,
      DISC: 20,
      SOC: 20,
    });
  });

  it('fails without changing anything when one point is short', () => {
    const result = purchaseReward(makeState({ wallet: 9 }), 'r1', now, ids());

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected a failed purchase');
    }

    expect(result.error).toBe('INSUFFICIENT_WALLET');
  });

  it('rejects an unknown reward id', () => {
    const result = purchaseReward(makeState(), 'missing', now, ids());

    expect(result).toEqual({ ok: false, error: 'REWARD_NOT_FOUND' });
  });

  it('repeats purchases, logging each entry with a snapshot of the reward at purchase time', () => {
    const first = purchaseReward(makeState(), 'r1', now, ids());

    if (!first.ok) {
      throw new Error('Expected a successful purchase');
    }

    expect(first.value.state.userState.wallet).toBe(90);
    expect(first.value.state.userState.totalPurchases).toBe(1);
    expect(first.value.state.rewardPurchases).toHaveLength(1);
    expect(first.value.purchase).toMatchObject({ rewardTitle: 'Teh', costAtPurchase: 10 });

    const editedRewards = first.value.state.rewards.map((candidate) =>
      candidate.id === 'r1' ? { ...candidate, title: 'Kopi', cost: 50 } : candidate
    );
    const second = purchaseReward(
      { ...first.value.state, rewards: editedRewards },
      'r1',
      now,
      ids()
    );

    if (!second.ok) {
      throw new Error('Expected a successful purchase');
    }

    expect(second.value.state.userState.wallet).toBe(40);
    expect(second.value.state.userState.totalPurchases).toBe(2);
    expect(second.value.state.rewardPurchases).toHaveLength(2);
    expect(second.value.state.rewardPurchases[0]).toMatchObject({
      rewardTitle: 'Teh',
      costAtPurchase: 10,
    });
    expect(second.value.state.rewardPurchases[1]).toMatchObject({
      rewardTitle: 'Kopi',
      costAtPurchase: 50,
    });
  });

  it('logs the purchase with the local date, a timestamp, and a fresh id', () => {
    const result = purchaseReward(makeState(), 'r1', now, ids());

    if (!result.ok) {
      throw new Error('Expected a successful purchase');
    }

    expect(result.value.purchase).toMatchObject({
      id: 'id1',
      rewardId: 'r1',
      localDate: '2026-10-10',
    });
    expect(result.value.purchase.purchasedAt).toContain('T');
  });
});
