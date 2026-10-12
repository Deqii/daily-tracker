import { RANK_CONFIGS } from '../engine/rank';
import type { Rank } from './types';

/** One row of the read-only rank-reference table in Settings (design §5). */
export interface RankReferenceRow {
  readonly rank: Rank;
  readonly levelRange: string;
  readonly freezesPerWeek: number;
  readonly maxPointsPerTask: string;
  readonly multiplier: string;
  readonly penalty: number;
}

/**
 * The rank table's level range: `1–5`, and `51+` for the open-ended top rank (PRD §2.1). The top
 * rank has no upper bound, so `maxLevel` is infinite and renders as `+`.
 */
export function rankLevelRange(minLevel: number, maxLevel: number): string {
  return Number.isFinite(maxLevel) ? `${minLevel}–${maxLevel}` : `${minLevel}+`;
}

/** The rank table's XP multiplier: `×0.5`, `×0.85`, `×1.0` (PRD §2.1). */
export function rankMultiplier(xpMultiplier: number): string {
  const value = Number.isInteger(xpMultiplier) ? xpMultiplier.toFixed(1) : String(xpMultiplier);

  return `×${value}`;
}

/** The rank table's max points per task, or `unlimited` for Rank S (PRD §2.1, decisions D2). */
export function rankMaxPoints(maxPointsPerTask: number | null): string {
  return maxPointsPerTask === null ? 'unlimited' : String(maxPointsPerTask);
}

/**
 * Every rank-reference row, lowest rank first (design §5). Reads the engine's rank configs directly,
 * so the table always matches the live rank table. Pure: it returns new objects and mutates nothing.
 */
export function rankReferenceRows(): RankReferenceRow[] {
  return RANK_CONFIGS.map((config) => ({
    rank: config.rank,
    levelRange: rankLevelRange(config.minLevel, config.maxLevel),
    freezesPerWeek: config.freezesPerWeek,
    maxPointsPerTask: rankMaxPoints(config.maxPointsPerTask),
    multiplier: rankMultiplier(config.xpMultiplier),
    penalty: config.penalty,
  }));
}
