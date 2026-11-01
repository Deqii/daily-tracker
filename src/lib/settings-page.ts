import { passesBalanceGate } from '../engine/balance';
import { level as levelOf, xpForLevel } from '../engine/level';
import { getRankConfig } from '../engine/rank';
import { TITLES, type TitleId } from '../engine/titles';
import { rankReferenceRows, type RankReferenceRow } from './rank-reference';
import { titleUnlockCondition } from './title-condition';
import { RANKS, STATS, type Rank, type Stat, type UserState } from './types';

/** The short stat names used in the balance-gate copy and rows. */
export const STAT_LABELS: Record<Stat, string> = {
  STR: 'Str',
  VIT: 'Vit',
  INT: 'Int',
  DISC: 'Disc',
  SOC: 'Soc',
};

/** The CSS custom property that colours each stat's bar. */
export const STAT_COLORS: Record<Stat, string> = {
  STR: '--stat-str',
  VIT: '--stat-vit',
  INT: '--stat-int',
  DISC: '--stat-disc',
  SOC: '--stat-soc',
};

/** The prototype's title order, which is not the engine catalog order. */
export const SETTINGS_TITLE_ORDER: readonly TitleId[] = [
  'first-reward',
  'streak-7',
  'completions-100',
  'rank-d',
  'streak-30',
  'rank-c',
  'rank-b',
  'rank-a',
  'rank-s',
];

export interface SettingsRankRow extends RankReferenceRow {
  readonly current: boolean;
  readonly next: boolean;
  readonly accent: string;
}

/** The rank table with the current and next rank flagged, in engine order. */
export function settingsRankRows(rank: Rank): SettingsRankRow[] {
  const index = RANKS.indexOf(rank);
  const next = index >= 0 ? (RANKS[index + 1] ?? null) : null;

  return rankReferenceRows().map((row) => ({
    ...row,
    current: row.rank === rank,
    next: row.rank === next,
    accent: `--rk-${row.rank.toLowerCase()}`,
  }));
}

/** The level rank that follows `rank`, or null at the top rank. */
export function nextRank(rank: Rank): Rank | null {
  const index = RANKS.indexOf(rank);

  return index >= 0 ? (RANKS[index + 1] ?? null) : null;
}

export interface NextRankProgress {
  readonly nextRank: Rank | null;
  readonly targetLevel: number | null;
  readonly currentXP: number;
  readonly requiredXP: number;
  readonly remainingXP: number;
  readonly ratio: number;
}

/**
 * Lifetime XP against the level at which the next rank starts. The target is
 * the engine's own `minLevel`, and the XP is its own curve (level 6 = 350 XP).
 * At the top rank there is no target, so the bar is full.
 */
export function nextRankProgress(userState: UserState): NextRankProgress {
  const targetRank = nextRank(userState.rank);
  const currentXP = userState.lifetimeXP;

  if (targetRank === null) {
    return {
      nextRank: null,
      targetLevel: null,
      currentXP,
      requiredXP: 0,
      remainingXP: 0,
      ratio: 1,
    };
  }

  const targetLevel = getRankConfig(targetRank).minLevel;
  const requiredXP = xpForLevel(targetLevel);

  return {
    nextRank: targetRank,
    targetLevel,
    currentXP,
    requiredXP,
    remainingXP: Math.max(0, requiredXP - currentXP),
    ratio: requiredXP === 0 ? 1 : Math.min(1, currentXP / requiredXP),
  };
}

export interface BalanceGateRow {
  readonly stat: Stat;
  readonly label: string;
  readonly value: number;
  readonly ratio: number;
  readonly color: string;
}

export interface BalanceGateView {
  readonly passes: boolean;
  readonly weakest: Stat | null;
  readonly weakestLabel: string | null;
  readonly weakestValue: number | null;
  readonly threshold: number;
  readonly thresholdRatio: number;
  readonly scale: number;
  readonly rows: readonly BalanceGateRow[];
  readonly text: string;
}

/**
 * The five stat bars and the threshold line. Values and the verdict are the
 * engine's; the bar scale is the largest stat shown, so the weakest row is
 * visible without the prototype's demo `MAXV`. The threshold ratio is used for
 * the line's CSS position.
 */
