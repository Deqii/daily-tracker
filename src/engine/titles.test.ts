import { describe, expect, it } from 'vitest';
import type { UserState } from '../lib/types';
import { equipTitle, evaluateTitles } from './titles';

const baseUserState = (overrides: Partial<UserState> = {}): UserState => ({
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

describe('evaluateTitles', () => {
  it('unlocks streak-7 at a 7-day streak and not at 6, and streak-30 at 30 and not at 29', () => {
    expect(evaluateTitles({ userState: baseUserState(), displayedStreak: 6 })).toEqual([]);
    expect(evaluateTitles({ userState: baseUserState(), displayedStreak: 7 })).toEqual([
      'streak-7',
    ]);
    expect(
      evaluateTitles({
        userState: baseUserState({ unlockedTitles: ['streak-7'] }),
        displayedStreak: 29,
      })
    ).toEqual([]);
    expect(evaluateTitles({ userState: baseUserState(), displayedStreak: 29 })).toEqual([
      'streak-7',
    ]);
    expect(evaluateTitles({ userState: baseUserState(), displayedStreak: 30 })).toEqual([
      'streak-7',
      'streak-30',
    ]);
  });

  it('unlocks completions-100 at 100 completions and not at 99', () => {
    expect(
      evaluateTitles({ userState: baseUserState({ totalCompletions: 99 }), displayedStreak: 0 })
    ).toEqual([]);
    expect(
      evaluateTitles({ userState: baseUserState({ totalCompletions: 100 }), displayedStreak: 0 })
    ).toEqual(['completions-100']);
  });

  it('unlocks first-reward on the first purchase', () => {
    expect(evaluateTitles({ userState: baseUserState(), displayedStreak: 0 })).toEqual([]);
    expect(
      evaluateTitles({ userState: baseUserState({ totalPurchases: 1 }), displayedStreak: 0 })
    ).toEqual(['first-reward']);
  });

  it('unlocks each rank title at its boundary rank, including the ones already passed', () => {
    expect(evaluateTitles({ userState: baseUserState({ rank: 'D' }), displayedStreak: 0 })).toEqual(
      ['rank-d']
    );
    expect(evaluateTitles({ userState: baseUserState({ rank: 'C' }), displayedStreak: 0 })).toEqual(
      ['rank-d', 'rank-c']
    );
    expect(evaluateTitles({ userState: baseUserState({ rank: 'B' }), displayedStreak: 0 })).toEqual(
      ['rank-d', 'rank-c', 'rank-b']
    );
    expect(evaluateTitles({ userState: baseUserState({ rank: 'A' }), displayedStreak: 0 })).toEqual(
      ['rank-d', 'rank-c', 'rank-b', 'rank-a']
    );
    expect(evaluateTitles({ userState: baseUserState({ rank: 'S' }), displayedStreak: 0 })).toEqual(
      ['rank-d', 'rank-c', 'rank-b', 'rank-a', 'rank-s']
    );
  });

  it('returns no duplicates on repeated calls, and nothing once the ids are unlocked', () => {
    const input = {
      userState: baseUserState({ rank: 'D', totalCompletions: 100, totalPurchases: 1 }),
      displayedStreak: 7,
    };
    const first = evaluateTitles(input);

    expect(first).toEqual(['streak-7', 'first-reward', 'rank-d', 'completions-100']);
    expect(evaluateTitles(input)).toEqual(first);
    expect(new Set(first).size).toBe(first.length);

    const withAppended = evaluateTitles({
      userState: baseUserState({
        rank: 'D',
        totalCompletions: 100,
        totalPurchases: 1,
        unlockedTitles: first,
      }),
      displayedStreak: 7,
    });

    expect(withAppended).toEqual([]);
  });

  it('unlocks a rank-* title only on the first time its rank is reached', () => {
    const firstTime = evaluateTitles({
      userState: baseUserState({ rank: 'D' }),
      displayedStreak: 0,
    });

    expect(firstTime).toEqual(['rank-d']);

    const afterDrop = evaluateTitles({
      userState: baseUserState({ rank: 'E', unlockedTitles: firstTime }),
      displayedStreak: 0,
    });
    const afterReClimbToD = evaluateTitles({
      userState: baseUserState({ rank: 'D', unlockedTitles: firstTime }),
      displayedStreak: 0,
    });
    const afterReClimbToC = evaluateTitles({
      userState: baseUserState({ rank: 'C', unlockedTitles: firstTime }),
      displayedStreak: 0,
    });

    expect(afterDrop).toEqual([]);
    expect(afterReClimbToD).toEqual([]);
    expect(afterReClimbToC).toEqual(['rank-c']);
  });
});

describe('equipTitle', () => {
  it('equips an unlocked title without mutating the input', () => {
    const state = baseUserState({ unlockedTitles: ['streak-7'] });
    const result = equipTitle(state, 'streak-7');

    expect(result).toEqual({
      ok: true,
      value: baseUserState({ unlockedTitles: ['streak-7'], equippedTitle: 'streak-7' }),
    });
    expect(state.equippedTitle).toBeNull();
  });

  it('unequips with null even when nothing is equipped', () => {
    const result = equipTitle(baseUserState(), null);

    if (!result.ok) {
      throw new Error('Expected a successful unequip');
    }

    expect(result.value.equippedTitle).toBeNull();
  });

  it('rejects an id that is not unlocked', () => {
    expect(equipTitle(baseUserState(), 'streak-7')).toEqual({
      ok: false,
      error: 'TITLE_NOT_UNLOCKED',
    });
  });
});
