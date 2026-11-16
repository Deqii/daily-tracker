import { describe, expect, it } from 'vitest';
import { weekStart } from '../lib/date';
import type {
  DailyQuestDay,
  MilestoneEvent,
  Rank,
  Reward,
  Stat,
  Task,
  UserState,
} from '../lib/types';
import { STATS } from '../lib/types';
import { passesBalanceGate } from './balance';
import type { AppState } from './state';
import { completeTask } from './complete-task';
import { applyPenalty, buildRequired, evaluateDay, nextPenaltyStats } from './evaluation';
import { level } from './level';
import { pointsAwarded } from './points';
import { purchaseReward } from './purchase';
import { getRankConfig, rank, resolveRank } from './rank';
import { runRollover } from './run-rollover';
import { closeDayStreak, displayStreak } from './streak';
import { syncOpenDay } from './sync-open-day';
import { equipTitle, evaluateTitles } from './titles';

const DAY1 = '2026-10-01';
const DAY2 = '2026-10-02';
const DAY3 = '2026-10-03';
const DAY4 = '2026-10-04';
const DAY5 = '2026-10-05';

const counts = (overrides: Partial<Record<Stat, number>> = {}): Record<Stat, number> => ({
  STR: 0,
  VIT: 0,
  INT: 0,
  DISC: 0,
  SOC: 0,
  ...overrides,
});

const task = (id: string, stat: Stat, isAnchor = true, points = 5): Task => ({
  id,
  familyName: `Task ${id}`,
  stat,
  isAnchor,
  variants: [{ tier: 'easy', description: 'one', points }],
  createdAt: '2026-09-30T08:00:00+07:00',
});

const openDay = (date: string, overrides: Partial<DailyQuestDay> = {}): DailyQuestDay => ({
  date,
  selectedTaskIdPerStat: {},
  requiredCompletions: counts(),
  actualCompletions: counts(),
  netPointsChange: 0,
  freezeUsed: false,
  closed: false,
  lifetimeXPEnd: null,
  levelEnd: null,
  rankEnd: null,
  ...overrides,
});

const userState = (overrides: Partial<UserState> = {}): UserState => ({
  lifetimeXP: 0,
  wallet: 0,
  statXP: counts(),
  rank: 'E',
  currentStreak: 0,
  freezesUsedThisWeek: 0,
  lastFreezeWeekReset: weekStart(DAY1),
  penaltyStats: [],
  equippedTitle: null,
  unlockedTitles: [],
  totalCompletions: 0,
  totalPurchases: 0,
  lastRolloverDate: DAY1,
  ...overrides,
});

const state = (
  tasks: Task[],
  day: DailyQuestDay,
  userOverrides: Partial<UserState> = {}
): AppState => ({
  tasks,
  completions: [],
  dailyQuestLog: [day],
  rewards: [],
  rewardPurchases: [],
  userState: userState({ lastRolloverDate: day.date, ...userOverrides }),
  milestoneEvents: [],
});

const nowFor = (date: string): Date => {
  const [year, month, dayOfMonth] = date.split('-').map(Number);

  return new Date(year ?? 2026, (month ?? 10) - 1, dayOfMonth ?? 1, 9, 0, 0);
};

const ids = (): (() => string) => {
  let next = 0;
  return () => `id${String(next++).padStart(4, '0')}`;
};

const complete = (
  current: AppState,
  taskId: string,
  tier: 'easy' | 'medium' | 'hard' | null = null
): { state: AppState; events: MilestoneEvent[] } => {
  const result = completeTask(
    current,
    { taskId, variantTier: tier },
    nowFor(current.userState.lastRolloverDate),
    ids()
  );

  if (!result.ok) {
    throw new Error(`completeTask failed: ${result.error}`);
  }

  return { state: result.value.state, events: result.value.events };
};

const completeAll = (current: AppState, taskIds: readonly string[]): AppState => {
  let next = current;

  for (const taskId of taskIds) {
    next = complete(next, taskId).state;
  }

  return next;
};

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);

    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }

  return value;
};

