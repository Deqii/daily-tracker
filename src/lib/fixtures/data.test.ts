import { describe, expect, it } from 'vitest';
import { closeDayStreak, displayStreak, type StreakState } from '../../engine/streak';
import { getRankConfig } from '../../engine/rank';
import { addDays, weekStart } from '../date';
import { STATS, type DailyQuestDay } from '../types';
import type { StorageSchema } from '../storage';
import { FIXTURES, FIXED_TODAY } from './data';
import rewardsSnapshot from './rewards-snapshot.json';
import todaySnapshot from './today-snapshot.json';

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
