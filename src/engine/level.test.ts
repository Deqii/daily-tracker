import { describe, expect, it } from 'vitest';
import { level, xpForLevel } from './level';

const appendixBVectors: [xp: number, expected: number][] = [
  [-5, 1],
  [0, 1],
  [13, 1],
  [14, 2],
  [55, 2],
  [56, 3],
  [349, 5],
  [350, 6],
  [1399, 10],
  [1400, 11],
  [5599, 20],
  [5600, 21],
  [17149, 35],
  [17150, 36],
  [34999, 50],
  [35000, 51],
];

describe('level', () => {
  it.each(appendixBVectors)('maps xp %i to level %i (PRD Appendix B)', (xp, expected) => {
    expect(level(xp)).toBe(expected);
  });

  it('stays at level 1 for xp at or below 0', () => {
    expect(level(0)).toBe(1);
    expect(level(-5)).toBe(1);
    expect(level(-1400)).toBe(1);
  });

  it('returns 1 for non-finite input (PRD §7.1)', () => {
    expect(level(Number.NaN)).toBe(1);
    expect(level(Number.POSITIVE_INFINITY)).toBe(1);
    expect(level(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});

describe('xpForLevel', () => {
  const thresholds: [target: number, xp: number][] = [
    [2, 14],
    [3, 56],
    [4, 126],
    [5, 224],
    [6, 350],
    [11, 1400],
    [21, 5600],
    [36, 17150],
    [51, 35000],
  ];

  it.each(thresholds)('reports %i xp to reach level %i (PRD Appendix B)', (target, xp) => {
    expect(xpForLevel(target)).toBe(xp);
  });

  it('round-trips through level at every threshold', () => {
    for (const [target, xp] of thresholds) {
      expect(level(xp)).toBe(target);
      expect(level(xp - 1)).toBe(target - 1);
    }
  });

  it('throws a RangeError for a level below 1 or a non-integer (PRD §7.1)', () => {
    expect(() => xpForLevel(0)).toThrow(RangeError);
    expect(() => xpForLevel(-1)).toThrow(RangeError);
    expect(() => xpForLevel(1.5)).toThrow(RangeError);
    expect(() => xpForLevel(Number.NaN)).toThrow(RangeError);
  });
});
