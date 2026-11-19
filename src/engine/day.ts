import type { Stat } from '../lib/types';
import { STATS } from '../lib/types';

/** A zero count for every stat, in the fixed order STR, VIT, INT, DISC, SOC. */
export function zeroCounts(): Record<Stat, number> {
  return { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 };
}

/** Whether any stat has at least one completion. */
export function hasAnyCompletion(actual: Readonly<Record<Stat, number>>): boolean {
  return STATS.some((stat) => actual[stat] > 0);
}

/** Stats with a requirement of 2, i.e. the stats still carrying a penalty flag. */
export function penalizedStats(required: Readonly<Record<Stat, number>>): Stat[] {
  return STATS.filter((stat) => required[stat] === 2);
}

/**
 * The required counts for the quest-active stats only: a stat that is no longer
 * quest-active gets 0 even when its stored requirement is still positive.
 */
export function requiredForActiveStats(
  required: Readonly<Record<Stat, number>>,
  questStats: readonly Stat[]
): Record<Stat, number> {
  const active = new Set(questStats);

  return STATS.reduce<Record<Stat, number>>((result, stat) => {
    result[stat] = active.has(stat) ? required[stat] : 0;
    return result;
  }, zeroCounts());
}

/** The total number of completions across all stats on a day. */
export function completionCount(actual: Readonly<Record<Stat, number>>): number {
  return STATS.reduce((sum, stat) => sum + actual[stat], 0);
}

/** Whether any stat still has a positive requirement. */
export function hasRequiredStats(required: Readonly<Record<Stat, number>>): boolean {
  return STATS.some((stat) => required[stat] > 0);
}
