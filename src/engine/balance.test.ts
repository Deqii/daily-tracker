import { describe, expect, it } from 'vitest';
import type { StatXP } from './balance';
import { getTrackedStats, passesBalanceGate } from './balance';

const statXP = (values: Partial<StatXP>): StatXP => ({
  STR: 0,
  VIT: 0,
  INT: 0,
  DISC: 0,
  SOC: 0,
  ...values,
});

describe('getTrackedStats', () => {
  it('returns stats with a completion ever and excludes zero-completion stats', () => {
    expect(getTrackedStats(statXP({ STR: 0, VIT: 12, INT: 0, DISC: 20, SOC: 7 }))).toEqual([
      'VIT',
      'DISC',
      'SOC',
    ]);
  });

  it('returns an empty list when nothing is tracked', () => {
    expect(getTrackedStats(statXP({}))).toEqual([]);
  });
});

describe('passesBalanceGate', () => {
  it('matches Appendix A scenario 4 exactly', () => {
    const along = (soc: number): StatXP =>
      statXP({ STR: 100, VIT: 100, INT: 100, DISC: 100, SOC: soc });

    expect(passesBalanceGate(along(0))).toEqual({ passes: true, weakest: 'STR', threshold: 50 });
    expect(passesBalanceGate(along(10))).toEqual({ passes: false, weakest: 'SOC', threshold: 41 });
    expect(passesBalanceGate(along(44))).toEqual({ passes: false, weakest: 'SOC', threshold: 45 });
    expect(passesBalanceGate(along(45))).toEqual({ passes: true, weakest: 'SOC', threshold: 45 });
  });

  it('passes exactly at 50% of the tracked average and fails one below', () => {
    expect(passesBalanceGate(statXP({ STR: 5, VIT: 10, INT: 15 }))).toEqual({
      passes: true,
      weakest: 'STR',
      threshold: 5,
    });
    expect(passesBalanceGate(statXP({ STR: 4, VIT: 10, INT: 16 }))).toEqual({
      passes: false,
      weakest: 'STR',
      threshold: 5,
    });
  });

  it('passes with one tracked stat and with none', () => {
    expect(passesBalanceGate(statXP({ VIT: 42 }))).toEqual({
      passes: true,
      weakest: null,
      threshold: 0,
    });
    expect(passesBalanceGate(statXP({}))).toEqual({ passes: true, weakest: null, threshold: 0 });
  });
});
