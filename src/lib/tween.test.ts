import { afterEach, describe, expect, it, vi } from 'vitest';
import { FX_MS, TOAST_MS, motionIsReduced, tween } from './tween';

/**
 * The prototype's motion helpers (UI Revamp Issue 2).
 *
 * The one behaviour that matters and cannot be seen in a screenshot is the
 * reduced-motion branch: `today.html` checks it once and jumps to the end state,
 * and the visual tests run with `prefers-reduced-motion: reduce`, so a tween that
 * animated anyway would make every capture a race.
 */

/** A `window`/`document` pair that reports the requested reduced-motion answer. */
function stubBrowser(options: { reduced: boolean; motionOff?: boolean }): void {
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') && options.reduced,
    }),
  });

  vi.stubGlobal('document', {
    documentElement: { dataset: options.motionOff === true ? { motion: 'off' } : {} },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('motionIsReduced', () => {
  it('follows the media query', () => {
    stubBrowser({ reduced: true });
    expect(motionIsReduced()).toBe(true);
  });

  it('follows data-motion="off"', () => {
    stubBrowser({ reduced: false, motionOff: true });
    expect(motionIsReduced()).toBe(true);
  });

  it('is false when neither says so', () => {
    stubBrowser({ reduced: false });
    expect(motionIsReduced()).toBe(false);
  });

  it('is true without a DOM, so nothing animates where it cannot', () => {
    vi.stubGlobal('window', undefined);
    expect(motionIsReduced()).toBe(true);
  });
});

describe('tween', () => {
  it('applies the end state once, and synchronously, under reduced motion', () => {
    stubBrowser({ reduced: true });

    const frames = vi.fn();

    vi.stubGlobal('requestAnimationFrame', frames);

    const seen: number[] = [];

    tween((progress) => seen.push(progress), 600);

    expect(seen).toEqual([1]);
    expect(frames).not.toHaveBeenCalled();
  });

  it('eases out on a cubic curve over the requested duration', () => {
    stubBrowser({ reduced: false });

    let now = 1000;

    const frames: ((time: number) => void)[] = [];

    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      frames.push(callback);

      return frames.length;
    });
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const seen: number[] = [];

    tween((progress) => seen.push(progress), 600);

    // Nothing is applied until the browser paints a frame.
    expect(seen).toEqual([]);

    frames[0]?.(now);

    expect(seen).toEqual([0]);

    now = 1300;
    frames[1]?.(now);

    expect(seen).toEqual([0, 1 - 0.5 ** 3]);

    now = 1600;
    frames[2]?.(now);

    // Past the duration it clamps at 1 and stops asking for frames.
    expect(seen[seen.length - 1]).toBe(1);
    expect(frames).toHaveLength(3);
  });
});

describe('durations', () => {
  it('are the prototype own numbers', () => {
    expect(TOAST_MS).toBe(8000);
    expect(FX_MS).toBe(1100);
  });
});
