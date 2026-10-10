import { describe, expect, it } from 'vitest';
import type { DailyQuestDay, Stat, Task, UserState } from '../lib/types';
import { completeTask } from './complete-task';
import type { AppState } from './state';

const now = new Date('2026-10-10T12:00:00');

const ids = (): (() => string) => {
  let next = 0;

  return () => `id${++next}`;
};

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  familyName: 'Push up',
  stat: 'STR',
  isAnchor: true,
  variants: [{ tier: 'ringan', description: '5 reps', points: 5 }],
  createdAt: '2026-10-01T00:00:00+00:00',
  ...overrides,
});

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

const counts = (overrides: Partial<Record<Stat, number>> = {}): Record<Stat, number> => ({
  STR: 0,
  VIT: 0,
  INT: 0,
  DISC: 0,
  SOC: 0,
  ...overrides,
});

const openDay = (overrides: Partial<DailyQuestDay> = {}): DailyQuestDay => ({
  date: '2026-10-10',
  selectedTaskIdPerStat: {},
  requiredCompletions: counts({ STR: 1 }),
  actualCompletions: counts(),
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
  tasks: options.tasks ?? [task()],
  completions: [],
  dailyQuestLog: options.dailyQuestLog ?? [openDay()],
  rewards: [],
  rewardPurchases: [],
  userState: userState(options.userState),
  milestoneEvents: [],
});

const expectOk = (result: ReturnType<typeof completeTask>) => {
  if (!result.ok) {
    throw new Error(`Expected a successful completion, got ${result.error}`);
  }

  return result.value;
};

