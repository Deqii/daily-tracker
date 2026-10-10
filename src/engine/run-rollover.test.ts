import { describe, expect, it } from 'vitest';
import type { DailyQuestDay, LocalDate, Stat, Task, UserState } from '../lib/types';
import { STATS } from '../lib/types';
import { selectDailyTasks } from './daily';
import { completeTask } from './complete-task';
import { runRollover } from './run-rollover';
import type { AppState } from './state';

const ids = (): (() => string) => {
  let next = 0;

  return () => `id${++next}`;
};

const anchor = (id: string, stat: Stat): Task => ({
  id,
  familyName: `Task ${stat}`,
  stat,
  isAnchor: true,
  variants: [{ tier: 'ringan', description: '5 reps', points: 5 }],
  createdAt: '2026-10-01T00:00:00+00:00',
});

const fiveAnchors = (): Task[] => STATS.map((stat) => anchor(`a${stat}`, stat));

const userState = (overrides: Partial<UserState> = {}): UserState => ({
  lifetimeXP: 100,
  wallet: 100,
  statXP: { STR: 20, VIT: 20, INT: 20, DISC: 20, SOC: 20 },
  rank: 'E',
  currentStreak: 0,
  freezesUsedThisWeek: 0,
  lastFreezeWeekReset: '2026-10-05',
  penaltyStats: [],
  equippedTitle: null,
  unlockedTitles: [],
  totalCompletions: 0,
  totalPurchases: 0,
  lastRolloverDate: '2026-10-10',
  ...overrides,
});

