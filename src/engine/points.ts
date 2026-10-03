import type { Rank, Task } from '../lib/types';
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

/** Whether a nominal point value fits the rank's cap; rank S is uncapped. Non-finite and negative values fail closed. */
export function isWithinPointCap(points: number, rank: Rank): boolean {
  const cap = getRankConfig(rank).maxPointsPerTask;

  return Number.isFinite(points) && points >= 0 && (cap === null || points <= cap);
}

/** Whether any variant of a task would be blocked from saving at the current rank. */
export function taskExceedsPointCap(task: Task, rank: Rank): boolean {
  return task.variants.some((variant) => !isWithinPointCap(variant.points, rank));
}
