import { describe, expect, it } from 'vitest';
import type { Rank, Stat } from '../lib/types';
import { RANKS, STATS } from '../lib/types';
import { applyPenalty, buildRequired, evaluateDay, nextPenaltyStats } from './evaluation';

const PENALTY_BY_RANK: Record<Rank, number> = { E: 5, D: 8, C: 13, B: 20, A: 30, S: 45 };

const record = (entries: Partial<Record<Stat, number>>): Record<Stat, number> => {
  const result = {} as Record<Stat, number>;

  for (const stat of STATS) {
    result[stat] = entries[stat] ?? 0;
  }

  return result;
};

describe('buildRequired', () => {
  it('gives 0 to every stat when none is quest-active', () => {
    expect(buildRequired([], [])).toEqual(record({}));
  });

  it('gives 1 to every quest-active stat and 0 to the rest', () => {
    expect(buildRequired(['STR', 'SOC'], [])).toEqual(record({ STR: 1, SOC: 1 }));
  });

  it('raises a penalized quest-active stat to 2 and keeps the others at 1', () => {
    expect(buildRequired(['STR', 'VIT'], ['STR'])).toEqual(record({ STR: 2, VIT: 1 }));
  });

  it('gives 0 to a penalized stat that is no longer quest-active', () => {
    expect(buildRequired(['VIT'], ['STR'])).toEqual(record({ VIT: 1 }));
  });

  it('does not depend on the order of the inputs', () => {
    expect(buildRequired(['SOC', 'STR', 'VIT'], ['VIT'])).toEqual(
      buildRequired(['STR', 'VIT', 'SOC'], ['VIT'])
    );
  });

  it('always returns all five stats', () => {
    expect(Object.keys(buildRequired(['STR'], [])).sort()).toEqual([...STATS].sort());
  });
});

describe('evaluateDay', () => {
  it('marks a normal miss', () => {
    const result = evaluateDay(record({ STR: 1, VIT: 1 }), record({ STR: 1, VIT: 0 }));

    expect(result).toEqual({ missed: ['VIT'], satisfied: ['STR'] });
  });

  it('treats 0 of 1 as a miss', () => {
    expect(evaluateDay(record({ STR: 1 }), record({}))).toEqual({
      missed: ['STR'],
      satisfied: [],
    });
    expect(evaluateDay(record({ STR: 1 }), record({ STR: 0 }))).toEqual({
      missed: ['STR'],
      satisfied: [],
    });
  });

  it('treats 1 of 2 as a miss for a penalized stat', () => {
    expect(evaluateDay(record({ STR: 2 }), record({ STR: 1 }))).toEqual({
      missed: ['STR'],
      satisfied: [],
    });
  });

  it('treats 2 of 2 as satisfied for a penalized stat', () => {
    expect(evaluateDay(record({ STR: 2 }), record({ STR: 2 }))).toEqual({
      missed: [],
      satisfied: ['STR'],
    });
  });

  it('puts a stat with required 0 in neither list, even with completions', () => {
    expect(evaluateDay(record({}), record({ STR: 5 }))).toEqual({ missed: [], satisfied: [] });
  });

  it('returns both lists in the fixed stat order', () => {
    const required = record({ STR: 1, VIT: 1, INT: 2, DISC: 1, SOC: 1 });
    const actual = record({ STR: 1, VIT: 0, INT: 1, DISC: 1, SOC: 1 });

    expect(evaluateDay(required, actual)).toEqual({
      missed: ['VIT', 'INT'],
      satisfied: ['STR', 'DISC', 'SOC'],
    });
  });

  it('returns empty lists when no stat is required', () => {
    expect(evaluateDay(record({}), record({ STR: 3, VIT: 3 }))).toEqual({
      missed: [],
      satisfied: [],
    });
  });
});

