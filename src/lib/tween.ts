/**
 * The prototype's motion helpers (UI Revamp Issue 2).
 *
 * These are UI mechanics, not game rules: `today.html` owns them in its own
 * `<script>`, and the Fidelity Contract allows copying exactly this much. The
 * numbers that are animated come from the engine and stores; only the easing and
 * the duration live here.
 */

/**
 * `today.html`'s single `reduce` test (line 211): the media query, or motion
 * switched off in Settings. Every animated mechanic in the prototype checks it
 * once and, when it is true, jumps straight to the end state.
 */
export function motionIsReduced(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.motion === 'off'
  );
}

/**
 * The prototype's `tween(from, to, fn, ms)` (line 215), which animates a
 * *progress* from 0 to 1 on a cubic ease-out and lets the caller interpolate,
 * so one tween can drive several values at once (the radar's five stat values).
 *
 * Under reduced motion it applies `1` once and returns, exactly as the prototype
 * does. The default duration is the prototype's 600 ms; the wallet uses 500 ms.
 */
export function tween(apply: (progress: number) => void, ms = 600): void {
  if (motionIsReduced()) {
    apply(1);
    return;
  }

  const start = performance.now();

  const frame = (now: number): void => {
    const progress = Math.min(1, (now - start) / ms);

    apply(1 - (1 - progress) ** 3);

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
}

/**
 * How long the completion toast stays up, in ms (`today.html` line 261:
 * `setTimeout(hide, 8000)`).
 */
export const TOAST_MS = 8000;

/**
 * How long the ring burst and the floating `+N XP` live before they are removed
 * from the DOM (`today.html` line 260).
 */
export const FX_MS = 1100;
