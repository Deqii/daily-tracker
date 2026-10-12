import type { Stat, Tier } from './types';

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

/** Display labels for the three effort tiers, as written in copy (design §5). */
const TIER_LABELS: Record<Tier, string> = {
  ringan: 'Ringan',
  sedang: 'Sedang',
  berat: 'Berat',
};

/** The copy label for a stat: `STR` renders as `Str`, and so on (design §5). */
export function statLabel(stat: Stat): string {
  return STAT_LABELS[stat];
}

/** The copy label for an effort tier: `ringan` renders as `Ringan`, and so on (design §5). */
export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier];
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

/** The visual state of one Daily Quest row (design §5). */
export type QuestRowState = 'done' | 'pending' | 'penalty';

/**
 * The state of one quest row from its stat's completion progress (design §5, PRD §2.1). A row is
 * `done` once the stat has met its requirement for the day; before that a penalized stat (a
 * requirement of 2, PRD §7.4) shows the `penalty` state and any other shows `pending`.
 */
export function questRowState(completed: number, required: number): QuestRowState {
  if (required > 0 && completed >= required) {
    return 'done';
  }

  return required > 1 ? 'penalty' : 'pending';
}

/**
 * The points a quest row will award, after the cap and rank multiplier (PRD §2.1, design §5). A
 * single-tier task shows one value; a task with several effort variants shows its lowest to highest
 * award.
 */
export function questPointsLabel(min: number, max: number): string {
  return min === max ? `+${min}` : `+${min} to +${max}`;
}

/** The `completed/required` counter shown on a penalized quest row in place of its points (design §5). */
export function questCounterLabel(completed: number, required: number): string {
  return `${completed}/${required}`;
}
