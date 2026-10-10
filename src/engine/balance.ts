import type { Stat } from '../lib/types';
import { STATS } from '../lib/types';

export type StatXP = Record<Stat, number>;

export interface BalanceGateResult {
  readonly passes: boolean;
  readonly weakest: Stat | null;
  readonly threshold: number;
}

/**
 * Stats that have at least one completion ever, i.e. `statXP > 0` (PRD §2.1, decisions D5).
 * Follows the fixed stat order STR, VIT, INT, DISC, SOC.
 */
export function getTrackedStats(statXP: Readonly<StatXP>): Stat[] {
  return STATS.filter((stat) => statXP[stat] > 0);
}

/**
 * The rank-up balance gate (PRD §2.1, §7.6): among tracked stats the weakest `statXP` must be at
 * least 50% of the tracked average, compared in integers as `2 × weakest × count ≥ sum` so no
 * floating-point division decides a rank-up. `threshold` is the backup shown to the user,
 * `ceil(sum / (2 × count))`, which is the lowest `statXP` the weakest stat may reach to pass.
 *
 * With fewer than two tracked stats the gate passes vacuously: `weakest` is null and `threshold`
 * is 0, since there is no balance to show and the line is never rendered.
 */
export function passesBalanceGate(statXP: Readonly<StatXP>): BalanceGateResult {
  const tracked = getTrackedStats(statXP);
  const first = tracked[0];
  const second = tracked[1];

  if (first === undefined || second === undefined) {
    return { passes: true, weakest: null, threshold: 0 };
  }

  let sum = 0;
  let weakest: Stat = first;

  for (const stat of tracked) {
    sum += statXP[stat];

    if (statXP[stat] < statXP[weakest]) {
      weakest = stat;
    }
  }

  return {
    passes: 2 * statXP[weakest] * tracked.length >= sum,
    weakest,
    threshold: Math.ceil(sum / (2 * tracked.length)),
  };
}
