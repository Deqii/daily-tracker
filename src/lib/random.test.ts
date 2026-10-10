import { describe, expect, it } from 'vitest';
import { fnv1a32, mulberry32 } from './random';

describe('fnv1a32', () => {
  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['', '2026-10-10:STR', 'a', 'a longer string']) {
      const hash = fnv1a32(input);

      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('is deterministic and changes with the input', () => {
    expect(fnv1a32('2026-10-10:STR')).toBe(fnv1a32('2026-10-10:STR'));
    expect(fnv1a32('2026-10-10:STR')).not.toBe(fnv1a32('2026-10-11:STR'));
    expect(fnv1a32('2026-10-10:STR')).not.toBe(fnv1a32('2026-10-10:VIT'));
  });
});

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rand = mulberry32(fnv1a32('2026-10-10:STR'));

    for (let i = 0; i < 200; i++) {
      const value = rand();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('reproduces the same stream from the same seed', () => {
    const seed = fnv1a32('2026-10-10:STR');

    const first = mulberry32(seed);
    const second = mulberry32(seed);

    for (let i = 0; i < 50; i++) {
      expect(first()).toBe(second());
    }
  });

  it('produces different streams from different seeds', () => {
    const a = mulberry32(fnv1a32('2026-10-10:STR'));
    const b = mulberry32(fnv1a32('2026-10-10:VIT'));

    const streamA = Array.from({ length: 10 }, () => a());
    const streamB = Array.from({ length: 10 }, () => b());

    expect(streamA).not.toEqual(streamB);
  });
});
