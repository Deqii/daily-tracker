import { passesBalanceGate } from '../engine/balance';
import { isQuestRow } from '../engine/daily';
import { hasAnyCompletion, penalizedStats } from '../engine/day';
import { level as levelOf, xpForLevel } from '../engine/level';
import { pointsAwarded } from '../engine/points';
import { getRankConfig, rank as levelRankOf, resolveRank } from '../engine/rank';
import type { AppState } from '../engine/state';
import { displayStreak } from '../engine/streak';
import { TITLES } from '../engine/titles';
import { selectRewardPreview, type RewardPreviewRow } from '../lib/rewards-preview';
import type { DailyQuestDay, Rank, Stat, Task, Tier } from '../lib/types';
import { STATS } from '../lib/types';

/** In-level XP progress: `xpIntoLevel / xpForThisLevel` is what the Today XP bar fills. */
export interface LevelProgress {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForThisLevel: number;
  readonly ratio: number;
}

/** The rank-up balance gate as shown on Today (PRD §7.6). */
export interface RankGateStatus {
  readonly blocked: boolean;
  readonly levelRank: Rank;
  readonly weakest: Stat | null;
  readonly threshold: number;
  readonly current: number | null;
}

/** The points a quest row awards (after cap and multiplier), lowest to highest across its variants. */
export interface QuestRowPoints {
  readonly min: number;
  readonly max: number;
}

/** One effort variant of a quest row, with the points it will award (after cap and multiplier). */
export interface QuestVariantOption {
  readonly tier: Tier;
  readonly description: string;
  readonly points: number;
}

/** One row of the open day's Daily Quest (an anchor task or that day's rotating pick). */
export interface QuestRow {
  readonly task: Task;
  readonly isAnchor: boolean;
  readonly isRotating: boolean;
  readonly completionCount: number;
  readonly points: QuestRowPoints;
  readonly options: QuestVariantOption[];
}

/** The open day's quest rows for one quest-active stat. */
export interface QuestStatGroup {
  readonly stat: Stat;
  readonly required: number;
  readonly completed: number;
  readonly rows: QuestRow[];
}

export function openDayOf(state: AppState): DailyQuestDay | undefined {
  return state.dailyQuestLog.find((day) => day.date === state.userState.lastRolloverDate);
}

export function hasCompletionToday(state: AppState): boolean {
  const openDay = openDayOf(state);

  return openDay !== undefined && hasAnyCompletion(openDay.actualCompletions);
}

export function equippedTitleName(id: string | null): string | null {
  if (id === null) {
    return null;
  }

  return TITLES.find((title) => title.id === id)?.name ?? null;
}

function toLevelProgress(state: AppState): LevelProgress {
  const xp = state.userState.lifetimeXP;
  const level = levelOf(xp);
  const levelFloor = xpForLevel(level);
  const xpForThisLevel = xpForLevel(level + 1) - levelFloor;
  const xpIntoLevel = xp - levelFloor;

  return {
    level,
    xpIntoLevel,
    xpForThisLevel,
    ratio: xpForThisLevel > 0 ? xpIntoLevel / xpForThisLevel : 0,
  };
}

function toRankGate(state: AppState): RankGateStatus {
  const level = levelOf(state.userState.lifetimeXP);
  const resolution = resolveRank(state.userState.rank, level, state.userState.statXP);
  const gate = passesBalanceGate(state.userState.statXP);

  return {
    blocked: resolution.blocked,
    levelRank: levelRankOf(level),
    weakest: gate.weakest,
    threshold: gate.threshold,
    current: gate.weakest === null ? null : state.userState.statXP[gate.weakest],
  };
}

function toQuestOptions(task: Task, rank: Rank): QuestVariantOption[] {
  return task.variants.map((variant) => ({
    tier: variant.tier,
    description: variant.description,
    points: pointsAwarded(variant.points, rank),
  }));
}

function toQuestRowPoints(options: QuestVariantOption[]): QuestRowPoints {
  const awarded = options.map((option) => option.points);

  return { min: Math.min(...awarded), max: Math.max(...awarded) };
}

function toQuestGroups(state: AppState): QuestStatGroup[] {
  const openDay = openDayOf(state);

  if (openDay === undefined) {
    return [];
  }

  const groups: QuestStatGroup[] = [];

  for (const stat of STATS) {
    if (openDay.requiredCompletions[stat] <= 0) {
      continue;
    }

    const rotatingTaskId = openDay.selectedTaskIdPerStat[stat];
    const rank = state.userState.rank;

    const rows = state.tasks
      .filter((task) => task.stat === stat && isQuestRow(task, rotatingTaskId))
      .map((task) => {
        const options = toQuestOptions(task, rank);

        return {
          task,
          isAnchor: task.isAnchor,
          isRotating: !task.isAnchor && task.id === rotatingTaskId,
          completionCount: state.completions.filter(
            (completion) => completion.localDate === openDay.date && completion.taskId === task.id
          ).length,
          points: toQuestRowPoints(options),
          options,
        };
      });

    groups.push({
      stat,
      required: openDay.requiredCompletions[stat],
      completed: openDay.actualCompletions[stat],
      rows,
    });
  }

  return groups;
}

function toPenaltyStats(state: AppState): Stat[] {
  const openDay = openDayOf(state);

  if (openDay === undefined) {
    return [];
  }

  return penalizedStats(openDay.requiredCompletions);
}

export const derivations = {
  level: (state: AppState): number => levelOf(state.userState.lifetimeXP),
  rank: (state: AppState): Rank => state.userState.rank,
  levelRank: (state: AppState): Rank => levelRankOf(levelOf(state.userState.lifetimeXP)),
  levelProgress: toLevelProgress,
  rankGate: toRankGate,
  statXP: (state: AppState): Record<Stat, number> => state.userState.statXP,
  equippedTitle: (state: AppState): string | null =>
    equippedTitleName(state.userState.equippedTitle),
  streak: (state: AppState): number =>
    displayStreak(state.userState.currentStreak, hasCompletionToday(state)),
  freezesLeft: (state: AppState): number =>
    Math.max(
      0,
      getRankConfig(state.userState.rank).freezesPerWeek - state.userState.freezesUsedThisWeek
    ),
  questRows: toQuestGroups,
  penaltyStats: toPenaltyStats,
  rewardPreview: (state: AppState): RewardPreviewRow[] =>
    selectRewardPreview(state.rewards, state.userState.wallet),
};
