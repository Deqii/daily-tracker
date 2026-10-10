import { describe, expect, it } from 'vitest';
import type { StatXP } from './balance';
import { resolveRank } from './rank';

const statXP = (values: Partial<StatXP>): StatXP => ({
  STR: 0,
  VIT: 0,
  INT: 0,
  DISC: 0,
  SOC: 0,
  ...values,
});

const balanced: StatXP = statXP({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 100 });
const unbalanced: StatXP = statXP({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: 10 });
const allEven: StatXP = statXP({ STR: 72, VIT: 72, INT: 72, DISC: 72, SOC: 72 });

describe('resolveRank', () => {
  it('matches Appendix A scenario 3: the drop is immediate and ungated', () => {
    expect(resolveRank('D', 5, allEven)).toEqual({ rank: 'E', change: 'down', blocked: false });
  });

  it('drops across several ranks and ignores the balance gate on the way down', () => {
    expect(resolveRank('C', 4, unbalanced)).toEqual({ rank: 'E', change: 'down', blocked: false });
  });

  it('matches scenario 4 rank resolution lines', () => {
    expect(resolveRank('E', 6, unbalanced)).toEqual({ rank: 'E', change: null, blocked: true });
    expect(resolveRank('E', 6, balanced)).toEqual({ rank: 'D', change: 'up', blocked: false });
    expect(resolveRank('E', 12, balanced)).toEqual({ rank: 'C', change: 'up', blocked: false });
    expect(resolveRank('D', 4, balanced)).toEqual({ rank: 'E', change: 'down', blocked: false });
  });

  it('is unchanged when the current rank already equals the level rank', () => {
    expect(resolveRank('D', 7, unbalanced)).toEqual({ rank: 'D', change: null, blocked: false });
  });

  it('re-climbing after a drop needs the balance gate again', () => {
    expect(resolveRank('D', 4, balanced)).toEqual({ rank: 'E', change: 'down', blocked: false });
    expect(resolveRank('E', 6, unbalanced)).toEqual({ rank: 'E', change: null, blocked: true });
    expect(resolveRank('E', 6, balanced)).toEqual({ rank: 'D', change: 'up', blocked: false });
  });
});
