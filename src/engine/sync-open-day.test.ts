import { describe, expect, it } from 'vitest';
import type { Completion, DailyQuestDay, LocalDate, Stat, Task, UserState } from '../lib/types';
import { STATS } from '../lib/types';
import { selectDailyTasks } from './daily';
import type { AppState } from './state';
import { syncOpenDay } from './sync-open-day';

const TODAY: LocalDate = '2026-10-15';

const task = (id: string, stat: Stat, isAnchor: boolean): Task => ({
  id,
  familyName: `Task ${id}`,
  stat,
  isAnchor,
  variants: [{ tier: 'easy', description: 'A short effort', points: 5 }],
  createdAt: '2026-10-01T08:00:00+07:00',
});

const anchor = (id: string, stat: Stat): Task => task(id, stat, true);
const rotating = (id: string, stat: Stat): Task => task(id, stat, false);

const counts = (overrides: Partial<Record<Stat, number>> = {}): Record<Stat, number> => ({
  STR: 0,
  VIT: 0,
  INT: 0,
  DISC: 0,
  SOC: 0,
  ...overrides,
});

const completion = (taskId: string, stat: Stat): Completion => ({
  id: `c-${taskId}`,
  taskId,
  taskName: `Task ${taskId}`,
  stat,
  variantTier: null,
  pointsAwarded: 3,
  completedAt: '2026-10-15T09:00:00+07:00',
  localDate: TODAY,
});

const userState = (overrides: Partial<UserState> = {}): UserState => ({
  lifetimeXP: 100,
  wallet: 100,
  statXP: { STR: 20, VIT: 20, INT: 20, DISC: 20, SOC: 20 },
  rank: 'E',
  currentStreak: 0,
  freezesUsedThisWeek: 0,
  lastFreezeWeekReset: '2026-10-12',
  penaltyStats: [],
  equippedTitle: null,
  unlockedTitles: [],
  totalCompletions: 0,
  totalPurchases: 0,
  lastRolloverDate: TODAY,
  ...overrides,
});