describe('completeTask', () => {
  it('returns NO_OPEN_DAY when there is no open day', () => {
    const result = completeTask(
      makeState({ dailyQuestLog: [] }),
      { taskId: 't1', variantTier: null },
      now,
      ids()
    );

    expect(result).toEqual({ ok: false, error: 'NO_OPEN_DAY' });
  });

  it('returns TASK_NOT_IN_QUEST for an unknown id or a stat with no requirement', () => {
    expect(
      completeTask(makeState(), { taskId: 'missing', variantTier: null }, now, ids())
    ).toEqual({ ok: false, error: 'TASK_NOT_IN_QUEST' });

    expect(
      completeTask(
        makeState({ dailyQuestLog: [openDay({ requiredCompletions: counts() })] }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    ).toEqual({ ok: false, error: 'TASK_NOT_IN_QUEST' });
  });

  it('returns TASK_NOT_IN_QUEST for a rotating task the day did not pick', () => {
    const rotating = task({ id: 't2', isAnchor: false });

    expect(
      completeTask(
        makeState({ tasks: [rotating] }),
        { taskId: 't2', variantTier: null },
        now,
        ids()
      )
    ).toEqual({ ok: false, error: 'TASK_NOT_IN_QUEST' });
  });

  it('completes a rotating task the day picked', () => {
    const rotating = task({ id: 't2', isAnchor: false });
    const day = openDay({ selectedTaskIdPerStat: { STR: 't2' } });

    const value = expectOk(
      completeTask(
        makeState({ tasks: [rotating], dailyQuestLog: [day] }),
        { taskId: 't2', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.completion).toMatchObject({ taskId: 't2', variantTier: null });
  });

  it('returns VARIANT_NOT_FOUND when a multi-variant task lacks a matching tier', () => {
    const variants = task({
      variants: [
        { tier: 'ringan', description: '5 reps', points: 5 },
        { tier: 'berat', description: '20 reps', points: 20 },
      ],
    });

    expect(
      completeTask(
        makeState({ tasks: [variants] }),
        { taskId: 't1', variantTier: 'sedang' },
        now,
        ids()
      )
    ).toEqual({ ok: false, error: 'VARIANT_NOT_FOUND' });
  });

  it('returns ROW_LIMIT_REACHED when the row already met its requirement', () => {
    const day = openDay({ actualCompletions: counts({ STR: 1 }) });

    expect(
      completeTask(
        makeState({ dailyQuestLog: [day] }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    ).toEqual({ ok: false, error: 'ROW_LIMIT_REACHED' });
  });

  it('awards points to XP, Wallet, and statXP and logs the completion', () => {
    const value = expectOk(
      completeTask(makeState(), { taskId: 't1', variantTier: null }, now, ids())
    );

    expect(value.state.userState.lifetimeXP).toBe(103);
    expect(value.state.userState.wallet).toBe(103);
    expect(value.state.userState.statXP).toEqual({
      STR: 23,
      VIT: 20,
      INT: 20,
      DISC: 20,
      SOC: 20,
    });
    expect(value.state.completions).toEqual([value.completion]);
    expect(value.completion).toMatchObject({
      id: 'id1',
      taskId: 't1',
      taskName: 'Push up',
      stat: 'STR',
      variantTier: null,
      pointsAwarded: 3,
      localDate: '2026-10-10',
    });
    expect(value.completion.completedAt).toContain('T');
    expect(value.state.dailyQuestLog[0]?.actualCompletions.STR).toBe(1);
    expect(value.state.dailyQuestLog[0]?.netPointsChange).toBe(3);
    expect(value.state.userState.totalCompletions).toBe(1);
    expect(value.events).toEqual([]);
  });

  it('records the matching tier for a multi-variant task', () => {
    const variants = task({
      variants: [
        { tier: 'ringan', description: '5 reps', points: 5 },
        { tier: 'berat', description: '20 reps', points: 20 },
      ],
    });

    const value = expectOk(
      completeTask(
        makeState({ tasks: [variants] }),
        { taskId: 't1', variantTier: 'berat' },
        now,
        ids()
      )
    );

    expect(value.completion.variantTier).toBe('berat');
    expect(value.completion.pointsAwarded).toBe(8);
  });

  it('accepts a second completion on a penalized row and refuses a third', () => {
    const penalized = openDay({ requiredCompletions: counts({ STR: 2 }) });
    const first = expectOk(
      completeTask(
        makeState({ dailyQuestLog: [penalized] }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(first.state.dailyQuestLog[0]?.actualCompletions.STR).toBe(1);

    const second = expectOk(
      completeTask(first.state, { taskId: 't1', variantTier: null }, now, ids())
    );

    expect(second.state.dailyQuestLog[0]?.actualCompletions.STR).toBe(2);
    expect(second.state.userState.lifetimeXP).toBe(106);

    expect(
      completeTask(second.state, { taskId: 't1', variantTier: null }, now, ids())
    ).toEqual({ ok: false, error: 'ROW_LIMIT_REACHED' });
  });

  it('refuses a second completion when the requirement is normal', () => {
    const first = expectOk(
      completeTask(makeState(), { taskId: 't1', variantTier: null }, now, ids())
    );

    expect(
      completeTask(first.state, { taskId: 't1', variantTier: null }, now, ids())
    ).toEqual({ ok: false, error: 'ROW_LIMIT_REACHED' });
  });

  it('emits one levelUp event crossing 126 XP', () => {
    const big = task({ variants: [{ tier: 'berat', description: '15 reps', points: 15 }] });

    const value = expectOk(
      completeTask(
        makeState({ tasks: [big], userState: { lifetimeXP: 120 } }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.state.userState.lifetimeXP).toBe(128);
    expect(value.events).toEqual([
      {
        id: 'id2',
        type: 'levelUp',
        localDate: '2026-10-10',
        from: 3,
        to: 4,
        seen: false,
      },
    ]);
    expect(value.state.milestoneEvents).toEqual(value.events);
  });

  it('emits one levelUp event even when several levels are crossed', () => {
    const huge = task({ variants: [{ tier: 'berat', description: 'huge', points: 50000 }] });

    const value = expectOk(
      completeTask(
        makeState({
          tasks: [huge],
          userState: {
            lifetimeXP: 35000,
            rank: 'S',
            statXP: { STR: 1000, VIT: 1000, INT: 1000, DISC: 1000, SOC: 1000 },
          },
        }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.events).toHaveLength(1);
    expect(value.events[0]).toMatchObject({ type: 'levelUp', from: 51, to: 85 });
  });

  it('emits a rankUp event when the gate passes', () => {
    const big = task({ variants: [{ tier: 'berat', description: '15 reps', points: 15 }] });

    const value = expectOk(
      completeTask(
        makeState({
          tasks: [big],
          userState: {
            lifetimeXP: 349,
            statXP: { STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 100 },
          },
        }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.state.userState.rank).toBe('D');
    expect(value.events).toEqual([
      {
        id: 'id2',
        type: 'levelUp',
        localDate: '2026-10-10',
        from: 5,
        to: 6,
        seen: false,
      },
      {
        id: 'id3',
        type: 'rankUp',
        localDate: '2026-10-10',
        from: 'E',
        to: 'D',
        seen: false,
      },
    ]);
  });

  it('holds the rank and emits no rankUp event when the gate blocks', () => {
    const big = task({ variants: [{ tier: 'berat', description: '15 reps', points: 15 }] });

    const value = expectOk(
      completeTask(
        makeState({
          tasks: [big],
          userState: {
            lifetimeXP: 349,
            statXP: { STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 10 },
          },
        }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.state.userState.rank).toBe('E');
    expect(value.events.map((event) => event.type)).toEqual(['levelUp']);
  });

  it('unlocks completions-100 on the hundredth completion', () => {
    const value = expectOk(
      completeTask(
        makeState({ userState: { totalCompletions: 99 } }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.state.userState.totalCompletions).toBe(100);
    expect(value.state.userState.unlockedTitles).toContain('completions-100');
  });

  it('stores a title unlocked through the displayed streak of the open day', () => {
    const day = openDay({
      requiredCompletions: counts({ STR: 2 }),
      actualCompletions: counts({ STR: 1 }),
    });

    const value = expectOk(
      completeTask(
        makeState({ dailyQuestLog: [day], userState: { currentStreak: 6 } }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.state.userState.unlockedTitles).toContain('streak-7');
  });

  it('awards the capped value for a variant above the cap', () => {
    const overCap = task({
      variants: [{ tier: 'berat', description: '100 reps', points: 100 }],
    });

    const value = expectOk(
      completeTask(
        makeState({ tasks: [overCap] }),
        { taskId: 't1', variantTier: null },
        now,
        ids()
      )
    );

    expect(value.completion.pointsAwarded).toBe(8);
    expect(value.state.userState.lifetimeXP).toBe(108);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const snapshot = structuredClone(state);

    completeTask(state, { taskId: 't1', variantTier: null }, now, ids());

    expect(state).toEqual(snapshot);
  });
});
