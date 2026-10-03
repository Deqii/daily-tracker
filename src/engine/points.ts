import type { Rank } from '../lib/types';
import { getRankConfig } from './rank';

/** Points actually credited: nominal points × the rank's XP multiplier, rounded up. */
export function pointsAwarded(nominalPoints: number, rank: Rank): number {
  if (!Number.isFinite(nominalPoints) || nominalPoints < 0) {
    throw new RangeError(
      `Nominal points must be a non-negative finite number, received ${nominalPoints}`
    );
  }

  return Math.ceil(nominalPoints * getRankConfig(rank).xpMultiplier);
}
