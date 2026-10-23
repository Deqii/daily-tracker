import { describe, expect, it } from 'vitest';
import { closeDayStreak, displayStreak, type StreakState } from '../../engine/streak';
import { getRankConfig } from '../../engine/rank';
import { passesBalanceGate } from '../../engine/balance';
import { addDays, weekStart } from '../date';
import { STATS, type DailyQuestDay } from '../types';
import type { StorageSchema } from '../storage';
import { FIXTURES, FIXED_TODAY } from './data';
import rewardsSnapshot from './rewards-snapshot.json';
import todaySnapshot from './today-snapshot.json';
import todayStatesSnapshot from './today-states-snapshot.json';
import historyLong from './history-long-snapshot.json';
import historyOpen from './history-open-snapshot.json';

/**
 * Proof that the seeded fixtures reproduce the prototypes' demo data.
 *
 * The visual harness can only prove the UI is right if the data underneath it is
 * right, and a wrong fixture is invisible in a pixel diff: the app and the
 * prototype would simply disagree about a number. So this test asserts the
 * values directly, from the engine and the fixture only - no DOM, no browser, no
 * prototype.
 *
 * Everything asserted here is quoted from `docs/prototype/DEVIATIONS.md`:
 *   - note 1 and Q6: the Today heat strip and Streak 5 (four closed days plus
 *     today), the first red day consuming the previous week's only Rank E
 *     freeze, the second finding none left, and the current week's freeze
 *     unused so "Freeze 1 tersisa" holds.
 *   - Q7: fifteen Rewards purchases totalling 2.370, matching the counts on the
 *     cards.
 */

const today = FIXTURES.today.schema;
const rewards = FIXTURES.rewards.schema;

/** Every cell the prototype painted, oldest first, with `x` as `null`. */
const PROTOTYPE_HEAT_LEVELS = (todaySnapshot as unknown as { heatLevels: (number | null)[] })
  .heatLevels;

