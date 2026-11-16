import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_TWEEN_MS, walletDisplay } from './wallet-display';

const mock = vi.hoisted(() => {
  interface MockState {
    userState: { wallet: number };
  }

  const listeners = new Set<(value: MockState) => void>();
  let state: MockState = { userState: { wallet: 0 } };
  let progress: ((value: number) => void) | null = null;

  const app = {
    subscribe(run: (value: MockState) => void): () => void {
      run(state);
      listeners.add(run);

      return () => {
        listeners.delete(run);
      };
    },
  };

  const setWallet = (wallet: number): void => {
    state = { userState: { wallet } };

    for (const listener of [...listeners]) {
      listener(state);
    }
  };

  const tween = vi.fn((apply: (value: number) => void, _ms?: number): void => {
    progress = apply;
  });

  const finish = (value: number): void => {
    progress?.(value);
  };

  const reset = (): void => {
    listeners.clear();
    state = { userState: { wallet: 0 } };
    progress = null;
    tween.mockClear();
  };

  return {
    app,
    setWallet,
    tween,
    finish,
    reset,
    listenerCount: (): number => listeners.size,
  };
});

vi.mock('./app', () => ({ app: mock.app }));
vi.mock('../lib/tween', () => ({ tween: mock.tween }));

beforeEach(() => {
  mock.reset();
});

describe('walletDisplay', () => {
  it('sets the first wallet value outright without tweening', () => {
    mock.setWallet(10);
    const seen: number[] = [];
    const stop = walletDisplay.subscribe((value) => seen.push(value));

    expect(seen).toEqual([10]);
    expect(mock.tween).not.toHaveBeenCalled();

    stop();
  });

  it('tweens from the old wallet to the new one over the prototype duration', () => {
    mock.setWallet(10);
    const seen: number[] = [];
    const stop = walletDisplay.subscribe((value) => seen.push(value));

    mock.setWallet(20);

    expect(seen).toEqual([10]);
    expect(mock.tween).toHaveBeenCalledTimes(1);
    expect(mock.tween.mock.calls[0]?.[1]).toBe(WALLET_TWEEN_MS);

    mock.finish(0.5);
    expect(seen.at(-1)).toBe(15);

    mock.finish(1);
    expect(seen.at(-1)).toBe(20);

    stop();
  });

  it('does not tween when the wallet value is unchanged', () => {
    mock.setWallet(10);
    const stop = walletDisplay.subscribe(() => {});

    mock.setWallet(10);

    expect(get(walletDisplay)).toBe(10);
    expect(mock.tween).not.toHaveBeenCalled();

    stop();
  });

  it('subscribes to the app once and releases it after the last subscriber', () => {
    const first = walletDisplay.subscribe(() => {});
    const second = walletDisplay.subscribe(() => {});

    expect(mock.listenerCount()).toBe(1);

    first();
    expect(mock.listenerCount()).toBe(1);

    second();
    expect(mock.listenerCount()).toBe(0);
  });
});