const openDay = (overrides: Partial<DailyQuestDay> = {}): DailyQuestDay => ({
  date: TODAY,
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

interface StateOptions {
  tasks?: Task[];
  dailyQuestLog?: DailyQuestDay[];
  completions?: Completion[];
  userState?: Partial<UserState>;
}

const makeState = (options: StateOptions = {}): AppState => ({
  tasks: options.tasks ?? [],
  completions: options.completions ?? [],
  dailyQuestLog: options.dailyQuestLog ?? [openDay()],
  rewards: [],
  rewardPurchases: [],
  userState: userState(options.userState),
  milestoneEvents: [],
});

describe('syncOpenDay', () => {
  it('opens a first-run empty day into the current task library', () => {
    const tasks = [anchor('aSTR', 'STR'), rotating('rVIT', 'VIT')];
    const next = syncOpenDay(makeState({ tasks }), TODAY);

    expect(next.dailyQuestLog[0]).toEqual(
      openDay({
        selectedTaskIdPerStat: { VIT: 'rVIT' },
        requiredCompletions: counts({ STR: 1, VIT: 1 }),
      })
    );
  });

  it('keeps a valid rotating pick when another rotating task is added', () => {
    const tasks = [rotating('r1', 'STR'), rotating('r2', 'STR'), rotating('r3', 'STR')];
    const day = openDay({
      selectedTaskIdPerStat: { STR: 'r1' },
      requiredCompletions: counts({ STR: 1 }),
    });
    const next = syncOpenDay(makeState({ tasks, dailyQuestLog: [day] }), TODAY);

    expect(next.dailyQuestLog[0]?.selectedTaskIdPerStat).toEqual({ STR: 'r1' });
    expect(next.dailyQuestLog[0]?.requiredCompletions).toEqual(counts({ STR: 1 }));
  });

  it('fills a rotating pick for an active stat that had only anchors', () => {
    const tasks = [anchor('aSTR', 'STR'), rotating('rSTR', 'STR')];
    const day = openDay({ requiredCompletions: counts({ STR: 1 }) });
    const next = syncOpenDay(makeState({ tasks, dailyQuestLog: [day] }), TODAY);

    expect(next.dailyQuestLog[0]?.selectedTaskIdPerStat).toEqual({ STR: 'rSTR' });
  });

  it('replaces a pick whose task was deleted with the seeded rule', () => {
    const tasks = [rotating('r1', 'STR'), rotating('r2', 'STR')];
    const day = openDay({
      selectedTaskIdPerStat: { STR: 'gone' },
      requiredCompletions: counts({ STR: 1 }),
    });
    const next = syncOpenDay(makeState({ tasks, dailyQuestLog: [day] }), TODAY);

    expect(next.dailyQuestLog[0]?.selectedTaskIdPerStat.STR).toBe(
      selectDailyTasks(tasks, TODAY).STR
    );
  });

  it('replaces a pick whose task became an anchor', () => {
    const tasks = [anchor('r1', 'STR'), rotating('r2', 'STR')];
    const day = openDay({
      selectedTaskIdPerStat: { STR: 'r1' },
      requiredCompletions: counts({ STR: 1 }),
    });
    const next = syncOpenDay(makeState({ tasks, dailyQuestLog: [day] }), TODAY);

    expect(next.dailyQuestLog[0]?.selectedTaskIdPerStat.STR).toBe(
      selectDailyTasks(tasks, TODAY).STR
    );
  });

  it('drops an inactive stat to 0 and keeps actual completions and the completion log', () => {
    const logged = completion('gone', 'VIT');
    const day = openDay({
      selectedTaskIdPerStat: { VIT: 'gone' },
      requiredCompletions: counts({ VIT: 2 }),
      actualCompletions: counts({ VIT: 1 }),
      netPointsChange: 12,
    });
    const next = syncOpenDay(
      makeState({ tasks: [], dailyQuestLog: [day], completions: [logged] }),
      TODAY
    );

    expect(next.dailyQuestLog[0]).toMatchObject({
      selectedTaskIdPerStat: {},
      requiredCompletions: counts(),
      actualCompletions: counts({ VIT: 1 }),
      netPointsChange: 12,
    });
    expect(next.completions).toEqual([logged]);
  });

  it('keeps actual completions when an inactive stat regains a task the same day', () => {
    const taskBack = anchor('aSTR', 'STR');
    const day = openDay({
      selectedTaskIdPerStat: { STR: 'aSTR' },
      requiredCompletions: counts({ STR: 2 }),
      actualCompletions: counts({ STR: 1 }),
    });
    const state = makeState({
      tasks: [taskBack],
      dailyQuestLog: [day],
      userState: { penaltyStats: ['STR'] },
    });
    const lost = syncOpenDay({ ...state, tasks: [] }, TODAY);
    const regained = syncOpenDay({ ...lost, tasks: [taskBack] }, TODAY);

    expect(lost.dailyQuestLog[0]?.requiredCompletions.STR).toBe(0);
    expect(regained.dailyQuestLog[0]?.requiredCompletions.STR).toBe(2);
    expect(regained.dailyQuestLog[0]?.actualCompletions.STR).toBe(1);
  });

  it('leaves a penalized inactive stat at 0 and keeps its flag', () => {
    const day = openDay({
      selectedTaskIdPerStat: { VIT: 'gone' },
      requiredCompletions: counts({ VIT: 2 }),
      actualCompletions: counts({ VIT: 1 }),
    });
    const state = makeState({
      tasks: [],
      dailyQuestLog: [day],
      userState: { penaltyStats: ['VIT'] },
    });
    const next = syncOpenDay(state, TODAY);

    expect(next.dailyQuestLog[0]?.requiredCompletions.VIT).toBe(0);
    expect(next.userState.penaltyStats).toEqual(['VIT']);
  });

  it('requires 2 for a stat that becomes active while penalized', () => {
    const tasks = [rotating('rINT', 'INT')];
    const state = makeState({ tasks, userState: { penaltyStats: ['INT'] } });
    const next = syncOpenDay(state, TODAY);

    expect(next.dailyQuestLog[0]?.requiredCompletions).toEqual(counts({ INT: 2 }));
    expect(next.dailyQuestLog[0]?.selectedTaskIdPerStat).toEqual({ INT: 'rINT' });
  });

  it('requires 1 for a new unpenalized stat and keeps existing penalized stats at 2', () => {
    const tasks = [anchor('aSTR', 'STR'), rotating('rINT', 'INT')];
    const state = makeState({ tasks, userState: { penaltyStats: ['STR'] } });
    const next = syncOpenDay(state, TODAY);

    expect(next.dailyQuestLog[0]?.requiredCompletions).toEqual(counts({ STR: 2, INT: 1 }));
    expect(next.dailyQuestLog[0]?.selectedTaskIdPerStat).toEqual({ INT: 'rINT' });
  });

  it('does not increase a satisfied stat when a second anchor is added', () => {
    const day = openDay({
      requiredCompletions: counts({ STR: 1 }),
      actualCompletions: counts({ STR: 1 }),
      netPointsChange: 3,
    });
    const tasks = [anchor('a1', 'STR'), anchor('a2', 'STR')];
    const next = syncOpenDay(makeState({ tasks, dailyQuestLog: [day] }), TODAY);

    expect(next.dailyQuestLog[0]).toBe(day);
    expect(next.dailyQuestLog[0]?.requiredCompletions.STR).toBe(1);
    expect(next.dailyQuestLog[0]?.actualCompletions.STR).toBe(1);
  });

  it('keeps the open day unchanged when only variants change', () => {
    const original = anchor('aSTR', 'STR');
    const changed: Task = {
      ...original,
      variants: [
        { tier: 'easy', description: 'Easier', points: 4 },
        { tier: 'hard', description: 'Harder', points: 9 },
      ],
    };
    const day = openDay({ requiredCompletions: counts({ STR: 1 }) });
    const state = makeState({ tasks: [original], dailyQuestLog: [day] });
    const next = syncOpenDay({ ...state, tasks: [changed] }, TODAY);

    expect(next.dailyQuestLog).toBe(state.dailyQuestLog);
    expect(next.dailyQuestLog[0]).toBe(day);
  });

  it('moves a pick when a task changes stat and activates the new stat', () => {
    const r1 = rotating('r1', 'STR');
    const r2 = rotating('r2', 'STR');
    const v1 = rotating('v1', 'VIT');
    const moved: Task = { ...r1, stat: 'VIT' };
    const tasks = [moved, r2, v1];
    const day = openDay({
      selectedTaskIdPerStat: { STR: 'r1' },
      requiredCompletions: counts({ STR: 1 }),
      actualCompletions: counts({ STR: 1 }),
    });
    const next = syncOpenDay(makeState({ tasks, dailyQuestLog: [day] }), TODAY);
    const picks = selectDailyTasks(tasks, TODAY);

    expect(next.dailyQuestLog[0]?.selectedTaskIdPerStat).toEqual({
      STR: picks.STR,
      VIT: picks.VIT,
    });
    expect(next.dailyQuestLog[0]?.requiredCompletions).toEqual(counts({ STR: 1, VIT: 1 }));
    expect(next.dailyQuestLog[0]?.actualCompletions.STR).toBe(1);
  });

  it('does nothing when today is after the open day (midnight race)', () => {
    const day = openDay();
    const state = makeState({ tasks: [anchor('aSTR', 'STR')], dailyQuestLog: [day] });
    const next = syncOpenDay(state, '2026-10-16');

    expect(next).toBe(state);
    expect(next.dailyQuestLog[0]).toBe(day);
  });

  it('does nothing when there is no open day or the open day is closed', () => {
    const missing = makeState({ tasks: [anchor('aSTR', 'STR')], dailyQuestLog: [] });
    const closedDay = openDay({ closed: true });
    const closed = makeState({
      tasks: [anchor('aSTR', 'STR')],
      dailyQuestLog: [closedDay],
    });

    expect(syncOpenDay(missing, TODAY)).toBe(missing);
    expect(syncOpenDay(closed, TODAY)).toBe(closed);
  });

  it('does not release a closed day', () => {
    const closedDay = openDay({
      date: '2026-10-14',
      selectedTaskIdPerStat: { STR: 'old' },
      requiredCompletions: counts({ STR: 1 }),
      actualCompletions: counts({ STR: 1 }),
      netPointsChange: -5,
      closed: true,
      lifetimeXPEnd: 95,
      levelEnd: 3,
      rankEnd: 'E',
    });
    const state = makeState({
      tasks: [anchor('aSTR', 'STR')],
      dailyQuestLog: [closedDay, openDay()],
    });
    const next = syncOpenDay(state, TODAY);

    expect(next.dailyQuestLog[0]).toEqual(closedDay);
  });

  it('does not mutate the input state', () => {
    const state = makeState({
      tasks: [anchor('aSTR', 'STR'), rotating('rSTR', 'STR')],
      dailyQuestLog: [openDay()],
    });
    const snapshot = structuredClone(state);

    syncOpenDay(state, TODAY);

    expect(state).toEqual(snapshot);
  });

  it('always returns all five required stats', () => {
    const next = syncOpenDay(makeState({ tasks: [anchor('aSTR', 'STR')] }), TODAY);

    expect(Object.keys(next.dailyQuestLog[0]?.requiredCompletions ?? {}).sort()).toEqual(
      [...STATS].sort()
    );
  });
});
