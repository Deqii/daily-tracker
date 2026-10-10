import { describe, expect, it } from 'vitest';
import type { Stat } from '../lib/types';
import { STATS } from '../lib/types';
import { buildRequired, evaluateDay } from './evaluation';

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