const zeroCounts = (): Record<Stat, number> => ({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

const requiredAll = (value = 1): Record<Stat, number> => ({
  STR: value,
  VIT: value,
  INT: value,
  DISC: value,
  SOC: value,
});

const openDay = (date: LocalDate, overrides: Partial<DailyQuestDay> = {}): DailyQuestDay => ({
  date,
  selectedTaskIdPerStat: {},
  requiredCompletions: requiredAll(),
  actualCompletions: zeroCounts(),
  netPointsChange: 0,
  freezeUsed: false,
  closed: false,
  lifetimeXPEnd: null,
  levelEnd: null,
  rankEnd: null,
  ...overrides,
});

const makeState = (
  options: {
    tasks?: Task[];
    dailyQuestLog?: DailyQuestDay[];
    userState?: Partial<UserState>;
  } = {}
): AppState => ({
  tasks: options.tasks ?? fiveAnchors(),
  completions: [],
  dailyQuestLog: options.dailyQuestLog ?? [openDay('2026-10-10')],
  rewards: [],
  rewardPurchases: [],
  userState: userState(options.userState),
  milestoneEvents: [],
});

const completeTasks = (state: AppState, now: Date, taskIds: string[]): AppState => {
  let next = state;

  for (const taskId of taskIds) {
    const result = completeTask(next, { taskId, variantTier: null }, now, ids());

    if (!result.ok) {
      throw new Error(`Expected a successful completion of ${taskId}`);
    }

    next = result.value.state;
  }

  return next;
};

describe('runRollover', () => {
  it('returns the state unchanged when today is before lastRolloverDate', () => {
    const state = makeState();
    const result = runRollover(state, '2026-10-09', ids());

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('changes nothing when today equals lastRolloverDate and the open day exists', () => {
    const state = makeState();
    const result = runRollover(state, '2026-10-10', ids());

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('ensures the open day entry exists when today equals lastRolloverDate', () => {
    const state = makeState({ dailyQuestLog: [] });
    const result = runRollover(state, '2026-10-10', ids());

    expect(result.state.dailyQuestLog).toHaveLength(1);
    expect(result.state.dailyQuestLog[0]).toMatchObject({ date: '2026-10-10', closed: false });
    expect(result.state.userState.lastRolloverDate).toBe('2026-10-10');
    expect(result.events).toEqual([]);
  });

  it('reproduces Appendix A scenario 2: four days away, including created days', () => {
    const state = makeState({
      userState: { lifetimeXP: 60, wallet: 60 },
      dailyQuestLog: [openDay('2026-10-10')],
    });
    const { state: next, events } = runRollover(state, '2026-10-14', ids());

    expect(events).toEqual([]);
    expect(next.userState.lifetimeXP).toBe(0);
    expect(next.userState.wallet).toBe(0);
    expect(next.userState.rank).toBe('E');
    expect(next.userState.penaltyStats).toEqual(['STR', 'VIT', 'INT', 'DISC', 'SOC']);
    expect(next.userState.freezesUsedThisWeek).toBe(1);
    expect(next.userState.currentStreak).toBe(0);

    const closedDays = next.dailyQuestLog.filter((day) => day.closed);
    expect(closedDays.map((day) => day.date)).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
    ]);
    expect(closedDays.map((day) => day.netPointsChange)).toEqual([-25, -25, -10, 0]);
    expect(closedDays.map((day) => day.lifetimeXPEnd)).toEqual([35, 10, 0, 0]);
    expect(closedDays.map((day) => day.levelEnd)).toEqual([2, 1, 1, 1]);
    expect(closedDays.map((day) => day.rankEnd)).toEqual(['E', 'E', 'E', 'E']);
    expect(closedDays.map((day) => day.freezeUsed)).toEqual([true, false, true, false]);

    const today = next.dailyQuestLog.find((day) => day.date === '2026-10-14');
    expect(today).toMatchObject({
      closed: false,
      requiredCompletions: requiredAll(2),
      actualCompletions: zeroCounts(),
      netPointsChange: 0,
    });
    expect(next.userState.lastRolloverDate).toBe('2026-10-14');
  });

  it('penalizes all five missed stats and emits a rankDown on the drop (Appendix A scenario 3)', () => {
    const state = makeState({
      userState: {
        lifetimeXP: 360,
        wallet: 360,
        statXP: { STR: 72, VIT: 72, INT: 72, DISC: 72, SOC: 72 },
        rank: 'D',
      },
      dailyQuestLog: [openDay('2026-10-10')],
    });
    const { state: next, events } = runRollover(state, '2026-10-11', ids());

    expect(next.userState.lifetimeXP).toBe(320);
    expect(next.userState.wallet).toBe(320);
    expect(next.userState.rank).toBe('E');
    expect(events).toEqual([
      { id: 'id1', type: 'rankDown', localDate: '2026-10-10', from: 'D', to: 'E', seen: false },
    ]);
    expect(next.milestoneEvents).toEqual(events);

    const closed = next.dailyQuestLog.find((day) => day.date === '2026-10-10');
    expect(closed).toMatchObject({
      closed: true,
      netPointsChange: -40,
      lifetimeXPEnd: 320,
      levelEnd: 5,
      rankEnd: 'E',
    });
  });

  it('uses the rank held at the start of each day for the penalty', () => {
    const state = makeState({
      userState: {
        lifetimeXP: 360,
        wallet: 360,
        statXP: { STR: 72, VIT: 72, INT: 72, DISC: 72, SOC: 72 },
        rank: 'D',
      },
      dailyQuestLog: [openDay('2026-10-10')],
    });
    const afterDrop = runRollover(state, '2026-10-11', ids());

    expect(afterDrop.state.userState.rank).toBe('E');

    const second = runRollover(afterDrop.state, '2026-10-12', ids());
    const day = second.state.dailyQuestLog.find((candidate) => candidate.date === '2026-10-11');

    expect(second.state.userState.lifetimeXP).toBe(295);
    expect(second.state.userState.wallet).toBe(295);
    expect(day?.netPointsChange).toBe(-25);
  });

  it('floors XP and Wallet at 0 separately', () => {
    const state = makeState({
      userState: { lifetimeXP: 5, wallet: 100 },
      dailyQuestLog: [openDay('2026-10-10')],
    });
    const { state: next } = runRollover(state, '2026-10-11', ids());

    expect(next.userState.lifetimeXP).toBe(0);
    expect(next.userState.wallet).toBe(75);

    const closed = next.dailyQuestLog.find((day) => day.date === '2026-10-10');
    expect(closed?.netPointsChange).toBe(-5);
  });

  it('does not require a stat that has no task when the day is closed', () => {
    const day = openDay('2026-10-10', { requiredCompletions: requiredAll() });
    const state = makeState({ tasks: [anchor('aSTR', 'STR')], dailyQuestLog: [day] });
    const { state: next } = runRollover(state, '2026-10-11', ids());

    expect(next.userState.lifetimeXP).toBe(95);
    expect(next.userState.wallet).toBe(95);
    expect(next.userState.penaltyStats).toEqual(['STR']);
  });

  it('extends the streak when a day counts and uses freezes when it does not (PRD 2.1)', () => {
    const day = openDay('2026-10-09', {
      actualCompletions: { STR: 1, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    });
    const state = makeState({
      userState: { rank: 'C', lifetimeXP: 2000, currentStreak: 3, lastRolloverDate: '2026-10-09' },
      dailyQuestLog: [day],
    });

    const afterCount = runRollover(state, '2026-10-10', ids());
    expect(afterCount.state.userState.currentStreak).toBe(4);
    expect(
      afterCount.state.dailyQuestLog.find((candidate) => candidate.date === '2026-10-09')
        ?.freezeUsed
    ).toBe(false);

    const afterFirstFreeze = runRollover(afterCount.state, '2026-10-11', ids());
    expect(afterFirstFreeze.state.userState.currentStreak).toBe(4);
    expect(afterFirstFreeze.state.userState.freezesUsedThisWeek).toBe(1);
    expect(
      afterFirstFreeze.state.dailyQuestLog.find((candidate) => candidate.date === '2026-10-10')
        ?.freezeUsed
    ).toBe(true);

    const afterSecondFreeze = runRollover(afterFirstFreeze.state, '2026-10-12', ids());
    expect(afterSecondFreeze.state.userState.currentStreak).toBe(4);
    expect(afterSecondFreeze.state.userState.freezesUsedThisWeek).toBe(2);
    expect(
      afterSecondFreeze.state.dailyQuestLog.find((candidate) => candidate.date === '2026-10-11')
        ?.freezeUsed
    ).toBe(true);
  });

  it('stores a newly unlocked title through the helper using the closed-days streak', () => {
    const day = openDay('2026-10-10', {
      actualCompletions: { STR: 1, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    });
    const state = makeState({ userState: { currentStreak: 6 }, dailyQuestLog: [day] });
    const { state: next } = runRollover(state, '2026-10-11', ids());

    expect(next.userState.currentStreak).toBe(7);
    expect(next.userState.unlockedTitles).toContain('streak-7');
  });

  it('opens today with selectDailyTasks, buildRequired, and zero counts', () => {
    const rotatingVIT = { ...anchor('rVIT', 'VIT'), isAnchor: false };
    const tasks = [...fiveAnchors(), rotatingVIT];
    const state = makeState({
      tasks,
      dailyQuestLog: [
        openDay('2026-10-10', {
          actualCompletions: requiredAll(),
          netPointsChange: 15,
        }),
      ],
    });
    const { state: next } = runRollover(state, '2026-10-11', ids());

    const today = next.dailyQuestLog.find((day) => day.date === '2026-10-11');
    expect(today).toMatchObject({
      selectedTaskIdPerStat: selectDailyTasks(tasks, '2026-10-11'),
      requiredCompletions: requiredAll(),
      actualCompletions: zeroCounts(),
      netPointsChange: 0,
      freezeUsed: false,
      closed: false,
      lifetimeXPEnd: null,
      levelEnd: null,
      rankEnd: null,
    });
    expect(next.userState.lastRolloverDate).toBe('2026-10-11');
  });

  it('returns the same state when called twice with the same today', () => {
    const state = makeState({
      userState: { lifetimeXP: 60, wallet: 60 },
      dailyQuestLog: [openDay('2026-10-10')],
    });
    const first = runRollover(state, '2026-10-14', ids());
    const second = runRollover(first.state, '2026-10-14', ids());

    expect(second.state).toBe(first.state);
    expect(second.events).toEqual([]);
  });

  it('does not mutate the input state', () => {
    const state = makeState({ userState: { lifetimeXP: 60, wallet: 60 } });
    const snapshot = structuredClone(state);

    runRollover(state, '2026-10-12', ids());

    expect(state).toEqual(snapshot);
  });

  it('reproduces Appendix A scenario 1 through completeTask and runRollover', () => {
    let state = makeState({ dailyQuestLog: [openDay('2026-10-10')] });

    state = completeTasks(state, new Date('2026-10-10T12:00:00'), [
      'aSTR',
      'aVIT',
      'aINT',
      'aDISC',
    ]);
    expect(state.userState.lifetimeXP).toBe(112);

    state = runRollover(state, '2026-10-11', ids()).state;
    expect(state.userState.lifetimeXP).toBe(107);
    expect(state.userState.wallet).toBe(107);
    expect(state.userState.penaltyStats).toEqual(['SOC']);

    state = completeTasks(state, new Date('2026-10-11T12:00:00'), [
      'aSTR',
      'aVIT',
      'aINT',
      'aDISC',
      'aSOC',
    ]);
    expect(state.userState.lifetimeXP).toBe(122);

    state = runRollover(state, '2026-10-12', ids()).state;
    expect(state.userState.lifetimeXP).toBe(117);
    expect(state.userState.penaltyStats).toEqual(['SOC']);

    state = completeTasks(state, new Date('2026-10-12T12:00:00'), [
      'aSTR',
      'aVIT',
      'aINT',
      'aDISC',
      'aSOC',
      'aSOC',
    ]);
    expect(state.userState.lifetimeXP).toBe(135);
    expect(state.milestoneEvents).toHaveLength(1);
    expect(state.milestoneEvents[0]).toMatchObject({
      type: 'levelUp',
      localDate: '2026-10-12',
      from: 3,
      to: 4,
      seen: false,
    });

    state = runRollover(state, '2026-10-13', ids()).state;
    expect(state.userState.wallet).toBe(135);
    expect(state.userState.penaltyStats).toEqual([]);
    expect(state.userState.statXP).toEqual({
      STR: 29,
      VIT: 29,
      INT: 29,
      DISC: 29,
      SOC: 29,
    });
  });
});

/**
 * Day-boundary coverage for `runRollover`. The engine only ever sees `LocalDate` strings and does
 * UTC calendar arithmetic (`lib/date`), so every assertion here is a plain date sequence and holds
 * under any process timezone, including the three CI timezones.
 */
describe('runRollover day-boundary edge cases', () => {
  const closedDates = (state: AppState): LocalDate[] =>
    state.dailyQuestLog.filter((day) => day.closed).map((day) => day.date);

  const closedXPEnds = (state: AppState): (number | null)[] =>
    state.dailyQuestLog.filter((day) => day.closed).map((day) => day.lifetimeXPEnd);

  const rollover = (
    from: LocalDate,
    to: LocalDate,
    overrides: Partial<UserState> = {},
    log: DailyQuestDay[] = [openDay(from)]
  ) => {
    const state = makeState({
      userState: { lifetimeXP: 100, wallet: 100, lastRolloverDate: from, ...overrides },
      dailyQuestLog: log,
    });

    return runRollover(state, to, ids());
  };

  it('closes days across a month boundary', () => {
    const { state: next, events } = rollover('2026-01-30', '2026-02-02');

    expect(closedDates(next)).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
    expect(closedXPEnds(next)).toEqual([75, 50, 25]);
    expect(next.dailyQuestLog.find((day) => day.date === '2026-02-02')).toMatchObject({
      closed: false,
    });
    expect(next.userState.lastRolloverDate).toBe('2026-02-02');
    expect(events).toEqual([]);
  });

  it('closes days across a year boundary', () => {
    const { state: next, events } = rollover('2025-12-30', '2026-01-02');

    expect(closedDates(next)).toEqual(['2025-12-30', '2025-12-31', '2026-01-01']);
    expect(closedXPEnds(next)).toEqual([75, 50, 25]);
    expect(next.userState.lastRolloverDate).toBe('2026-01-02');
    expect(events).toEqual([]);
  });

  it('closes the leap day 2028-02-29', () => {
    const { state: next, events } = rollover('2028-02-28', '2028-03-02');

    expect(closedDates(next)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    expect(closedXPEnds(next)).toEqual([75, 50, 25]);
    expect(next.userState.lastRolloverDate).toBe('2028-03-02');
    expect(events).toEqual([]);
  });

  it('resets freezesUsedThisWeek to 0 on the first day of a new week', () => {
    const { state: next } = rollover(
      '2026-10-11',
      '2026-10-13',
      {
        currentStreak: 5,
        freezesUsedThisWeek: 1,
        lastFreezeWeekReset: '2026-10-05',
      },
      [
        openDay('2026-10-11', { actualCompletions: requiredAll() }),
        openDay('2026-10-12', { actualCompletions: requiredAll() }),
      ]
    );

    expect(closedDates(next)).toEqual(['2026-10-11', '2026-10-12']);
    expect(next.userState.currentStreak).toBe(7);
    expect(next.userState.freezesUsedThisWeek).toBe(0);
    expect(next.userState.lastFreezeWeekReset).toBe('2026-10-12');
  });

  it('grants a fresh freeze on Monday after the previous week used its only one', () => {
    const { state: next } = rollover('2026-10-11', '2026-10-13', {
      currentStreak: 5,
      freezesUsedThisWeek: 1,
      lastFreezeWeekReset: '2026-10-05',
    });

    const sunday = next.dailyQuestLog.find((day) => day.date === '2026-10-11');
    const monday = next.dailyQuestLog.find((day) => day.date === '2026-10-12');

    expect(sunday).toMatchObject({ closed: true, freezeUsed: false });
    expect(monday).toMatchObject({ closed: true, freezeUsed: true });
    expect(next.userState).toMatchObject({
      currentStreak: 0,
      freezesUsedThisWeek: 1,
      lastFreezeWeekReset: '2026-10-12',
    });
  });

  it.each([
    {
      name: 'US spring-forward',
      from: '2026-03-06',
      to: '2026-03-10',
      expected: ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'],
    },
    {
      name: 'US fall-back',
      from: '2026-10-30',
      to: '2026-11-03',
      expected: ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'],
    },
    {
      name: 'EU fall-back',
      from: '2026-10-23',
      to: '2026-10-27',
      expected: ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'],
    },
  ])('closes every calendar day across the $name DST transition', ({ from, to, expected }) => {
    const { state: next, events } = rollover(from, to);

    expect(closedDates(next)).toEqual(expected);
    expect(closedXPEnds(next)).toEqual([75, 50, 25, 0]);
    expect(next.userState.lastRolloverDate).toBe(to);
    expect(next.dailyQuestLog.find((day) => day.date === to)).toMatchObject({ closed: false });
    expect(events).toEqual([]);
  });

  it('returns the state unchanged when the clock moved back across a month boundary', () => {
    const state = makeState({
      userState: { lastRolloverDate: '2026-11-02' },
      dailyQuestLog: [openDay('2026-11-02')],
    });
    const result = runRollover(state, '2026-10-30', ids());

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });
});

/**
 * Orchestration-level coverage for the penalty deduction and the 2x cap (PRD §2.1, §7.4). The
 * per-rank amounts and the requirement arithmetic are unit-tested in `evaluation.test.ts`; these
 * tests pin how they surface through `runRollover`: flags, requirement, balances, and events.
 */
describe('penalty deduction and the 2x cap through runRollover', () => {
  const required = (overrides: Partial<Record<Stat, number>>): Record<Stat, number> => ({
    ...zeroCounts(),
    ...overrides,
  });

  const closedByDate = (state: AppState, date: LocalDate): DailyQuestDay | undefined =>
    state.dailyQuestLog.find((day) => day.date === date);

  it('caps a repeatedly missed stat at a requirement of 2 and charges one penalty per day', () => {
    const state = makeState({
      tasks: [anchor('aSTR', 'STR')],
      userState: { lifetimeXP: 100, wallet: 100, rank: 'E', lastRolloverDate: '2026-10-10' },
      dailyQuestLog: [openDay('2026-10-10')],
    });
    const { state: next, events } = runRollover(state, '2026-10-15', ids());

    const closedDays = next.dailyQuestLog.filter((day) => day.closed);

    expect(closedDays.map((day) => day.date)).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
    ]);
    expect(closedDays.map((day) => day.requiredCompletions.STR)).toEqual([1, 2, 2, 2, 2]);
    expect(closedDays.map((day) => day.netPointsChange)).toEqual([-5, -5, -5, -5, -5]);
    expect(closedDays.map((day) => day.lifetimeXPEnd)).toEqual([95, 90, 85, 80, 75]);

    expect(next.userState.lifetimeXP).toBe(75);
    expect(next.userState.wallet).toBe(75);
    expect(next.userState.penaltyStats).toEqual(['STR']);
    expect(closedByDate(next, '2026-10-15')?.requiredCompletions.STR).toBe(2);
    expect(events).toEqual([]);
  });

  it('charges the full penalty once for a penalized stat that is only half satisfied (1 of 2)', () => {
    const state = makeState({
      tasks: [anchor('aSTR', 'STR')],
      userState: {
        lifetimeXP: 100,
        wallet: 100,
        rank: 'E',
        penaltyStats: ['STR'],
        lastRolloverDate: '2026-10-10',
      },
      dailyQuestLog: [
        openDay('2026-10-10', {
          requiredCompletions: required({ STR: 2 }),
          actualCompletions: required({ STR: 1 }),
        }),
      ],
    });
    const { state: next, events } = runRollover(state, '2026-10-11', ids());

    expect(closedByDate(next, '2026-10-10')).toMatchObject({
      closed: true,
      netPointsChange: -5,
      lifetimeXPEnd: 95,
    });
    expect(next.userState.lifetimeXP).toBe(95);
    expect(next.userState.wallet).toBe(95);
    expect(next.userState.penaltyStats).toEqual(['STR']);
    expect(closedByDate(next, '2026-10-11')?.requiredCompletions.STR).toBe(2);
    expect(events).toEqual([]);
  });

  it('clears the 2x flag and returns the requirement to 1 when the stat is satisfied (2 of 2)', () => {
    const state = makeState({
      tasks: [anchor('aSTR', 'STR')],
      userState: {
        lifetimeXP: 100,
        wallet: 100,
        rank: 'E',
        penaltyStats: ['STR'],
        lastRolloverDate: '2026-10-10',
      },
      dailyQuestLog: [
        openDay('2026-10-10', {
          requiredCompletions: required({ STR: 2 }),
          actualCompletions: required({ STR: 2 }),
        }),
      ],
    });
    const { state: next, events } = runRollover(state, '2026-10-11', ids());

    expect(closedByDate(next, '2026-10-10')).toMatchObject({
      closed: true,
      netPointsChange: 0,
      lifetimeXPEnd: 100,
    });
    expect(next.userState.lifetimeXP).toBe(100);
    expect(next.userState.wallet).toBe(100);
    expect(next.userState.penaltyStats).toEqual([]);
    expect(closedByDate(next, '2026-10-11')?.requiredCompletions.STR).toBe(1);
    expect(events).toEqual([]);
  });
});
