/**
 * Keyboard focus helpers for modal surfaces (UI Revamp Issue 7).
 *
 * The prototype drawers and overlays close on Escape and return focus to their
 * opener, but they do not trap Tab. Accessibility requires a modal surface to
 * keep focus inside itself until it closes, so Dialogs use these helpers. The
 * index arithmetic is pure and unit-tested; the DOM query is a thin wrapper.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** The next focus index after `current` in a ring of `count` items. */
export function nextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return shift ? count - 1 : 0;

  return shift ? (current - 1 + count) % count : (current + 1) % count;
}

/** Every visible, tabbable descendant of `container`, in DOM order. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    const rect = element.getBoundingClientRect();

    return (
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(element).visibility !== 'hidden'
    );
  });
}

/**
 * Keep Tab and Shift+Tab inside `container`. Call from a keydown handler; it is
 * a no-op for every other key. If focus is outside the container, the next Tab
 * moves to the first (or last) item.
 */
export function trapTab(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return;

  const items = focusableWithin(container);

  if (items.length === 0) {
    event.preventDefault();
    return;
  }

  const current = items.indexOf(document.activeElement as HTMLElement);
  const target = nextFocusIndex(items.length, current, event.shiftKey);

  event.preventDefault();
  items[target]?.focus();
}