describe('nextPenaltyStats', () => {
  it('flags a stat on its first miss', () => {
    expect(nextPenaltyStats([], ['STR'], [], ['STR', 'VIT'])).toEqual(['STR']);
  });

  it('keeps a flag when a penalized stat is missed again (1 of 2)', () => {
    expect(nextPenaltyStats(['STR'], ['STR'], [], ['STR'])).toEqual(['STR']);
  });

  it('clears a flag when a penalized stat meets its requirement (2 of 2)', () => {
    expect(nextPenaltyStats(['STR'], [], ['STR'], ['STR'])).toEqual([]);
  });

  it('clears a stat that stops being quest-active even if it was flagged', () => {
    expect(nextPenaltyStats(['STR'], [], [], [])).toEqual([]);
  });

  it('repeated misses never escalate the requirement past 2', () => {
    const questStats = ['STR'] as const;
    let flags: Stat[] = [];

    for (let day = 0; day < 31; day++) {
      flags = nextPenaltyStats(flags, ['STR'], [], questStats);

      expect(flags).toEqual(['STR']);
      expect(buildRequired(questStats, flags).STR).toBe(2);
    }
  });

  it('adds missed stats, keeps unflagged satisfied stats unflagged, and returns fixed order', () => {
    const all: Stat[] = ['STR', 'VIT', 'INT', 'DISC', 'SOC'];
    const flags = nextPenaltyStats(['SOC', 'DISC'], ['INT'], ['DISC'], all);

    expect(flags).toEqual(['INT', 'SOC']);
  });

  it('caps every flagged stat at 2 via buildRequired', () => {
    const all: Stat[] = ['STR', 'VIT', 'INT', 'DISC', 'SOC'];
    const flags = nextPenaltyStats([], all, [], all);

    for (const stat of STATS) {
      expect(buildRequired(all, flags)[stat]).toBe(2);
    }
  });

  it('does not mutate its inputs', () => {
    const prev = Object.freeze(['SOC'] as const);
    const missed = Object.freeze(['STR'] as const);
    const satisfied = Object.freeze([] as const);
    const questStats = Object.freeze(['STR', 'SOC'] as const);

    expect(nextPenaltyStats(prev, missed, satisfied, questStats)).toEqual(['STR', 'SOC']);
    expect(prev).toEqual(['SOC']);
    expect(missed).toEqual(['STR']);
    expect(satisfied).toEqual([]);
    expect(questStats).toEqual(['STR', 'SOC']);
  });
});

describe('applyPenalty', () => {
  it('deducts the rank penalty once per missed stat from both balances', () => {
    const result = applyPenalty({ lifetimeXP: 1000, wallet: 500 }, 'D', 3);

    expect(result).toEqual({
      lifetimeXP: 976,
      wallet: 476,
      xpDeducted: 24,
      walletDeducted: 24,
    });
  });

  it('clamps Lifetime XP at 0 while Wallet still takes the full deduction', () => {
    const result = applyPenalty({ lifetimeXP: 10, wallet: 100 }, 'E', 3);

    expect(result).toEqual({
      lifetimeXP: 0,
      wallet: 85,
      xpDeducted: 10,
      walletDeducted: 15,
    });
  });

  it('clamps Wallet at 0 while Lifetime XP still takes the full deduction', () => {
    const result = applyPenalty({ lifetimeXP: 100, wallet: 3 }, 'E', 1);

    expect(result).toEqual({
      lifetimeXP: 95,
      wallet: 0,
      xpDeducted: 5,
      walletDeducted: 3,
    });
  });

  it('clamps both balances at 0', () => {
    const result = applyPenalty({ lifetimeXP: 4, wallet: 3 }, 'C', 2);

    expect(result).toEqual({
      lifetimeXP: 0,
      wallet: 0,
      xpDeducted: 4,
      walletDeducted: 3,
    });
  });

  it('deducts nothing when there are no missed stats', () => {
    const state = { lifetimeXP: 17, wallet: 23 };

    expect(applyPenalty(state, 'A', 0)).toEqual({
      lifetimeXP: 17,
      wallet: 23,
      xpDeducted: 0,
      walletDeducted: 0,
    });
  });

  it('uses the penalty value of the rank', () => {
    for (const rank of RANKS) {
      const result = applyPenalty({ lifetimeXP: 1000, wallet: 1000 }, rank, 1);

      expect(result.xpDeducted).toBe(PENALTY_BY_RANK[rank]);
      expect(result.walletDeducted).toBe(PENALTY_BY_RANK[rank]);
      expect(result.lifetimeXP).toBe(1000 - PENALTY_BY_RANK[rank]);
      expect(result.wallet).toBe(1000 - PENALTY_BY_RANK[rank]);
    }
  });

  it('does not mutate its input', () => {
    const state = Object.freeze({ lifetimeXP: 20, wallet: 20 });

    const result = applyPenalty(state, 'D', 1);

    expect(result.lifetimeXP).toBe(12);
    expect(result.wallet).toBe(12);
    expect(state).toEqual({ lifetimeXP: 20, wallet: 20 });
  });
});