describe('PRD Appendix A scenario 1: 2x requirement, cap, and clearing', () => {
  it('closes three days with the expected XP, flags, level, wallet, and stat totals', () => {
    const tasks = STATS.map((stat) => task(`a${stat}`, stat));
    const start = state(
      tasks,
      openDay(DAY1, { requiredCompletions: counts({ STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 1 }) }),
      {
        lifetimeXP: 100,
        wallet: 100,
        statXP: counts({ STR: 20, VIT: 20, INT: 20, DISC: 20, SOC: 20 }),
      }
    );

    const day1 = completeAll(start, ['aSTR', 'aVIT', 'aINT', 'aDISC']);

    expect(day1.userState.lifetimeXP).toBe(112);
    expect(day1.dailyQuestLog[0]?.netPointsChange).toBe(12);

    const afterDay1 = runRollover(day1, DAY2, ids());
    expect(afterDay1.state.userState.lifetimeXP).toBe(107);
    expect(afterDay1.state.userState.wallet).toBe(107);
    expect(afterDay1.state.userState.penaltyStats).toEqual(['SOC']);
    expect(afterDay1.state.dailyQuestLog[0]).toMatchObject({
      date: DAY1,
      netPointsChange: 7,
      lifetimeXPEnd: 107,
      levelEnd: 3,
      rankEnd: 'E',
      closed: true,
    });
    expect(afterDay1.state.dailyQuestLog[1]?.requiredCompletions).toEqual(
      counts({ STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 2 })
    );

    const day2 = completeAll(afterDay1.state, ['aSTR', 'aVIT', 'aINT', 'aDISC', 'aSOC']);
    expect(day2.userState.lifetimeXP).toBe(122);
    expect(day2.dailyQuestLog[1]?.actualCompletions.SOC).toBe(1);

    const afterDay2 = runRollover(day2, DAY3, ids());
    expect(afterDay2.state.userState.lifetimeXP).toBe(117);
    expect(afterDay2.state.userState.penaltyStats).toEqual(['SOC']);
    expect(afterDay2.state.dailyQuestLog[1]?.netPointsChange).toBe(10);

    const day3 = completeAll(afterDay2.state, ['aSTR', 'aVIT', 'aINT', 'aDISC', 'aSOC', 'aSOC']);
    const afterDay3 = runRollover(day3, DAY4, ids());
    const final = afterDay3.state;

    expect(final.userState.lifetimeXP).toBe(135);
    expect(final.userState.wallet).toBe(135);
    expect(final.userState.statXP).toEqual(
      counts({ STR: 29, VIT: 29, INT: 29, DISC: 29, SOC: 29 })
    );
    expect(final.userState.penaltyStats).toEqual([]);
    expect(final.userState.currentStreak).toBe(3);
    expect(final.userState.freezesUsedThisWeek).toBe(0);
    expect(final.userState.totalCompletions).toBe(15);
    expect(level(final.userState.lifetimeXP)).toBe(4);
    expect(final.userState.rank).toBe('E');
    expect(final.dailyQuestLog[2]?.netPointsChange).toBe(18);
    expect(final.dailyQuestLog[2]?.levelEnd).toBe(4);
    expect(final.milestoneEvents).toContainEqual(
      expect.objectContaining({ type: 'levelUp', from: 3, to: 4 })
    );
  });
});

describe('PRD Appendix A scenario 2: four days away', () => {
  it('closes four missed days with floors and carries all five flags', () => {
    const tasks = STATS.map((stat) => task(`a${stat}`, stat));
    const start = state(
      tasks,
      openDay(DAY1, {
        requiredCompletions: counts({ STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 1 }),
      }),
      {
        lifetimeXP: 60,
        wallet: 60,
        statXP: counts({ STR: 10, VIT: 10, INT: 10, DISC: 10, SOC: 10 }),
      }
    );

    const result = runRollover(start, DAY5, ids());
    const closed = result.state.dailyQuestLog.filter((entry) => entry.closed);

    expect(closed.map((entry) => entry.lifetimeXPEnd)).toEqual([35, 10, 0, 0]);
    expect(closed.map((entry) => entry.netPointsChange)).toEqual([-25, -25, -10, 0]);
    expect(closed.map((entry) => entry.levelEnd)).toEqual([2, 1, 1, 1]);
    expect(result.state.userState.lifetimeXP).toBe(0);
    expect(result.state.userState.wallet).toBe(0);
    expect(result.state.userState.penaltyStats).toEqual([...STATS]);
    expect(result.state.userState.currentStreak).toBe(0);
    expect(result.state.userState.freezesUsedThisWeek).toBe(1);
    expect(result.state.userState.rank).toBe('E');
    expect(level(result.state.userState.lifetimeXP)).toBe(1);
    expect(result.penaltyNotice?.days).toHaveLength(4);
    expect(result.penaltyNotice?.balancesBefore).toEqual({ xp: 60, wallet: 60 });
    expect(result.penaltyNotice?.balancesAfter).toEqual({ xp: 0, wallet: 0 });
    expect(result.penaltyNotice?.rankDowns).toEqual([]);
  });
});

