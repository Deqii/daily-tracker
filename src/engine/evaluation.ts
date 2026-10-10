import type { Rank, Stat } from '../lib/types';
import { STATS } from '../lib/types';
import { getRankConfig } from './rank';

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

export interface PenaltyState {
  readonly lifetimeXP: number;
  readonly wallet: number;
}

export interface PenaltyResult {
  lifetimeXP: number;
  wallet: number;
  xpDeducted: number;
  walletDeducted: number;
}

/**
 * Deducts `penalty(rank) × missedCount` from Lifetime XP and Wallet, each floored at 0
 * (PRD §7.4; decisions D1, D2). `statXP` is not part of the input or output, and the input is
 * never mutated. Reports how much was actually deducted from each, which differs from the nominal
 * total when a balance is below it.
 */
export function applyPenalty(state: PenaltyState, rank: Rank, missedCount: number): PenaltyResult {
  const total = getRankConfig(rank).penalty * missedCount;
  const xpDeducted = Math.min(state.lifetimeXP, total);
  const walletDeducted = Math.min(state.wallet, total);

  return {
    lifetimeXP: state.lifetimeXP - xpDeducted,
    wallet: state.wallet - walletDeducted,
    xpDeducted,
    walletDeducted,
  };
}
