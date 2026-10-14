import type { Reward } from './types';

/** One row of the Today Rewards preview: a reward and whether the Wallet can afford it (design §5). */
export interface RewardPreviewRow {
  readonly reward: Reward;
  readonly locked: boolean;
}

/** The reward with the highest cost, keeping the first one on a tie so the result is deterministic. */
function mostExpensive(rewards: readonly Reward[]): Reward | undefined {
  let chosen: Reward | undefined;

  for (const reward of rewards) {
    if (chosen === undefined || reward.cost > chosen.cost) {
      chosen = reward;
    }
  }

  return chosen;
}

/**
 * Selects the Today Rewards preview rows (design §5, decisions D20): the most expensive reward the
 * Wallet can afford, then the most expensive one it cannot yet afford. Up to two rows in that order,
 * and either may be absent. A reward costing exactly the Wallet balance is affordable. Ties keep the
 * reward that appears first in the list. Pure: it only reads the rewards and never mutates them.
 */
export function selectRewardPreview(
  rewards: readonly Reward[],
  wallet: number
): RewardPreviewRow[] {
  const affordable = mostExpensive(rewards.filter((reward) => reward.cost <= wallet));
  const locked = mostExpensive(rewards.filter((reward) => reward.cost > wallet));
  const rows: RewardPreviewRow[] = [];

  if (affordable !== undefined) {
    rows.push({ reward: affordable, locked: false });
  }

  if (locked !== undefined) {
    rows.push({ reward: locked, locked: true });
  }

  return rows;
}
