const LEVEL_CURVE_COEFFICIENT = 14;

/** XP required to reach a level, from the PRD curve `14 × (N − 1)²`. */
export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError(`Level must be a positive integer, received ${level}`);
  }

  return LEVEL_CURVE_COEFFICIENT * (level - 1) ** 2;
}

/** Current level for a Lifetime XP total; floors at level 1 so a docked total cannot go below it. */
export function level(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) {
    return 1;
  }

  return Math.floor(Math.sqrt(xp / LEVEL_CURVE_COEFFICIENT)) + 1;
}
