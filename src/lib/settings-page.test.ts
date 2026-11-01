import { describe, expect, it } from 'vitest';
import { getRankConfig, RANK_CONFIGS } from '../engine/rank';
import { TITLES } from '../engine/titles';
import {
  SETTINGS_TITLE_ORDER,
  backupStatus,
  balanceGateView,
  nextRankProgress,
  settingsRankRows,
  settingsTitleCards,
} from './settings-page';
import { rankMultiplier } from './rank-reference';
import { createDefaultUserState } from './storage';
import { STATS, type Rank } from './types';

const STAT_XP = { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 };

function fixtureState() {
  const state = createDefaultUserState('2026-10-15');

  state.lifetimeXP = 65;
  state.wallet = 65;
  state.statXP = STAT_XP;
  state.rank = 'E';
  state.currentStreak = 5;
  state.equippedTitle = 'first-reward';
  state.unlockedTitles = ['first-reward'];
  state.totalCompletions = 47;
  state.totalPurchases = 1;

  return state;
}

describe('settingsRankRows', () => {
  it("equals the engine's rank table at every rank", () => {
    for (const config of RANK_CONFIGS) {
      const rows = settingsRankRows(config.rank);

      expect(rows.map((row) => row.rank)).toEqual(RANK_CONFIGS.map((entry) => entry.rank));

      for (const row of rows) {
        const engine = getRankConfig(row.rank);

        expect(row.freezesPerWeek).toBe(engine.freezesPerWeek);
        expect(row.penalty).toBe(engine.penalty);
        expect(row.multiplier).toBe(rankMultiplier(engine.xpMultiplier));
        expect(row.maxPointsPerTask).toBe(
          engine.maxPointsPerTask === null ? 'No cap' : String(engine.maxPointsPerTask)
        );
      }
    }
  });

  it('marks exactly one current rank and the next one when it exists', () => {
    const rows = settingsRankRows('C');

    expect(rows.filter((row) => row.current).map((row) => row.rank)).toEqual(['C']);
    expect(rows.filter((row) => row.next).map((row) => row.rank)).toEqual(['B']);
    expect(settingsRankRows('S').filter((row) => row.next)).toEqual([]);
  });

  it('assigns each row its rank accent', () => {
    expect(settingsRankRows('E')[0]?.accent).toBe('--rk-e');
    expect(settingsRankRows('E')[5]?.accent).toBe('--rk-s');
  });
});

describe('nextRankProgress', () => {
  it('reads the next rank minimum level and the engine XP curve', () => {
    const progress = nextRankProgress(fixtureState());

    expect(progress).toEqual({
      nextRank: 'D',
      targetLevel: 6,
      currentXP: 65,
      requiredXP: 350,
      remainingXP: 285,
      ratio: 65 / 350,
    });
  });

  it('has no next rank at S', () => {
    const state = { ...fixtureState(), rank: 'S' as const, lifetimeXP: 100_000 };
    const progress = nextRankProgress(state);

    expect(progress.nextRank).toBeNull();
    expect(progress.ratio).toBe(1);
  });
});

