import type { Rank, Task } from '../lib/types';
import { getRankConfig } from './rank';

export type CapValidationResult =
  { ok: true } | { ok: false; reason: 'INVALID_NUMBER' | 'ABOVE_CAP'; cap: number | null };

/**
 * Points actually credited: `ceil(min(nominal, cap) × multiplier)`, using the rank's max points per
 * task as the cap. Rank S is uncapped. A nominal above the cap is clamped, not rejected: a rank
 * drop can leave a stored value above the current cap (decisions D11).
 */
export function pointsAwarded(nominalPoints: number, rank: Rank): number {
  if (!Number.isFinite(nominalPoints) || nominalPoints < 0) {
    throw new RangeError(
      `Nominal points must be a non-negative finite number, received ${nominalPoints}`
    );
  }

  const { maxPointsPerTask, xpMultiplier } = getRankConfig(rank);
  const cappedPoints =
    maxPointsPerTask === null ? nominalPoints : Math.min(nominalPoints, maxPointsPerTask);

  return Math.ceil(cappedPoints * xpMultiplier);
}

/**
 * Validates a nominal point value against the rank's cap and returns why it failed (decisions D21),
 * so the task form can show a different message per reason. `INVALID_NUMBER` covers non-integers,
 * non-finite values, and values below 1 (including 0); `ABOVE_CAP` carries the cap. Rank S is
 * uncapped.
 */
export function isWithinPointCap(points: number, rank: Rank): CapValidationResult {
  const cap = getRankConfig(rank).maxPointsPerTask;

  if (!Number.isInteger(points) || points < 1) {
    return { ok: false, reason: 'INVALID_NUMBER', cap };
  }

  if (cap !== null && points > cap) {
    return { ok: false, reason: 'ABOVE_CAP', cap };
  }

  return { ok: true };
}

/** Whether any variant of a task would be blocked from saving at the current rank. */
export function taskExceedsPointCap(task: Task, rank: Rank): boolean {
  return task.variants.some((variant) => !isWithinPointCap(variant.points, rank).ok);
}