export function balanceGateView(statXP: Readonly<Record<Stat, number>>): BalanceGateView {
  const values = STATS.map((stat) => statXP[stat]);
  const scale = Math.max(1, ...values);
  const gate = passesBalanceGate(statXP);
  const weakestValue = gate.weakest === null ? null : statXP[gate.weakest];
  const weakestLabel = gate.weakest === null ? null : STAT_LABELS[gate.weakest];
  const rows = STATS.map((stat) => ({
    stat,
    label: STAT_LABELS[stat],
    value: statXP[stat],
    ratio: Math.min(1, statXP[stat] / scale),
    color: STAT_COLORS[stat],
  }));

  if (gate.weakest === null || weakestLabel === null || weakestValue === null) {
    return {
      passes: gate.passes,
      weakest: null,
      weakestLabel: null,
      weakestValue: null,
      threshold: gate.threshold,
      thresholdRatio: 0,
      scale,
      rows,
      text: 'The balance gate opens once at least two stats have XP.',
    };
  }

  const verdict = gate.passes ? '≥' : '<';
  const hint = gate.passes
    ? `Thin margin: raise ${weakestLabel} to be safe.`
    : 'Raise the weakest stat before ranking up.';

  return {
    passes: gate.passes,
    weakest: gate.weakest,
    weakestLabel,
    weakestValue,
    threshold: gate.threshold,
    thresholdRatio: Math.min(1, gate.threshold / scale),
    scale,
    rows,
    text: `Weakest stat ${weakestLabel} ${weakestValue} ${verdict} threshold ${gate.threshold} (50% of the average). ${hint}`,
  };
}

export interface TitleProgress {
  readonly current: number;
  readonly max: number;
  readonly ratio: number;
}

export interface SettingsTitleCard {
  readonly id: TitleId;
  readonly name: string;
  readonly condition: string;
  readonly unlocked: boolean;
  readonly equipped: boolean;
  readonly progress: TitleProgress;
}

const STREAK_THRESHOLDS: Partial<Record<TitleId, number>> = {
  'streak-7': 7,
  'streak-30': 30,
};

const RANK_TITLE_TARGETS: Partial<Record<TitleId, Rank>> = {
  'rank-d': 'D',
  'rank-c': 'C',
  'rank-b': 'B',
  'rank-a': 'A',
  'rank-s': 'S',
};

/**
 * The value each title's progress bar counts, and its target. First reward and
 * completions are the PRD's thresholds; rank targets are the engine's minimum
 * level for that rank, not a copied level number. `displayedStreak` is passed
 * in because the engine owns how an open day counts.
 */
function progressFor(id: TitleId, userState: UserState, displayedStreak: number): TitleProgress {
  const rankTarget = RANK_TITLE_TARGETS[id];

  if (rankTarget !== undefined) {
    const max = getRankConfig(rankTarget).minLevel;
    const current = levelOf(userState.lifetimeXP);

    return { current, max, ratio: Math.min(1, current / max) };
  }

  if (id === 'first-reward') {
    const max = 1;

    return {
      current: userState.totalPurchases,
      max,
      ratio: Math.min(1, userState.totalPurchases / max),
    };
  }

  if (id === 'completions-100') {
    const max = 100;

    return {
      current: userState.totalCompletions,
      max,
      ratio: Math.min(1, userState.totalCompletions / max),
    };
  }

  const max = STREAK_THRESHOLDS[id] ?? 1;

  return { current: displayedStreak, max, ratio: Math.min(1, displayedStreak / max) };
}

/** The settings title gallery, in the prototype's card order. */
export function settingsTitleCards(
  userState: UserState,
  displayedStreak: number
): SettingsTitleCard[] {
  return SETTINGS_TITLE_ORDER.map((id) => {
    const title = TITLES.find((candidate) => candidate.id === id);

    if (title === undefined) {
      throw new RangeError(`Unknown title id: ${id}`);
    }

    return {
      id,
      name: title.name,
      condition: titleUnlockCondition(id),
      unlocked: userState.unlockedTitles.includes(id),
      equipped: userState.equippedTitle === id,
      progress: progressFor(id, userState, displayedStreak),
    };
  });
}

export interface BackupStatus {
  readonly days: number | null;
  readonly old: boolean;
  readonly ok: boolean;
  readonly title: string;
  readonly detail: string;
}

const DAY_MS = 86_400_000;

/**
 * The backup banner. `days` is whole days since the stored timestamp; a value
 * under one day reads as "just now". An unreadable or absent timestamp reads as
 * "never", which is treated as old so the warning shows. `now` is passed in so
 * the calculation has no hidden clock.
 */
export function backupStatus(now: number, lastExportAt: string | null): BackupStatus {
  const parsed = lastExportAt === null ? Number.NaN : Date.parse(lastExportAt);

  if (!Number.isFinite(parsed)) {
    return {
      days: null,
      old: true,
      ok: false,
      title: 'Last backup: never',
      detail: 'Back up at least once a week so you do not lose progress.',
    };
  }

  const days = Math.max(0, Math.floor((now - parsed) / DAY_MS));
  const old = days >= 7;

  return {
    days,
    old,
    ok: !old,
    title: days < 1 ? 'Last backup: just now' : `Last backup: ${days} days ago`,
    detail: old
      ? 'Back up at least once a week so you do not lose progress.'
      : 'Your backup is recent.',
  };
}
