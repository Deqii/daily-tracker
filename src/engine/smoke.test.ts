import { describe, expect, it } from 'vitest';
import { level, xpForLevel } from './level';

describe('smoke test', () => {
  it('runs an engine assertion in the Node environment', () => {
    expect(level(xpForLevel(1))).toBe(1);
    expect(level(xpForLevel(3))).toBe(3);
  });
});
