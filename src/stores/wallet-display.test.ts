import { get, type Readable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { WALLET_TWEEN_MS, createWalletDisplay, type WalletState } from './wallet-display';

function sourceHub(initial = 0) {
  const listeners = new Set<(value: WalletState) => void>();
  let value: WalletState = { userState: { wallet: initial } };

  const source: Readable<WalletState> = {
    subscribe(run) {
      run(value);
      listeners.add(run);

      return () => {
        listeners.delete(run);
      };
    },
  };

  return {
    source,
    setWallet(wallet: number): void {
      value = { userState: { wallet } };

      for (const listener of [...listeners]) {
        listener(value);
      }
    },
    listenerCount(): number {
      return listeners.size;
    },
  };
}

function tweenSpy() {
  let progress: ((value: number) => void) | null = null;

  const tween = vi.fn((apply: (value: number) => void, _ms?: number): void => {
    progress = apply;
  });

  return {
    tween,
    finish(value: number): void {
      progress?.(value);
    },
  };
}

describe('createWalletDisplay', () => {
  it('sets the first wallet value outright without tweening', () => {
    const hub = sourceHub(10);
    const { tween } = tweenSpy();
    const display = createWalletDisplay(hub.source, tween);
    const seen: number[] = [];
    const stop = display.subscribe((value) => seen.push(value));

    expect(seen).toEqual([10]);
    expect(tween).not.toHaveBeenCalled();

    stop();
  });

  it('tweens from the old wallet to the new one over the prototype duration', () => {
    const hub = sourceHub(10);
    const { tween, finish } = tweenSpy();
    const display = createWalletDisplay(hub.source, tween);
    const seen: number[] = [];
    const stop = display.subscribe((value) => seen.push(value));

    hub.setWallet(20);

    expect(seen).toEqual([10]);
    expect(tween).toHaveBeenCalledTimes(1);
    expect(tween.mock.calls[0]?.[1]).toBe(WALLET_TWEEN_MS);

    finish(0.5);
    expect(seen.at(-1)).toBe(15);

    finish(1);
    expect(seen.at(-1)).toBe(20);

    stop();
  });

  it('does not tween when the wallet value is unchanged', () => {
    const hub = sourceHub(10);
    const { tween } = tweenSpy();
    const display = createWalletDisplay(hub.source, tween);
    const stop = display.subscribe(() => {});

    hub.setWallet(10);

    expect(get(display)).toBe(10);
    expect(tween).not.toHaveBeenCalled();

    stop();
  });

  it('subscribes to the source once and releases it after the last subscriber', () => {
    const hub = sourceHub();
    const { tween } = tweenSpy();
    const display = createWalletDisplay(hub.source, tween);
    const first = display.subscribe(() => {});
    const second = display.subscribe(() => {});

    expect(hub.listenerCount()).toBe(1);

    first();
    expect(hub.listenerCount()).toBe(1);

    second();
    expect(hub.listenerCount()).toBe(0);
  });
});
