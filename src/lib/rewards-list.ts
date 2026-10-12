import type { Reward, RewardPurchase } from './types';

/** One row of the Rewards page list: a reward, how often it was bought, and whether it is locked (design §5). */
export interface RewardListRow {
  readonly reward: Reward;
  readonly purchaseCount: number;
  readonly locked: boolean;
}

/** The count shown next to the Rewards page title, in rewards (design §5). */
export function rewardCountLabel(count: number): string {
  return `${count} items`;
}

/** How often a reward was bought, `Bought 4 times`, singular for exactly one (design §5). */
export function purchaseCountLabel(count: number): string {
  return count === 1 ? 'Bought 1 time' : `Bought ${count} times`;
}

/**
 * Builds the Rewards page rows (design §5, PRD §2.1 Rewards): one row per reward in stored order,
 * each with its purchase count taken from that reward's logged purchases and whether the Wallet
 * covers its cost. A reward costing exactly the Wallet balance is not locked. Purchases whose reward
 * no longer exists are simply not counted on any row. Pure: it only reads its inputs.
 */
export function buildRewardList(
  rewards: readonly Reward[],
  purchases: readonly RewardPurchase[],
  wallet: number
): RewardListRow[] {
  const counts = new Map<string, number>();

  for (const purchase of purchases) {
    counts.set(purchase.rewardId, (counts.get(purchase.rewardId) ?? 0) + 1);
  }

  return rewards.map((reward) => ({
    reward,
    purchaseCount: counts.get(reward.id) ?? 0,
    locked: wallet < reward.cost,
  }));
}