describe('PRD Appendix A scenario 3: rank drop', () => {
  it('drops D to E immediately and emits one rankDown event', () => {
    const tasks = STATS.map((stat) => task(`a${stat}`, stat));
    const start = state(
      tasks,
      openDay(DAY1, {
        requiredCompletions: counts({ STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 1 }),
      }),
      {
        lifetimeXP: 360,
        wallet: 360,
        statXP: counts({ STR: 72, VIT: 72, INT: 72, DISC: 72, SOC: 72 }),
        rank: 'D',
      }
    );

    const result = runRollover(start, DAY2, ids());
    const closed = result.state.dailyQuestLog[0];

    expect(result.state.userState.lifetimeXP).toBe(320);
    expect(result.state.userState.wallet).toBe(320);
    expect(level(result.state.userState.lifetimeXP)).toBe(5);
    expect(result.state.userState.rank).toBe('E');
    expect(closed).toMatchObject({
      netPointsChange: -40,
      lifetimeXPEnd: 320,
      levelEnd: 5,
      rankEnd: 'E',
      freezeUsed: true,
    });
    expect(result.state.milestoneEvents).toContainEqual(
      expect.objectContaining({ type: 'rankDown', localDate: DAY1, from: 'D', to: 'E' })
    );
    expect(result.penaltyNotice?.days[0]).toMatchObject({
      rankAtStart: 'D',
      nominalDeduction: 40,
      xpDeducted: 40,
      walletDeducted: 40,
      freezeUsed: true,
    });
    expect(result.penaltyNotice?.rankDowns).toEqual([{ localDate: DAY1, from: 'D', to: 'E' }]);
  });
});

describe('PRD Appendix A scenario 4: balance gate', () => {
  it('matches the gate table and rank resolution vectors', () => {
    const table = [
      { SOC: 0, tracked: 4, sum: 400, threshold: 50, passes: true },
      { SOC: 10, tracked: 5, sum: 410, threshold: 41, passes: false },
      { SOC: 44, tracked: 5, sum: 444, threshold: 45, passes: false },
      { SOC: 45, tracked: 5, sum: 445, threshold: 45, passes: true },
    ];

    for (const row of table) {
      const gate = passesBalanceGate(
        counts({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: row.SOC })
      );

      expect(gate.passes).toBe(row.passes);
      expect(gate.threshold).toBe(row.threshold);
      expect(gate.weakest).toBe(row.SOC === 0 ? 'STR' : 'SOC');
      expect(row.tracked).toBe(row.SOC === 0 ? 4 : 5);
      expect(row.sum).toBe(400 + row.SOC);
    }

    const uneven = counts({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 10 });
    expect(resolveRank('E', 6, uneven)).toEqual({ rank: 'E', change: null, blocked: true });
    expect(
      resolveRank('E', 6, counts({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 100 }))
    ).toEqual({ rank: 'D', change: 'up', blocked: false });
    expect(
      resolveRank('E', 12, counts({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 100 }))
    ).toEqual({ rank: 'C', change: 'up', blocked: false });
    expect(
      resolveRank('D', 4, counts({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 100 }))
    ).toEqual({ rank: 'E', change: 'down', blocked: false });
  });
});

describe('PRD Appendix A scenario 5: streak and freeze', () => {
  it('matches the Monday-to-next-Monday table', () => {
    let streak = {
      currentStreak: 0,
      freezesUsedThisWeek: 0,
      lastFreezeWeekReset: weekStart('2026-10-05'),
    };
    const steps = [
      { date: '2026-10-05', completions: 1, streak: 1, freezes: 0, freezeUsed: false },
      { date: '2026-10-06', completions: 1, streak: 2, freezes: 0, freezeUsed: false },
      { date: '2026-10-07', completions: 0, streak: 2, freezes: 1, freezeUsed: true },
      { date: '2026-10-08', completions: 1, streak: 3, freezes: 1, freezeUsed: false },
      { date: '2026-10-09', completions: 0, streak: 0, freezes: 1, freezeUsed: false },
      { date: '2026-10-10', completions: 1, streak: 1, freezes: 1, freezeUsed: false },
      { date: '2026-10-11', completions: 0, streak: 0, freezes: 1, freezeUsed: false },
      { date: '2026-10-12', completions: 1, streak: 1, freezes: 0, freezeUsed: false },
    ];

    for (const step of steps) {
      const result = closeDayStreak(
        streak,
        { date: step.date, completionCount: step.completions, hasQuestStats: true },
        'E'
      );

      streak = result.streakState;
      expect(streak.currentStreak).toBe(step.streak);
      expect(streak.freezesUsedThisWeek).toBe(step.freezes);
      expect(result.freezeUsed).toBe(step.freezeUsed);
    }

    expect(displayStreak(3, true)).toBe(4);
    expect(displayStreak(3, false)).toBe(3);
  });
});

