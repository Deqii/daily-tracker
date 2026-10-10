import type { Completion, MilestoneEvent, Stat, Tier } from '../lib/types';
import { toLocalDate, toTimestamp } from '../lib/date';
import { level } from './level';
import { pointsAwarded } from './points';
import { resolveRank } from './rank';
import type { AppState, Result } from './state';
import { applyTitleUnlocks } from './titles';

export type CompleteTaskError =
  | 'NO_OPEN_DAY'
  | 'TASK_NOT_IN_QUEST'
  | 'VARIANT_NOT_FOUND'
  | 'ROW_LIMIT_REACHED';

export interface CompleteTaskInput {
  readonly taskId: string;
  readonly variantTier: Tier | null;
}

export interface CompleteTaskValue {
  readonly state: AppState;
  readonly completion: Completion;
  readonly events: MilestoneEvent[];
}

export type CompleteTaskResult = Result<CompleteTaskValue, CompleteTaskError>;

/**
 * Completes a quest row for the open day (PRD §7.7, decisions D10, D11). Validates that the open day
 * exists and that the task is one of its rows, resolves the tier (`null` for a single-tier task),
 * and rejects a row already at `requiredCompletions`. Awards `pointsAwarded` (capped, PRD §7.1) to
 * Lifetime XP, Wallet, and the stat's `statXP`; appends a `Completion` snapshot; and bumps the open
 * day's counters and net points. Recomputes Level and the effective rank, emitting one `levelUp`
 * event even when several levels are crossed and a `rankUp` event when the rank rises. Newly
 * unlocked titles are stored against the displayed streak. Every failure is a result, and the input
 * state is never mutated.
 */
export function completeTask(
  state: AppState,
  { taskId, variantTier }: CompleteTaskInput,
  now: Date,
  newId: () => string
): CompleteTaskResult {
  const openDay = state.dailyQuestLog.find((day) => day.date === state.userState.lastRolloverDate);

  if (openDay === undefined) {
    return { ok: false, error: 'NO_OPEN_DAY' };
  }

  const task = state.tasks.find((candidate) => candidate.id === taskId);

  if (
    task === undefined ||
    openDay.requiredCompletions[task.stat] <= 0 ||
    (!task.isAnchor && openDay.selectedTaskIdPerStat[task.stat] !== task.id)
  ) {
    return { ok: false, error: 'TASK_NOT_IN_QUEST' };
  }

  const isMultiVariant = task.variants.length > 1;
  const variant = isMultiVariant
    ? task.variants.find((candidate) => candidate.tier === variantTier)
    : task.variants[0];

  if (variant === undefined) {
    return { ok: false, error: 'VARIANT_NOT_FOUND' };
  }

  const stat = task.stat;

  if (openDay.actualCompletions[stat] >= openDay.requiredCompletions[stat]) {
    return { ok: false, error: 'ROW_LIMIT_REACHED' };
  }

  const points = pointsAwarded(variant.points, state.userState.rank);
  const localDate = toLocalDate(now);
  const previousLevel = level(state.userState.lifetimeXP);

  const completion: Completion = {
    id: newId(),
    taskId: task.id,
    taskName: task.familyName,
    stat,
    variantTier: isMultiVariant ? variant.tier : null,
    pointsAwarded: points,
    completedAt: toTimestamp(now),
    localDate,
  };

  const lifetimeXP = state.userState.lifetimeXP + points;
  const nextStatXP: Record<Stat, number> = {
    ...state.userState.statXP,
    [stat]: state.userState.statXP[stat] + points,
  };
  const nextLevel = level(lifetimeXP);
  const rankResolution = resolveRank(state.userState.rank, nextLevel, nextStatXP);

  const events: MilestoneEvent[] = [];

  if (nextLevel > previousLevel) {
    events.push({
      id: newId(),
      type: 'levelUp',
      localDate,
      from: previousLevel,
      to: nextLevel,
      seen: false,
    });
  }

  if (rankResolution.change === 'up') {
    events.push({
      id: newId(),
      type: 'rankUp',
      localDate,
      from: state.userState.rank,
      to: rankResolution.rank,
      seen: false,
    });
  }

  const nextOpenDay = {
    ...openDay,
    actualCompletions: {
      ...openDay.actualCompletions,
      [stat]: openDay.actualCompletions[stat] + 1,
    },
    netPointsChange: openDay.netPointsChange + points,
  };

  const nextState: AppState = {
    ...state,
    completions: [...state.completions, completion],
    dailyQuestLog: state.dailyQuestLog.map((day) => (day === openDay ? nextOpenDay : day)),
    userState: {
      ...state.userState,
      lifetimeXP,
      wallet: state.userState.wallet + points,
      statXP: nextStatXP,
      rank: rankResolution.rank,
      totalCompletions: state.userState.totalCompletions + 1,
    },
    milestoneEvents: [...state.milestoneEvents, ...events],
  };

  return { ok: true, value: { state: applyTitleUnlocks(nextState), completion, events } };
}
