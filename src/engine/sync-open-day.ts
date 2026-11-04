import type { DailyQuestDay, LocalDate, Stat, Task } from '../lib/types';
import { STATS } from '../lib/types';
import { getQuestStats, selectDailyTasks } from './daily';
import { buildRequired } from './evaluation';
import type { AppState } from './state';

const samePicks = (
  left: Partial<Record<Stat, string>>,
  right: Partial<Record<Stat, string>>
): boolean => STATS.every((stat) => left[stat] === right[stat]);

const sameRequired = (
  left: Readonly<Record<Stat, number>>,
  right: Readonly<Record<Stat, number>>
): boolean => STATS.every((stat) => left[stat] === right[stat]);

const isRotatingTaskOfStat = (task: Task | undefined, stat: Stat): task is Task =>
  task !== undefined && !task.isAnchor && task.stat === stat;

/**
 * Re-syncs the open day against the current task library (PRD §2.1, §7.7).
 * Only `selectedTaskIdPerStat` and `requiredCompletions` can change. A pick is kept while it names a
 * rotating task of its stat; a missing or invalid pick is filled from `selectDailyTasks`. Picks for
 * stats that are no longer quest-active are removed. Returns the input state unchanged when there is
 * no open entry, it is closed, or its date is not `today`; a day before `today` is left to rollover.
 */
export function syncOpenDay(state: AppState, today: LocalDate): AppState {
  const openDay = state.dailyQuestLog.find((day) => day.date === state.userState.lastRolloverDate);

  if (openDay === undefined || openDay.closed || openDay.date !== today) {
    return state;
  }

  const questStats = getQuestStats(state.tasks);
  const refreshed = selectDailyTasks(state.tasks, openDay.date);
  const byId = new Map(state.tasks.map((task) => [task.id, task]));
  const selectedTaskIdPerStat: Partial<Record<Stat, string>> = {};

  for (const stat of questStats) {
    const currentId = openDay.selectedTaskIdPerStat[stat];
    const currentTask = currentId === undefined ? undefined : byId.get(currentId);

    if (isRotatingTaskOfStat(currentTask, stat)) {
      selectedTaskIdPerStat[stat] = currentTask.id;
    } else if (refreshed[stat] !== undefined) {
      selectedTaskIdPerStat[stat] = refreshed[stat];
    }
  }

  const requiredCompletions = buildRequired(questStats, state.userState.penaltyStats);

  if (
    samePicks(selectedTaskIdPerStat, openDay.selectedTaskIdPerStat) &&
    sameRequired(requiredCompletions, openDay.requiredCompletions)
  ) {
    return state;
  }

  const nextOpenDay: DailyQuestDay = {
    ...openDay,
    selectedTaskIdPerStat,
    requiredCompletions,
  };

  return {
    ...state,
    dailyQuestLog: state.dailyQuestLog.map((day) => (day === openDay ? nextOpenDay : day)),
  };
}
