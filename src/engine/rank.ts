import type { Rank } from '../lib/types';

export interface RankConfig {
  rank: Rank;
  minLevel: number;
  maxLevel: number;
  freezesPerWeek: number;
  maxPointsPerTask: number | null;
  xpMultiplier: number;
}

interface RankParams {
  rank: Rank;
  minLevel: number;
  freezesPerWeek: number;
  maxPointsPerTask: number | null;
  xpMultiplier: number;
}

const RANK_PARAMS = [
  { rank: 'E', minLevel: 1, freezesPerWeek: 1, maxPointsPerTask: 15, xpMultiplier: 0.5 },
  { rank: 'D', minLevel: 6, freezesPerWeek: 1, maxPointsPerTask: 25, xpMultiplier: 0.7 },
  { rank: 'C', minLevel: 11, freezesPerWeek: 2, maxPointsPerTask: 40, xpMultiplier: 0.85 },
  { rank: 'B', minLevel: 21, freezesPerWeek: 2, maxPointsPerTask: 60, xpMultiplier: 1 },
  { rank: 'A', minLevel: 36, freezesPerWeek: 3, maxPointsPerTask: 90, xpMultiplier: 1.15 },
  { rank: 'S', minLevel: 51, freezesPerWeek: 3, maxPointsPerTask: null, xpMultiplier: 1.3 },
] as const satisfies readonly RankParams[];

export const RANK_CONFIGS: RankConfig[] = RANK_PARAMS.map((params, index) => {
  const next = RANK_PARAMS[index + 1];

  return {
    ...params,
    maxLevel: next ? next.minLevel - 1 : Number.POSITIVE_INFINITY,
  };
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