describe('PRD Appendix A scenario 6: task changes on the open day', () => {
  it('syncs requirements and picks without changing closed days, completions, or points', () => {
    const start = state([], openDay(DAY1));

    expect(start.dailyQuestLog[0]).toMatchObject({
      selectedTaskIdPerStat: {},
      requiredCompletions: counts(),
      actualCompletions: counts(),
    });

    const strAnchor = task('aSTR', 'STR');
    const vitRotating = task('rVIT', 'VIT', false);
    const withTasks = syncOpenDay({ ...start, tasks: [strAnchor, vitRotating] }, DAY1);

    expect(withTasks.dailyQuestLog[0]).toMatchObject({
      selectedTaskIdPerStat: { VIT: 'rVIT' },
      requiredCompletions: counts({ STR: 1, VIT: 1 }),
      actualCompletions: counts(),
    });

    const completedStr = complete(withTasks, 'aSTR').state;
    expect(completedStr.userState.lifetimeXP).toBe(3);
    expect(completedStr.dailyQuestLog[0]).toMatchObject({
      requiredCompletions: counts({ STR: 1, VIT: 1 }),
      actualCompletions: counts({ STR: 1 }),
      netPointsChange: 3,
    });
    expect(completedStr.completions).toHaveLength(1);

    const secondStrAnchor = task('aSTR2', 'STR');
    const withSecondAnchor = syncOpenDay(
      { ...completedStr, tasks: [strAnchor, secondStrAnchor, vitRotating] },
      DAY1
    );
    expect(withSecondAnchor.dailyQuestLog[0]).toMatchObject({
      requiredCompletions: counts({ STR: 1, VIT: 1 }),
      actualCompletions: counts({ STR: 1 }),
      netPointsChange: 3,
    });
    expect(withSecondAnchor.completions).toHaveLength(1);

    const withoutVit = syncOpenDay(
      { ...withSecondAnchor, tasks: [strAnchor, secondStrAnchor] },
      DAY1
    );
    expect(withoutVit.dailyQuestLog[0]).toMatchObject({
      selectedTaskIdPerStat: {},
      requiredCompletions: counts({ STR: 1 }),
      actualCompletions: counts({ STR: 1 }),
      netPointsChange: 3,
    });
    expect(withoutVit.completions).toHaveLength(1);

    const vitAnchor = task('aVIT', 'VIT');
    const withVitAnchor = syncOpenDay(
      { ...withoutVit, tasks: [strAnchor, secondStrAnchor, vitAnchor] },
      DAY1
    );
    expect(withVitAnchor.dailyQuestLog[0]).toMatchObject({
      selectedTaskIdPerStat: {},
      requiredCompletions: counts({ STR: 1, VIT: 1 }),
      actualCompletions: counts({ STR: 1 }),
      netPointsChange: 3,
    });
    expect(withVitAnchor.dailyQuestLog.filter((entry) => entry.closed)).toHaveLength(0);
    expect(withVitAnchor.completions).toHaveLength(1);
    expect(withVitAnchor.userState.lifetimeXP).toBe(3);
  });
});

