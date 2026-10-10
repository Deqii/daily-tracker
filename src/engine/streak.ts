import { weekStart } from '../lib/date';
import type { LocalDate, Rank } from '../lib/types';
import { getRankConfig } from './rank';

export interface StreakState {
  currentStreak: number;
  freezesUsedThisWeek: number;
  lastFreezeWeekReset: LocalDate;
}

export interface StreakDay {
  date: LocalDate;
  completionCount: number;
  hasQuestStats: boolean;
}

export interface StreakClose {
  streakState: StreakState;
  freezeUsed: boolean;
}

/**
 * Closes one day for the streak, following the five-step rule in PRD §2.1 exactly: (1) a new local
 * week resets `freezesUsedThisWeek`, (2) a day with no quest-active stat changes nothing, (3) a day
 * with a completion extends the streak, (4) otherwise a freeze is used automatically when one is
 * left, and (5) otherwise the streak resets to 0. Freezes protect only the streak; penalties are
 * handled separately. The input is never mutated.
 */
export function closeDayStreak(
  streakState: StreakState,
  day: StreakDay,
  rank: Rank
): StreakClose {
  const startOfWeek = weekStart(day.date);
  const isNewWeek = startOfWeek > streakState.lastFreezeWeekReset;

  const next: StreakState = {
    currentStreak: streakState.currentStreak,
    freezesUsedThisWeek: isNewWeek ? 0 : streakState.freezesUsedThisWeek,
    lastFreezeWeekReset: isNewWeek ? startOfWeek : streakState.lastFreezeWeekReset,
  };

  if (!day.hasQuestStats) {
    return { streakState: next, freezeUsed: false };
  }

  if (day.completionCount > 0) {
    next.currentStreak += 1;
    return { streakState: next, freezeUsed: false };
  }

  if (next.freezesUsedThisWeek < getRankConfig(rank).freezesPerWeek) {
    next.freezesUsedThisWeek += 1;
    return { streakState: next, freezeUsed: true };
  }

  next.currentStreak = 0;
  return { streakState: next, freezeUsed: false };
}

/**
 * The streak shown in the UI: `currentStreak` covers closed days only, so a completion already
 * logged today (the open day) counts as one more (PRD §2.1).
 */
export function displayStreak(currentStreak: number, todayHasCompletion: boolean): number {
  return todayHasCompletion ? currentStreak + 1 : currentStreak;
}
