import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { TOAST_MS } from '../lib/tween';
import { hideToast, showToast, toastText, toastVisible } from './toast';

/**
 * The toast (UI Revamp Issue 2).
 *
 * The behaviour worth pinning is the one the interaction diff found the hard
 * way: hiding the toast drops the class and keeps the text, exactly as
 * `today.html`'s `hide()` does. Clearing the text would leave the element a
 * different size once it is invisible again, which the computed-style diff sees
 * and the eye does not.
 */

beforeEach(() => {
  vi.useFakeTimers();
  hideToast();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the toast', () => {
  it('starts hidden and empty', () => {
    expect(get(toastVisible)).toBe(false);
    expect(get(toastText)).toBe('');
  });

  it('shows the text it is given', () => {
    showToast('Baca 10 halaman selesai');

    expect(get(toastVisible)).toBe(true);
    expect(get(toastText)).toBe('Baca 10 halaman selesai');
  });

  it('hides itself after eight seconds and keeps the text', () => {
    showToast('Baca 10 halaman selesai');

    vi.advanceTimersByTime(TOAST_MS - 1);

    expect(get(toastVisible)).toBe(true);

    vi.advanceTimersByTime(1);

    expect(get(toastVisible)).toBe(false);
    expect(get(toastText)).toBe('Baca 10 halaman selesai');
  });

  it('restarts the timer when a second completion arrives', () => {
    showToast('first');

    vi.advanceTimersByTime(TOAST_MS - 100);
    showToast('second');

    vi.advanceTimersByTime(100);

    expect(get(toastVisible)).toBe(true);

    vi.advanceTimersByTime(TOAST_MS);

    expect(get(toastVisible)).toBe(false);
    expect(get(toastText)).toBe('second');
  });

  it('can be hidden early, and the text stays', () => {
    showToast('Main game 2 jam bought (−60)');
    hideToast();

    expect(get(toastVisible)).toBe(false);
    expect(get(toastText)).toBe('Main game 2 jam bought (−60)');

    // An early hide cancels the timer, so nothing fires later.
    vi.advanceTimersByTime(TOAST_MS * 2);

    expect(get(toastVisible)).toBe(false);
  });
});
