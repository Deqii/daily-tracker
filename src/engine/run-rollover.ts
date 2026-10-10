import { eachDay } from '../lib/date';
import type { DailyQuestDay, LocalDate, MilestoneEvent, Rank, Stat, Task } from '../lib/types';
import { STATS } from '../lib/types';
import { applyPenalty, buildRequired, evaluateDay, nextPenaltyStats } from './evaluation';
import { getQuestStats, selectDailyTasks } from './daily';
import { level } from './level';
import { resolveRank } from './rank';
import type { AppState } from './state';
import { closeDayStreak, type StreakState } from './streak';
import { applyTitleUnlocks } from './titles';

export interface RolloverResult {
  readonly state: AppState;
  readonly events: MilestoneEvent[];
}

const zeroCounts = (): Record<Stat, number> => ({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

/**
 * The open-day log entry PRD §7.7 step 3: `selectDailyTasks` and `buildRequired` against the current
 * tasks and the penalty flags carried into today, zero counts, and empty snapshots.
 */
const openDayEntry = (
  tasks: readonly Task[],
  questStats: readonly Stat[],
  penaltyStats: readonly Stat[],
  date: LocalDate
): DailyQuestDay => ({
  date,
  selectedTaskIdPerStat: selectDailyTasks(tasks, date),
  requiredCompletions: buildRequired(questStats, penaltyStats),
  actualCompletions: zeroCounts(),
  netPointsChange: 0,
  freezeUsed: false,
  closed: false,
  lifetimeXPEnd: null,
  levelEnd: null,
  rankEnd: null,
});

/**
 * Closes every day from `lastRolloverDate` up to the day before `today`, then opens `today`
 * (PRD §7.7, decisions D3, D7). A day without a stored entry is created with all-zero counts.
 * Each day applies the missed-stat penalty with the rank held at the start of that day, recomputes
 * the streak, and closes with end-of-day snapshots; a rank drop emits a `rankDown` event dated that
 * day. Newly unlocked titles are stored through the title helper. Returns `{ state, events }` where
 * `events` are the milestone events created by this call. `today` at or before `lastRolloverDate`
 * changes nothing except ensuring the open day's log entry exists, so a second call with the same
 * `today` returns the same state. The input state is never mutated.
 */
export function runRollover(state: AppState, today: LocalDate, newId: () => string): RolloverResult {
  const { userState } = state;

  if (today < userState.lastRolloverDate) {
    return { state, events: [] };
  }

  const questStats = getQuestStats(state.tasks);
  const questActive = new Set(questStats);
  const daysToClose = eachDay(userState.lastRolloverDate, today);

  const openToday = (penaltyStats: readonly Stat[]): DailyQuestDay =>
    openDayEntry(state.tasks, questStats, penaltyStats, today);

  if (daysToClose.length === 0) {
    const hasOpenDay = state.dailyQuestLog.some((day) => day.date === userState.lastRolloverDate);

    if (hasOpenDay) {
      return { state, events: [] };
    }

    return {
      state: {
        ...state,
        dailyQuestLog: [...state.dailyQuestLog, openToday(userState.penaltyStats)],
      },
      events: [],
    };
  }

  let lifetimeXP = userState.lifetimeXP;
  let wallet = userState.wallet;
  let penaltyStats: Stat[] = userState.penaltyStats;
  let rank: Rank = userState.rank;
  let streakState: StreakState = {
    currentStreak: userState.currentStreak,
    freezesUsedThisWeek: userState.freezesUsedThisWeek,
    lastFreezeWeekReset: userState.lastFreezeWeekReset,
  };

  const closedByDate = new Map(state.dailyQuestLog.map((day) => [day.date, day]));
  const events: MilestoneEvent[] = [];

  for (const date of daysToClose) {
    const stored = closedByDate.get(date);
    const required = stored?.requiredCompletions ?? buildRequired(questStats, penaltyStats);
    const actualCompletions = stored?.actualCompletions ?? zeroCounts();

    const effectiveRequired = STATS.reduce<Record<Stat, number>>(
      (result, stat) => {
        result[stat] = questActive.has(stat) ? required[stat] : 0;
        return result;
      },
      { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 }
    );

    const { missed, satisfied } = evaluateDay(effectiveRequired, actualCompletions);

    const penalty = applyPenalty({ lifetimeXP, wallet }, rank, missed.length);
    lifetimeXP = penalty.lifetimeXP;
    wallet = penalty.wallet;

    penaltyStats = nextPenaltyStats(penaltyStats, missed, satisfied, questStats);

    const completionCount = STATS.reduce((sum, stat) => sum + actualCompletions[stat], 0);
    const streak = closeDayStreak(
      streakState,
      {
        date,
        completionCount,
        hasQuestStats: STATS.some((stat) => effectiveRequired[stat] > 0),
      },
      rank
    );
    streakState = streak.streakState;

    const nextLevel = level(lifetimeXP);
    const resolution = resolveRank(rank, nextLevel, userState.statXP);

    if (resolution.change === 'down') {
      events.push({
        id: newId(),
        type: 'rankDown',
        localDate: date,
        from: rank,
        to: resolution.rank,
        seen: false,
      });
    }

    rank = resolution.rank;

    const closedDay: DailyQuestDay = {
      ...(stored ?? {
        date,
        selectedTaskIdPerStat: {},
        requiredCompletions: required,
        actualCompletions,
        netPointsChange: 0,
        freezeUsed: false,
        closed: false,
        lifetimeXPEnd: null,
        levelEnd: null,
        rankEnd: null,
      }),
      netPointsChange: (stored?.netPointsChange ?? 0) - penalty.xpDeducted,
      freezeUsed: streak.freezeUsed,
      closed: true,
      lifetimeXPEnd: lifetimeXP,
      levelEnd: nextLevel,
      rankEnd: resolution.rank,
    };

    closedByDate.set(date, closedDay);
  }

  const afterClose: AppState = {
    ...state,
    dailyQuestLog: [...closedByDate.values()],
    userState: {
      ...userState,
      lifetimeXP,
      wallet,
      rank,
      currentStreak: streakState.currentStreak,
      freezesUsedThisWeek: streakState.freezesUsedThisWeek,
      lastFreezeWeekReset: streakState.lastFreezeWeekReset,
      penaltyStats,
    },
    milestoneEvents: [...state.milestoneEvents, ...events],
  };

  const withToday: AppState = {
    ...afterClose,
    dailyQuestLog: [...afterClose.dailyQuestLog, openToday(penaltyStats)],
    userState: { ...afterClose.userState, lastRolloverDate: today },
  };

  return { state: applyTitleUnlocks(withToday), events };
}