describe('balanceGateView', () => {
  it('reads the engine gate and renders the five stats with a derived scale', () => {
    const gate = balanceGateView(STAT_XP);

    expect(gate.passes).toBe(true);
    expect(gate.weakest).toBe('SOC');
    expect(gate.weakestLabel).toBe('Soc');
    expect(gate.weakestValue).toBe(7);
    expect(gate.threshold).toBe(7);
    expect(gate.scale).toBe(20);
    expect(gate.thresholdRatio).toBe(7 / 20);
    expect(gate.rows.map((row) => row.value)).toEqual([16, 12, 20, 10, 7]);
    expect(gate.text).toBe(
      'Weakest stat Soc 7 ≥ threshold 7 (50% of the average). Thin margin: raise Soc to be safe.'
    );
  });

  it('reads a failing gate from the engine too', () => {
    const gate = balanceGateView({ STR: 30, VIT: 2, INT: 2, DISC: 2, SOC: 2 });

    expect(gate.passes).toBe(false);
    expect(gate.text).toContain('< threshold');
    expect(gate.text).toContain('Raise the weakest stat before ranking up.');
  });

  it('handles fewer than two tracked stats without inventing a weakest stat', () => {
    const gate = balanceGateView({ STR: 10, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

    expect(gate.passes).toBe(true);
    expect(gate.weakest).toBeNull();
    expect(gate.rows).toHaveLength(STATS.length);
  });
});

describe('settingsTitleCards', () => {
  it("uses the prototype's title order and the engine catalog's names", () => {
    const cards = settingsTitleCards(fixtureState(), 5);

    expect(cards.map((card) => card.id)).toEqual(SETTINGS_TITLE_ORDER);
    expect(cards.map((card) => card.name)).toEqual(
      SETTINGS_TITLE_ORDER.map((id) => TITLES.find((title) => title.id === id)?.name)
    );
  });

  it('shows the fixture progress from engine state', () => {
    const cards = settingsTitleCards(fixtureState(), 5);
    const byId = new Map(cards.map((card) => [card.id, card]));

    expect(byId.get('first-reward')).toMatchObject({
      unlocked: true,
      equipped: true,
      progress: { current: 1, max: 1 },
    });
    expect(byId.get('streak-7')?.progress).toEqual({ current: 5, max: 7, ratio: 5 / 7 });
    expect(byId.get('completions-100')?.progress.current).toBe(47);
    expect(byId.get('rank-d')?.progress).toEqual({ current: 3, max: 6, ratio: 0.5 });
  });

  it("matches each streak and completion target to the engine's unlock condition", () => {
    for (const id of ['streak-7', 'streak-30', 'completions-100'] as const) {
      const cards = settingsTitleCards(fixtureState(), 0);
      const card = cards.find((entry) => entry.id === id);
      const title = TITLES.find((entry) => entry.id === id);

      if (card === undefined || title === undefined) throw new Error(`missing ${id}`);

      const below = { ...fixtureState() };

      if (id === 'streak-7') {
        expect(title.condition({ userState: below, displayedStreak: 7 })).toBe(true);
        expect(title.condition({ userState: below, displayedStreak: 6 })).toBe(false);
      } else if (id === 'streak-30') {
        expect(title.condition({ userState: below, displayedStreak: 30 })).toBe(true);
        expect(title.condition({ userState: below, displayedStreak: 29 })).toBe(false);
      } else {
        expect(
          title.condition({
            userState: { ...below, totalCompletions: 100 },
            displayedStreak: 0,
          })
        ).toBe(true);
        expect(
          title.condition({
            userState: { ...below, totalCompletions: 99 },
            displayedStreak: 0,
          })
        ).toBe(false);
      }
    }
  });

  it('progresses rank titles to the engine minimum level', () => {
    const cards = settingsTitleCards(fixtureState(), 5);

    for (const id of ['rank-d', 'rank-c', 'rank-b', 'rank-a', 'rank-s'] as const) {
      const card = cards.find((entry) => entry.id === id);
      const rank = id.slice(5).toUpperCase();

      expect(card?.progress.max).toBe(getRankConfig(rank as Rank).minLevel);
    }
  });
});

describe('backupStatus', () => {
  it('reads the fixture backup as nine days old', () => {
    const status = backupStatus(
      Date.parse('2026-10-15T09:00:00+07:00'),
      '2026-10-06T09:00:00+07:00'
    );

    expect(status).toEqual({
      days: 9,
      old: true,
      ok: false,
      title: 'Last backup: 9 days ago',
      detail: 'Back up at least once a week so you do not lose progress.',
    });
  });

  it('treats a backup under a day old as just now', () => {
    const status = backupStatus(
      Date.parse('2026-10-15T09:00:00+07:00'),
      '2026-10-15T08:00:00+07:00'
    );

    expect(status.title).toBe('Last backup: just now');
    expect(status.ok).toBe(true);
  });

  it('treats a missing or corrupt timestamp as never', () => {
    expect(backupStatus(0, null).title).toBe('Last backup: never');
    expect(backupStatus(0, 'not-a-date').title).toBe('Last backup: never');
  });
});
