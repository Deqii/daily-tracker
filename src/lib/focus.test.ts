import { describe, expect, it } from 'vitest';
import { nextFocusIndex } from './focus';

describe('nextFocusIndex', () => {
  it('wraps forward and backward', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 2, false)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
    expect(nextFocusIndex(3, 2, true)).toBe(1);
  });

  it('enters at the first or last item when focus is outside', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
    expect(nextFocusIndex(3, 9, false)).toBe(0);
    expect(nextFocusIndex(3, 9, true)).toBe(2);
  });

  it('has no target when there is nothing focusable', () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
    expect(nextFocusIndex(0, 0, true)).toBe(-1);
  });
});
