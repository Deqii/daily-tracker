import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, eachDay, toLocalDate, toTimestamp, weekStart } from './date';

describe('toLocalDate', () => {
  it('formats a Date using local getters', () => {
    expect(toLocalDate(new Date(2028, 1, 29, 15, 45))).toBe('2028-02-29');
  });
});

describe('toTimestamp', () => {
  it('keeps the local date in the first 10 characters near local midnight', () => {
    const d = new Date(2028, 1, 29, 0, 30);
    expect(toTimestamp(d).slice(0, 10)).toBe('2028-02-29');
  });

  it('round-trips: toLocalDate(new Date(toTimestamp(d))) equals toLocalDate(d)', () => {
    const d = new Date(2028, 1, 29, 0, 30);
    expect(toLocalDate(new Date(toTimestamp(d)))).toBe(toLocalDate(d));
  });

  it('is ISO 8601 with a numeric UTC offset, never Z', () => {
    const timestamp = toTimestamp(new Date(2028, 1, 29, 23, 5, 9));
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(timestamp.endsWith('Z')).toBe(false);
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2028-06-30', 1)).toBe('2028-07-01');
    expect(addDays('2028-07-01', -1)).toBe('2028-06-30');
  });

  it('crosses a year end', () => {
    expect(addDays('2028-12-31', 1)).toBe('2029-01-01');
    expect(addDays('2029-01-01', -1)).toBe('2028-12-31');
  });

  it('handles the leap day 2028-02-29', () => {
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('daysBetween', () => {
  it('counts whole days, signed', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2028-02-29', '2028-02-29')).toBe(0);
    expect(daysBetween('2028-03-01', '2028-02-28')).toBe(-2);
  });

  it('spans month, year, and leap-day boundaries', () => {
    expect(daysBetween('2028-01-31', '2028-03-01')).toBe(30);
    expect(daysBetween('2028-12-31', '2029-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2029-02-28')).toBe(366);
  });
});

describe('eachDay', () => {
  it('yields every day from inclusive to exclusive', () => {
    expect(eachDay('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29']);
    expect(eachDay('2028-02-25', '2028-03-02')).toEqual([
      '2028-02-25',
      '2028-02-26',
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('crosses a year boundary', () => {
    expect(eachDay('2028-12-30', '2029-01-02')).toEqual(['2028-12-30', '2028-12-31', '2029-01-01']);
  });

  it('returns an empty result when from equals or is after toExclusive', () => {
    expect(eachDay('2028-03-01', '2028-03-01')).toEqual([]);
    expect(eachDay('2028-03-02', '2028-03-01')).toEqual([]);
  });
});

describe('weekStart', () => {
  const monday = '2024-06-10';
  const week = [
    '2024-06-10',
    '2024-06-11',
    '2024-06-12',
    '2024-06-13',
    '2024-06-14',
    '2024-06-15',
    '2024-06-16',
  ];

  it('returns the Monday for every day of the week', () => {
    for (const day of week) {
      expect(weekStart(day)).toBe(monday);
    }
  });

  it('steps across a month boundary', () => {
    expect(weekStart('2028-03-01')).toBe('2028-02-28');
  });

  it('steps across a year boundary', () => {
    expect(weekStart('2025-01-01')).toBe('2024-12-30');
  });
});

describe('invalid input', () => {
  it('rejects malformed local dates', () => {
    expect(() => addDays('2028/02/29', 1)).toThrow(RangeError);
    expect(() => addDays('2028-2-29', 1)).toThrow(RangeError);
    expect(() => weekStart('not-a-date')).toThrow(RangeError);
  });

  it('rejects impossible calendar days', () => {
    expect(() => addDays('2028-02-30', 1)).toThrow(RangeError);
    expect(() => weekStart('2027-02-29')).toThrow(RangeError);
  });

  it('rejects a non-integer day shift', () => {
    expect(() => addDays('2028-02-29', 1.5)).toThrow(RangeError);
  });
});
