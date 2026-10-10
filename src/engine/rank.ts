import type { Rank } from '../lib/types';
import { RANKS } from '../lib/types';
import type { StatXP } from './balance';
import { passesBalanceGate } from './balance';

export interface RankConfig {
  readonly rank: Rank;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly freezesPerWeek: number;
  readonly maxPointsPerTask: number | null;
  readonly xpMultiplier: number;
  readonly penalty: number;
}

interface RankParams {
  rank: Rank;
  minLevel: number;
  freezesPerWeek: number;
  maxPointsPerTask: number | null;
  xpMultiplier: number;
  penalty: number;
}

const RANK_PARAMS = [
  { rank: 'E', minLevel: 1, freezesPerWeek: 1, maxPointsPerTask: 15, xpMultiplier: 0.5, penalty: 5 },
  { rank: 'D', minLevel: 6, freezesPerWeek: 1, maxPointsPerTask: 25, xpMultiplier: 0.7, penalty: 8 },
  { rank: 'C', minLevel: 11, freezesPerWeek: 2, maxPointsPerTask: 40, xpMultiplier: 0.85, penalty: 13 },
  { rank: 'B', minLevel: 21, freezesPerWeek: 2, maxPointsPerTask: 60, xpMultiplier: 1, penalty: 20 },
  { rank: 'A', minLevel: 36, freezesPerWeek: 3, maxPointsPerTask: 90, xpMultiplier: 1.15, penalty: 30 },
  { rank: 'S', minLevel: 51, freezesPerWeek: 3, maxPointsPerTask: null, xpMultiplier: 1.3, penalty: 45 },
] as const satisfies readonly RankParams[];

export const RANK_CONFIGS: readonly RankConfig[] = RANK_PARAMS.map((params, index) => {
  const next = RANK_PARAMS[index + 1];

  return Object.freeze({
    ...params,
    maxLevel: next ? next.minLevel - 1 : Number.POSITIVE_INFINITY,
  });
});

export function getRankConfig(target: Rank): RankConfig {
  const config = RANK_CONFIGS.find((candidate) => candidate.rank === target);

  if (!config) {
    throw new RangeError(`Unknown rank: ${target}`);
  }

  return config;
}

/** Rank for a level; floors at level 1 so a bad input resolves to rank E rather than throwing. */
export function rank(level: number): Rank {
  const safeLevel = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;

  return RANK_CONFIGS.reduce((current, config) => (safeLevel >= config.minLevel ? config : current))
    .rank;
}

export type RankChange = 'up' | 'down' | null;

export interface RankResolution {
  readonly rank: Rank;
  readonly change: RankChange;
  readonly blocked: boolean;
}

/**
 * Resolves the effective rank from the level rank and the balance gate (PRD §7.6, decisions D3).
 * A rank drop is immediate and ungated. A rank-up would climb one step at a time toward the level
 * rank, each step gated; because the gate depends only on `statXP` (never on rank), one gate check
 * settles the whole climb. When it fails the rank stays and `blocked` is set.
 */
export function resolveRank(
  currentRank: Rank,
  level: number,
  statXP: Readonly<StatXP>
): RankResolution {
  const levelRank = rank(level);

  if (levelRank === currentRank) {
    return { rank: currentRank, change: null, blocked: false };
  }

  if (RANKS.indexOf(levelRank) < RANKS.indexOf(currentRank)) {
    return { rank: levelRank, change: 'down', blocked: false };
  }

  return passesBalanceGate(statXP).passes
    ? { rank: levelRank, change: 'up', blocked: false }
    : { rank: currentRank, change: null, blocked: true };
}