function closedDays(schema: StorageSchema): DailyQuestDay[] {
  return schema.dailyQuestLog.filter((d) => d.closed).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function openDay(schema: StorageSchema): DailyQuestDay {
  const day = schema.dailyQuestLog.find((d) => !d.closed);

  if (day === undefined) throw new Error('fixture has no open day');

  return day;
}

function satisfiedStats(day: DailyQuestDay): number {
  return STATS.reduce((sum, stat) => sum + day.actualCompletions[stat], 0);
}

/** `history.html`'s mapping: 5 -> 3, 4 -> 2, 3 -> 1, fewer -> the red cell. */
function heatLevel(day: DailyQuestDay): number | null {
  const n = satisfiedStats(day);

  if (n >= 5) return 3;
  if (n === 4) return 2;
  if (n === 3) return 1;

  return null;
}

/**
 * Replays the PRD §2.1 streak walk over the fixture's closed days.
 *
 * The walk starts in the week the seeded window opens in: everything before the
 * first closed day is outside the fixture, and the store never sees it. This
 * mirrors what `buildHeatDays` does, but derives the start week from the log
 * rather than importing it, so a disagreement is a failure and not a tautology.
 */
function replayStreak(schema: StorageSchema): StreakState {
  const days = closedDays(schema);
  const first = days[0];

  if (first === undefined) throw new Error('fixture has no closed days');

  let state: StreakState = {
    currentStreak: 0,
    freezesUsedThisWeek: 0,
    lastFreezeWeekReset: weekStart(first.date),
  };

  for (const day of days) {
    state = closeDayStreak(
      state,
      {
        date: day.date,
        completionCount: satisfiedStats(day),
        hasQuestStats: STATS.some((stat) => day.requiredCompletions[stat] > 0),
      },
      schema.userState.rank
    ).streakState;
  }

  return state;
}

describe('today fixture', () => {
  it('seeds one closed day per heat cell except today, which is the open day', () => {
    const days = closedDays(today);
    const first = days[0];

    expect(days).toHaveLength(PROTOTYPE_HEAT_LEVELS.length - 1);
    expect(first?.date).toBe(addDays(FIXED_TODAY, -(PROTOTYPE_HEAT_LEVELS.length - 1)));
    expect(days[days.length - 1]?.date).toBe(addDays(FIXED_TODAY, -1));
    expect(openDay(today).date).toBe(FIXED_TODAY);
  });

  it('reproduces the prototype heat strip exactly', () => {
    const days = closedDays(today);

    expect([...days.map(heatLevel), heatLevel(openDay(today))]).toEqual(PROTOTYPE_HEAT_LEVELS);
  });

  it('has the two red cells nine and five days before today', () => {
    const red = closedDays(today)
      .filter((d) => satisfiedStats(d) === 0)
      .map((d) => d.date);

    expect(red).toEqual([addDays(FIXED_TODAY, -9), addDays(FIXED_TODAY, -5)]);
  });

  it('keeps today at the three of five stats the prototype shows', () => {
    expect(satisfiedStats(openDay(today))).toBe(3);
  });

  it('displays a streak of 5 at the fixed clock', () => {
    const state = replayStreak(today);
    const shown = displayStreak(state.currentStreak, satisfiedStats(openDay(today)) > 0);

    expect(state.currentStreak).toBe(4);
    expect(shown).toBe(5);
    // The seeded state must already agree with the replay, or the store would
    // show something the days in the log cannot produce.
    expect(today.userState.currentStreak).toBe(state.currentStreak);
  });

  it('lights five week pips', () => {
    // One pip per day of the streak, today last, out of seven in a week. The
    // prototype's row is five on, today flagged, two off.
    const state = replayStreak(today);
    const on = Math.min(7, displayStreak(state.currentStreak, satisfiedStats(openDay(today)) > 0));
    const weekDays = 7;
    const pips = Array.from({ length: weekDays }, (_, i) => ({
      on: i < on,
      today: i === on - 1,
    }));

    expect(pips.filter((p) => p.on)).toHaveLength(5);
    expect(pips.filter((p) => p.today)).toHaveLength(1);
    expect(pips[4]).toEqual({ on: true, today: true });
    expect(pips.slice(5).every((p) => !p.on)).toBe(true);
  });

  it('leaves one freeze, consumed by the first red day and not the second', () => {
    const rankE = getRankConfig('E');
    const red = closedDays(today).filter((d) => satisfiedStats(d) === 0);
    const prevWeek = addDays(weekStart(FIXED_TODAY), -7);

    // Both red days are in the week before the current one.
    expect(red.map((d) => d.date)).toEqual([addDays(prevWeek, 1), addDays(prevWeek, 5)]);

    // The first consumed that week's single freeze, the second found none left.
    expect(rankE.freezesPerWeek).toBe(1);
    expect(red[0]?.freezeUsed).toBe(true);
    expect(red[1]?.freezeUsed).toBe(false);

    // The current week's freeze is unused.
    expect(today.userState.freezesUsedThisWeek).toBe(0);
    expect(today.userState.lastFreezeWeekReset).toBe(weekStart(FIXED_TODAY));
    expect(
      Math.max(
        0,
        getRankConfig(today.userState.rank).freezesPerWeek - today.userState.freezesUsedThisWeek
      )
    ).toBe(1);
  });
});

describe('rewards fixture', () => {
  const snapshot = rewardsSnapshot as unknown as {
    purchases: { title: string; cost: number }[];
  };

  it('logs exactly the fifteen purchases the prototype logs', () => {
    expect(rewards.rewardPurchases).toHaveLength(15);
    expect(rewards.rewardPurchases.map((p) => `${p.rewardTitle}@${p.costAtPurchase}`)).toEqual(
      snapshot.purchases.map((p) => `${p.title}@${p.cost}`)
    );
  });

  it('buys each reward as many times as its card says', () => {
    const counts = new Map<string, number>();

    for (const purchase of rewards.rewardPurchases) {
      counts.set(purchase.rewardTitle, (counts.get(purchase.rewardTitle) ?? 0) + 1);
    }

    expect(Object.fromEntries(counts)).toEqual({
      'Main game 2 jam': 4,
      'Kopi susu santai': 8,
      'Jajan favorit': 1,
      'Nonton bioskop': 2,
    });

    // "Beli buku baru" is in the catalog with a count of zero.
    expect(rewards.rewards.find((r) => r.title === 'Beli buku baru')).toBeDefined();
    expect(counts.get('Beli buku baru') ?? 0).toBe(0);
  });

  it('spends 2370 in total', () => {
    const total = rewards.rewardPurchases.reduce((sum, p) => sum + p.costAtPurchase, 0);

    expect(total).toBe(2370);
  });

  it('derives purchase timestamps from the prototype labels at the fixed clock', () => {
    // "Kemarin" is one day back, "N hari lalu" is N days back, and the newest
    // purchase is therefore the day before the fixed clock.
    expect(rewards.rewardPurchases[0]?.localDate).toBe(addDays(FIXED_TODAY, -1));
    expect(rewards.rewardPurchases.every((p) => p.purchasedAt.startsWith(p.localDate))).toBe(true);
  });
});

describe('today state fixtures', () => {
  const states = FIXTURES.today.states ?? {};
  const dumps = (todayStatesSnapshot as unknown as { states: Record<string, unknown> }).states;
  const snapshot = (name: string) =>
    dumps[name] as unknown as {
      freezes: number;
      xp: number;
      stats: Record<string, number>;
      quests: { tiers: { name: string; description: string; nominal: number }[] | null }[];
    };

  it('seeds every representable state and omits the two-freeze state', () => {
    expect(Object.keys(states).sort()).toEqual([
      'blocked',
      'empty',
      'freeze0',
      'levelup',
      'notitle',
      'rankdown',
      'rankup',
      'recovery',
      'storage',
      'tiers',
    ]);
    expect(states.freeze2).toBeUndefined();
  });

  it('builds the tier picker from the dumped variants', () => {
    const tiers = snapshot('tiers').quests.find((q) => q.tiers !== null)?.tiers ?? [];
    const task = states.tiers?.schema.tasks.find((t) => t.id === 't-int');

    expect(task?.familyName).toBe('Belajar coding');
    expect(task?.variants.map((v) => [v.tier, v.description, v.points])).toEqual(
      tiers.map((t, i) => [['easy', 'medium', 'hard'][i], t.description, t.nominal])
    );
  });

  it('derives no freezes left from the rank config', () => {
    const freeze0 = states.freeze0?.schema.userState;

    expect(freeze0).toBeDefined();
    expect(snapshot('freeze0').freezes).toBe(0);
    expect(getRankConfig('E').freezesPerWeek - (freeze0?.freezesUsedThisWeek ?? 0)).toBe(0);
  });

  it('builds the blocked state from the dumped level and stats', () => {
    const user = states.blocked?.schema.userState;

    expect(user?.lifetimeXP).toBe(snapshot('blocked').xp);
    expect(user?.statXP).toEqual(snapshot('blocked').stats);
    const gate = passesBalanceGate(user?.statXP ?? { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

    expect(gate.passes).toBe(false);
    expect(gate.weakest).toBe('SOC');
    expect(gate.threshold).toBe(36);
  });

  it('omits the title chip and the tasks in their states', () => {
    expect(states.notitle?.schema.userState.equippedTitle).toBeNull();
    expect(states.empty?.schema.tasks).toHaveLength(0);
  });

  it('seeds unseen milestone events for the overlays and notice', () => {
    expect(states.levelup?.schema.milestoneEvents[0]).toMatchObject({
      type: 'levelUp',
      from: 3,
      to: 4,
      seen: false,
    });
    expect(states.rankup?.schema.milestoneEvents[0]).toMatchObject({
      type: 'rankUp',
      to: 'D',
      seen: false,
    });
    expect(states.rankdown?.schema.milestoneEvents[0]).toMatchObject({
      type: 'rankDown',
      to: 'E',
      seen: false,
    });
  });

  it('uses the app post-seed paths for storage failure and recovery', () => {
    expect(states.storage?.post).toBe('storage-failure');
    expect(states.recovery?.post).toBe('recovery');
  });
});

describe('history state snapshots', () => {
  const long = historyLong as unknown as { days: { freeze: boolean; open: boolean }[] };
  const open = historyOpen as unknown as { days: { mask: string; open: boolean }[] };

  it('dumps 150 days for the long history range', () => {
    expect(long.days).toHaveLength(150);
  });

  it('marks the last three-of-five day as open', () => {
    const last = open.days[open.days.length - 1];

    expect(last?.open).toBe(true);
    expect(last?.mask).toBe('11010');
    expect(open.days.filter((d) => d.open)).toHaveLength(1);
  });

  it('carries the freeze flag on every dumped day', () => {
    expect(long.days.every((d) => typeof d.freeze === 'boolean')).toBe(true);
  });
});