describe('edge vectors', () => {
  it('floors a penalty at zero and reports the actual deduction', () => {
    expect(applyPenalty({ lifetimeXP: 3, wallet: 4 }, 'E', 1)).toEqual({
      lifetimeXP: 0,
      wallet: 0,
      xpDeducted: 3,
      walletDeducted: 4,
    });
  });

  it('keeps a missed 2x stat flagged and clears it when satisfied', () => {
    const required = buildRequired(['STR'], ['STR']);
    expect(required).toEqual(counts({ STR: 2 }));
    expect(evaluateDay(required, counts({ STR: 1 }))).toEqual({ missed: ['STR'], satisfied: [] });
    expect(nextPenaltyStats(['STR'], ['STR'], [], ['STR'])).toEqual(['STR']);
    expect(evaluateDay(required, counts({ STR: 2 }))).toEqual({
      missed: [],
      satisfied: ['STR'],
    });
    expect(nextPenaltyStats(['STR'], [], ['STR'], ['STR'])).toEqual([]);
  });

  it('is idempotent and returns no notice when today is already open', () => {
    const start = state(
      [task('aSTR', 'STR')],
      openDay(DAY1, { requiredCompletions: counts({ STR: 1 }) })
    );
    const first = runRollover(start, DAY2, ids());
    const second = runRollover(first.state, DAY2, ids());

    expect(second.state).toBe(first.state);
    expect(second.events).toEqual([]);
    expect(second.penaltyNotice).toBeNull();
  });

  it('returns the same state when today is before the last rollover', () => {
    const start = state([], openDay(DAY2));
    const result = runRollover(start, DAY1, ids());

    expect(result.state).toBe(start);
    expect(result.events).toEqual([]);
    expect(result.penaltyNotice).toBeNull();
  });

  it('returns completeTask errors in the documented precedence', () => {
    const noOpen = { ...state([], openDay(DAY1)), dailyQuestLog: [] };
    expect(completeTask(noOpen, { taskId: 'x', variantTier: null }, nowFor(DAY1), ids())).toEqual({
      ok: false,
      error: 'NO_OPEN_DAY',
    });

    const base = state(
      [
        task('aSTR', 'STR'),
        {
          ...task('multi', 'STR'),
          variants: [
            { tier: 'easy', description: 'one', points: 5 },
            { tier: 'hard', description: 'two', points: 10 },
          ],
        },
      ],
      openDay(DAY1, { requiredCompletions: counts({ STR: 1 }) })
    );
    expect(
      completeTask(base, { taskId: 'missing', variantTier: null }, nowFor(DAY1), ids())
    ).toEqual({ ok: false, error: 'TASK_NOT_IN_QUEST' });
    expect(completeTask(base, { taskId: 'multi', variantTier: null }, nowFor(DAY1), ids())).toEqual(
      { ok: false, error: 'VARIANT_NOT_FOUND' }
    );

    const full = state(
      [task('aSTR', 'STR')],
      openDay(DAY1, {
        requiredCompletions: counts({ STR: 1 }),
        actualCompletions: counts({ STR: 1 }),
      })
    );
    expect(completeTask(full, { taskId: 'aSTR', variantTier: null }, nowFor(DAY1), ids())).toEqual({
      ok: false,
      error: 'ROW_LIMIT_REACHED',
    });
  });

  it('pins the other public error shapes', () => {
    const start = state([task('aSTR', 'STR')], openDay(DAY1), { wallet: 0 });
    expect(equipTitle(start.userState, 'streak-7')).toEqual({
      ok: false,
      error: 'TITLE_NOT_UNLOCKED',
    });
    expect(evaluateTitles({ userState: start.userState, displayedStreak: 7 })).toEqual([
      'streak-7',
    ]);
    expect(() => getRankConfig('Z' as Rank)).toThrow(RangeError);
    expect(() => pointsAwarded(-1, 'E')).toThrow(RangeError);
    expect(() => pointsAwarded(Number.NaN, 'E')).toThrow(RangeError);
    expect(rank(Number.NaN)).toBe('E');
    expect(rank(0)).toBe('E');
  });

  it('pins purchaseReward error shapes', () => {
    const start = state([], openDay(DAY1));
    const reward: Reward = {
      id: 'r1',
      title: 'Coffee',
      cost: 10,
      createdAt: '2026-09-30T08:00:00+07:00',
    };

    expect(purchaseReward(start, 'missing', nowFor(DAY1), ids())).toEqual({
      ok: false,
      error: 'REWARD_NOT_FOUND',
    });
    expect(purchaseReward({ ...start, rewards: [reward] }, 'r1', nowFor(DAY1), ids())).toEqual({
      ok: false,
      error: 'INSUFFICIENT_WALLET',
    });
  });

  it('does not mutate deep-frozen inputs', () => {
    const start = state(
      [task('aSTR', 'STR')],
      openDay(DAY1, { requiredCompletions: counts({ STR: 1 }) }),
      { lifetimeXP: 10 }
    );

    deepFreeze(start);
    expect(() => complete(start, 'aSTR')).not.toThrow();
    expect(() => runRollover(start, DAY2, ids())).not.toThrow();
  });
});
