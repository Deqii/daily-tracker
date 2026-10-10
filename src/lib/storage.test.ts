import { describe, expect, it } from 'vitest';
import { weekStart } from './date';
import { createDefaultUserState } from './storage';

describe('createDefaultUserState defaults', () => {
  it('matches the PRD v2 shape', () => {
    const state = createDefaultUserState('2028-02-29');

    expect(state.rank).toBe('E');
    expect(state.freezesUsedThisWeek).toBe(0);
    expect(state.totalCompletions).toBe(0);
    expect(state.totalPurchases).toBe(0);
    expect(state.equippedTitle).toBeNull();
    expect(state.unlockedTitles).toEqual([]);
    expect(state.penaltyStats).toEqual([]);
    expect(state.statXP).toEqual({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });
  });

  it('lastFreezeWeekReset is a Monday for several today values', () => {
    const cases = ['2028-02-29', '2028-03-01', '2029-01-01', '2024-06-12'];

    for (const today of cases) {
      const state = createDefaultUserState(today);
      expect(state.lastFreezeWeekReset).toBe(weekStart(today));
    }
  });

  it('lastRolloverDate equals today', () => {
    const today = '2028-06-30';
    const state = createDefaultUserState(today);

    expect(state.lastRolloverDate).toBe(today);
  });
});