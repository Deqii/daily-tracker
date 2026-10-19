import { writable } from 'svelte/store';
import { TOAST_MS } from '../lib/tween';

/**
 * The completion / purchase toast (UI Revamp Issue 2, PRD §5).
 *
 * `today.html` keeps one always-present `.toast` element after `</main>`, fills
 * `#toastTxt`, and toggles a class on the element itself; `hide()` only removes
 * the class and leaves the text in place. The app keeps the same two facts - the
 * text and whether it is showing - as two stores, so hiding does not empty the
 * element and the hidden toast still measures the same as the prototype's.
 *
 * Nothing here reverts anything: see open question Q9 in
 * `docs/prototype/DEVIATIONS.md` for the "Batalkan" button, which the engine
 * cannot act on.
 */

/** What the toast says. It stays after the toast hides, as in the prototype. */
export const toastText = writable('');

/** Whether the toast is showing. */
export const toastVisible = writable(false);

let timer: ReturnType<typeof setTimeout> | null = null;

/** The prototype's `toast(t)` (line 261): set the text, show it, restart the timer. */
export function showToast(text: string): void {
  toastText.set(text);
  toastVisible.set(true);

  if (timer !== null) {
    clearTimeout(timer);
  }

  timer = setTimeout(() => {
    toastVisible.set(false);
    timer = null;
  }, TOAST_MS);
}

/** The prototype's `hide()` (line 262): drop the class, keep the text. */
export function hideToast(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  toastVisible.set(false);
}
