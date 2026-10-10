import type { Stat } from '../lib/types';
import { STATS } from '../lib/types';

/**
 * The required completion count per stat for a day: 0 for a stat that is not quest-active, 2 for a
 * penalized quest-active stat, otherwise 1 (PRD §7.4). A penalized stat that is no longer
 * quest-active is not required, so it gets 0. Always returns all five stats.
 */
export function buildRequired(
  questStats: readonly Stat[],
  penaltyStats: readonly Stat[]
): Record<Stat, number> {
  const questActive = new Set(questStats);
  const penalized = new Set(penaltyStats);

  return STATS.reduce<Record<Stat, number>>(
    (required, stat) => {
      if (!questActive.has(stat)) {
        required[stat] = 0;
      } else {
        required[stat] = penalized.has(stat) ? 2 : 1;
      }

      return required;
    },
    { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 }
  );
}

export interface DayEvaluation {
  missed: Stat[];
  satisfied: Stat[];
}

/**
 * Splits the day's quest-active stats into missed and satisfied (PRD §7.4). Only stats with
 * `required > 0` are considered, and a stat is missed when `actual < required`. Both lists follow
 * the fixed stat order STR, VIT, INT, DISC, SOC.
 */
export function evaluateDay(
  required: Readonly<Record<Stat, number>>,
  actual: Readonly<Record<Stat, number>>
): DayEvaluation {
  const missed: Stat[] = [];
  const satisfied: Stat[] = [];

  for (const stat of STATS) {
    if (required[stat] <= 0) {
      continue;
    }

    if (actual[stat] >= required[stat]) {
      satisfied.push(stat);
    } else {
      missed.push(stat);
    }
  }

  return { missed, satisfied };
}
