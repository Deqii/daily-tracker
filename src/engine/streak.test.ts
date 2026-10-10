import { describe, expect, it } from 'vitest';
import type { LocalDate, Rank } from '../lib/types';
import type { StreakDay, StreakState } from './streak';
import { closeDayStreak, displayStreak } from './streak';

const day = (date: LocalDate, completionCount: number): StreakDay => ({
  date,
  completionCount,
  hasQuestStats: true,
});

interface Step {
  date: LocalDate;
  completionCount: number;
  streak: number;
  freezes: number;
  freezeUsed: boolean;
}

const runSteps = (initial: StreakState, steps: Step[], rank: Rank = 'E'): void => {
  let state = initial;

  for (const step of steps) {
    const result = closeDayStreak(state, day(step.date, step.completionCount), rank);

    state = result.streakState;

    expect(state.currentStreak).toBe(step.streak);
    expect(state.freezesUsedThisWeek).toBe(step.freezes);
    expect(result.freezeUsed).toBe(step.freezeUsed);
  }
};

describe('closeDayStreak', () => {
  it('matches Appendix A scenario 5 exactly', () => {
    runSteps({ currentStreak: 0, freezesUsedThisWeek: 0, lastFreezeWeekReset: '2026-10-05' }, [
      { date: '2026-10-05', completionCount: 1, streak: 1, freezes: 0, freezeUsed: false },
      { date: '2026-10-06', completionCount: 1, streak: 2, freezes: 0, freezeUsed: false },
      { date: '2026-10-07', completionCount: 0, streak: 2, freezes: 1, freezeUsed: true },
      { date: '2026-10-08', completionCount: 1, streak: 3, freezes: 1, freezeUsed: false },
      { date: '2026-10-09', completionCount: 0, streak: 0, freezes: 1, freezeUsed: false },
      { date: '2026-10-10', completionCount: 1, streak: 1, freezes: 1, freezeUsed: false },
      { date: '2026-10-11', completionCount: 0, streak: 0, freezes: 1, freezeUsed: false },
      { date: '2026-10-12', completionCount: 1, streak: 1, freezes: 0, freezeUsed: false },
    ]);
  });

  it('allows two freezes in a week at Rank C and resets on the third miss', () => {
    runSteps(
      { currentStreak: 5, freezesUsedThisWeek: 0, lastFreezeWeekReset: '2026-10-05' },
      [
        { date: '2026-10-05', completionCount: 0, streak: 5, freezes: 1, freezeUsed: true },
        { date: '2026-10-06', completionCount: 0, streak: 5, freezes: 2, freezeUsed: true },
        { date: '2026-10-07', completionCount: 0, streak: 0, freezes: 2, freezeUsed: false },
      ],
      'C'
    );
  });

  it('has no freeze left when a rank drop makes the used count reach the new allowance', () => {
    const state: StreakState = {
      currentStreak: 4,
      freezesUsedThisWeek: 2,
      lastFreezeWeekReset: '2026-10-05',
    };

    const result = closeDayStreak(state, day('2026-10-06', 0), 'C');

    expect(result.freezeUsed).toBe(false);
    expect(result.streakState.currentStreak).toBe(0);
    expect(result.streakState.freezesUsedThisWeek).toBe(2);
  });

  it('changes nothing on a day with no quest-active stats', () => {
    const state: StreakState = {
      currentStreak: 7,
      freezesUsedThisWeek: 1,
      lastFreezeWeekReset: '2026-10-05',
    };
    const noQuestDay: StreakDay = {
      date: '2026-10-06',
      completionCount: 0,
      hasQuestStats: false,
    };

    const result = closeDayStreak(state, noQuestDay, 'E');

    expect(result).toEqual({ streakState: state, freezeUsed: false });
  });

  it('does not count a completion on a day with no quest-active stats', () => {
    const state: StreakState = {
      currentStreak: 3,
      freezesUsedThisWeek: 0,
      lastFreezeWeekReset: '2026-10-05',
    };

    const result = closeDayStreak(
      state,
      { date: '2026-10-06', completionCount: 4, hasQuestStats: false },
      'E'
    );

    expect(result.streakState.currentStreak).toBe(3);
    expect(result.freezeUsed).toBe(false);
  });

  it('resets the freeze counter on a Monday across a month boundary', () => {
    const state: StreakState = {
      currentStreak: 3,
      freezesUsedThisWeek: 1,
      lastFreezeWeekReset: '2026-02-23',
    };

    const result = closeDayStreak(state, day('2026-03-02', 1), 'E');

    expect(result.streakState).toEqual({
      currentStreak: 4,
      freezesUsedThisWeek: 0,
      lastFreezeWeekReset: '2026-03-02',
    });
  });

  it('resets the freeze counter on a Monday across a year boundary', () => {
    const state: StreakState = {
      currentStreak: 9,
      freezesUsedThisWeek: 1,
      lastFreezeWeekReset: '2026-12-28',
    };

    const result = closeDayStreak(state, day('2027-01-04', 1), 'E');

    expect(result.streakState).toEqual({
      currentStreak: 10,
      freezesUsedThisWeek: 0,
      lastFreezeWeekReset: '2027-01-04',
    });
  });

  it('does not reset the counter when a day falls in the same week', () => {
    const state: StreakState = {
      currentStreak: 2,
      freezesUsedThisWeek: 1,
      lastFreezeWeekReset: '2026-10-05',
    };

    const result = closeDayStreak(state, day('2026-10-08', 1), 'E');

    expect(result.streakState.freezesUsedThisWeek).toBe(1);
    expect(result.streakState.lastFreezeWeekReset).toBe('2026-10-05');
  });

  it('does not mutate its input', () => {
    const state: StreakState = Object.freeze({
      currentStreak: 3,
      freezesUsedThisWeek: 0,
      lastFreezeWeekReset: '2026-10-05',
    });

    const result = closeDayStreak(state, day('2026-10-06', 0), 'E');

    expect(result.streakState).not.toBe(state);
    expect(state).toEqual({
      currentStreak: 3,
      freezesUsedThisWeek: 0,
      lastFreezeWeekReset: '2026-10-05',
    });
  });
});

describe('displayStreak', () => {
  it('adds one while today already has a completion', () => {
    expect(displayStreak(4, true)).toBe(5);
  });

  it('returns the closed-day streak when today has no completion', () => {
    expect(displayStreak(4, false)).toBe(4);
  });
});
