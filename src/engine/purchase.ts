import type { RewardPurchase } from '../lib/types';
import { toLocalDate, toTimestamp } from '../lib/date';
import type { AppState, Result } from './state';

export type PurchaseError = 'REWARD_NOT_FOUND' | 'INSUFFICIENT_WALLET';

export type PurchaseResult = Result<{ state: AppState; purchase: RewardPurchase }, PurchaseError>;

/**
 * Buys a repeatable reward with Wallet (PRD §7.7, decisions D7). Enforces `wallet >= cost`, deducts
 * from Wallet only (Lifetime XP and `statXP` are never touched), appends a `RewardPurchase` that
 * snapshots the reward's title and cost at that moment, and bumps `totalPurchases`. Because of the
 * snapshot, a later edit or deletion of the reward does not change history. Never mutates its input.
 */
export function purchaseReward(
  state: AppState,
  rewardId: string,
  now: Date,
  newId: () => string
): PurchaseResult {
  const reward = state.rewards.find((candidate) => candidate.id === rewardId);

  if (reward === undefined) {
    return { ok: false, error: 'REWARD_NOT_FOUND' };
  }

  if (state.userState.wallet < reward.cost) {
    return { ok: false, error: 'INSUFFICIENT_WALLET' };
  }

  const purchase: RewardPurchase = {
    id: newId(),
    rewardId,
    rewardTitle: reward.title,
    costAtPurchase: reward.cost,
    purchasedAt: toTimestamp(now),
    localDate: toLocalDate(now),
  };

  return {
    ok: true,
    value: {
      state: {
        ...state,
        rewardPurchases: [...state.rewardPurchases, purchase],
        userState: {
          ...state.userState,
          wallet: state.userState.wallet - reward.cost,
          totalPurchases: state.userState.totalPurchases + 1,
        },
      },
      purchase,
    },
  };
}
