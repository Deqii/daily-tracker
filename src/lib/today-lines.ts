import type { Stat } from './types';

/** One run of a Today copy line; `mono` runs render in the monospace typeface. */
export interface LineSegment {
  readonly text: string;
  readonly mono: boolean;
}

/** Display labels for the five stats, as written in copy (design §5). */
const STAT_LABELS: Record<Stat, string> = {
  STR: 'Str',
  VIT: 'Vit',
  INT: 'Int',
  DISC: 'Disc',
  SOC: 'Soc',
};

/** The copy label for a stat: `STR` renders as `Str`, and so on (design §5). */
export function statLabel(stat: Stat): string {
  return STAT_LABELS[stat];
}

/** The freezes-left line under the XP bar (design §5, §7). */
export function freezesLine(left: number): string {
  if (left <= 0) {
    return 'No freezes left this week';
  }

  if (left === 1) {
    return '1 freeze left this week';
  }

  return `${left} freezes left this week`;
}

/**
 * The rank-up-blocked line under the freezes line, built from the balance gate (PRD §7.6,
 * design §5). The gate threshold and the weakest stat's current value are monospace; the rest is
 * normal text.
 */
export function rankUpBlockedLine(stat: Stat, threshold: number, current: number): LineSegment[] {
  return [
    { text: `Rank-up blocked: raise ${statLabel(stat)} to `, mono: false },
    { text: String(threshold), mono: true },
    { text: ' xp (now ', mono: false },
    { text: String(current), mono: true },
    { text: ')', mono: false },
  ];
}

/**
 * One penalized stat's notification line under the system message (design §5). The required count
 * is always 2 because the penalty flag caps the requirement at 2 (PRD §7.4, decisions D3). Only the
 * number is monospace.
 */
export function penaltyNotificationLine(stat: Stat): LineSegment[] {
  return [
    { text: `Penalty active: ${statLabel(stat)} needs `, mono: false },
    { text: '2', mono: true },
    { text: ' completions today.', mono: false },
  ];
}
