import { readable } from 'svelte/store';
import { app } from './app';
import { tween } from '../lib/tween';

/**
 * The wallet as the header chip and the Today rewards teaser show it (PRD §5).
 *
 * The value itself is the engine's; only the way it arrives on screen is the
 * prototype's: `today.html` tweens `#walletChip` and `#wal2` from the old value
 * to the new one over 500 ms with a cubic ease-out and rounds as it goes
 * (line 250). The first value is set outright, because the prototype seeds
 * `dispW` from `S.wallet` and does not animate the initial paint (line 212).
 *
 * Both readers share this one store, so the chip and the teaser can never show
 * two different wallets mid-tween.
 */
export const WALLET_TWEEN_MS = 500;

export const walletDisplay = readable(0, (set) => {
  let current = 0;
  let started = false;

  return app.subscribe((state) => {
    const next = state.userState.wallet;

    if (!started) {
      started = true;
      current = next;
      set(next);

      return;
    }

    if (next === current) return;

    const from = current;

    tween((progress) => {
      current = Math.round(from + (next - from) * progress);
      set(current);
    }, WALLET_TWEEN_MS);
  });
});
