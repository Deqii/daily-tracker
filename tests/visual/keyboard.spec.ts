import { expect, test } from './harness';
import { PAGES, appUrl, newIsolatedContext, open, settleFrames } from './harness';
import type { Page } from '@playwright/test';

/**
 * Keyboard-only walkthrough (UI Revamp Issue 7).
 *
 * For every page the test tabs through the whole document, checks that each
 * stop is visible and shows a focus indicator, and that every visible control
 * was actually reachable by Tab. Then it opens the page's modal surfaces with
 * the keyboard: the Tasks and Rewards drawers must trap Tab, close on Escape and
 * restore focus to their opener; Today's tier picker must do the same; and the
 * milestone overlay must trap Tab on its only button and close on Escape.
 *
 * Nothing here clicks with a pointer. Focus is moved with Tab/Shift+Tab and
 * activated with Enter, so a control that only responds to a mouse is a failure.
 */

interface ControlKey {
  readonly key: string;
  readonly description: string;
}

function controlScript(): ControlKey[] {
  const describe = (element: Element): string => {
    const id = element.id === '' ? '' : `#${element.id}`;
    const classes = [...element.classList].join('.');
    const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);

    return `${element.tagName.toLowerCase()}${id}${classes === '' ? '' : `.${classes}`} "${text}"`;
  };

  return [
    ...document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"], [role="switch"], [role="radio"], [role="tab"], [tabindex]:not([tabindex="-1"])'
    ),
  ]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.closest('[hidden]') === null
      );
    })
    .map((element) => ({ key: describe(element), description: describe(element) }));
}

async function visibleControls(page: Page): Promise<ControlKey[]> {
  return page.evaluate(controlScript);
}

async function active(
  page: Page
): Promise<{ key: string; description: string; focusVisible: boolean; indicator: string } | null> {
  return page.evaluate(() => {
    const element = document.activeElement;

    if (!(element instanceof Element) || element === document.body) return null;

    const style = getComputedStyle(element);
    const id = element.id === '' ? '' : `#${element.id}`;
    const classes = [...element.classList].join('.');
    const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);

    return {
      key: `${element.tagName.toLowerCase()}${element.id === '' ? '' : `#${element.id}`}${[...element.classList].map((name) => `.${name}`).join('')} "${(element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`,
      description: `${element.tagName.toLowerCase()}${id}${classes === '' ? '' : `.${classes}`} "${text}"`,
      focusVisible: element.matches(':focus-visible'),
      indicator: `${style.outlineStyle} ${style.outlineWidth} / ${style.boxShadow}`,
    };
  });
}

for (const p of PAGES) {
  test.describe(`keyboard ${p.name}`, () => {
    test('tabs through every visible control with a focus indicator', async ({ browser }) => {
      const context = await newIsolatedContext(browser, { width: 1280, height: 800 }, 'dark');
      const page = await context.newPage();

      await open(page, appUrl(p));

      try {
        const controls = await visibleControls(page);
        await settleFrames(page);
        await settleFrames(page);
        const reached = new Set<string>();
        const withoutIndicator: string[] = [];
        const hiddenStops: string[] = [];

        let previous: string | null = null;

        for (let step = 0; step < 120; step += 1) {
          await page.keyboard.press('Tab');

          const current = await active(page);

          if (current === null) break;
          if (current.key === previous) break;
          if (reached.has(current.key)) break;

          reached.add(current.key);

          if (!current.focusVisible || current.indicator.startsWith('none 0px / none')) {
            withoutIndicator.push(`${current.description} (${current.indicator})`);
          }

          const visible = await page.locator(':focus').isVisible();

          if (!visible) hiddenStops.push(current.description);

          previous = current.key;
        }

        const pointerOnly = controls.filter((control) => !reached.has(control.key));

        expect(
          pointerOnly.map((control) => control.description),
          `${p.name}: controls reachable only by pointer`
        ).toEqual([]);
        expect(withoutIndicator, `${p.name}: tab stops without a visible focus indicator`).toEqual(
          []
        );
        expect(hiddenStops, `${p.name}: invisible tab stops`).toEqual([]);
        expect(reached.size, `${p.name}: no keyboard stops found`).toBeGreaterThan(0);
      } finally {
        await context.close();
      }
    });
  });
}

async function openDrawerWithKeyboard(page: Page): Promise<void> {
  const add = page.locator('#add');

  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#drawer')).toHaveClass(/\bon\b/);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const dialog = document.getElementById('drawer');
          return dialog !== null && dialog.contains(document.activeElement);
        }),
      { message: 'focus should move into the drawer' }
    )
    .toBe(true);
}

for (const name of ['tasks', 'rewards'] as const) {
  const p = PAGES.find((entry) => entry.name === name);

  if (p === undefined) throw new Error(`missing page: ${name}`);

  test.describe(`keyboard ${name} drawer`, () => {
    test('traps Tab, closes on Escape and restores focus', async ({ browser }) => {
      const context = await newIsolatedContext(browser, { width: 1280, height: 800 }, 'dark');
      const page = await context.newPage();

      await open(page, appUrl(p));

      try {
        await openDrawerWithKeyboard(page);

        for (let step = 0; step < 20; step += 1) {
          await page.keyboard.press('Tab');

          const inside = await page.evaluate(() => {
            const dialog = document.getElementById('drawer');
            return dialog !== null && dialog.contains(document.activeElement);
          });

          expect(inside, `Tab left the ${name} drawer on step ${step + 1}`).toBe(true);
        }

        await page.keyboard.press('Shift+Tab');

        expect(
          await page.evaluate(() => {
            const dialog = document.getElementById('drawer');
            return dialog !== null && dialog.contains(document.activeElement);
          }),
          'Shift+Tab left the drawer'
        ).toBe(true);

        await page.keyboard.press('Escape');
        await expect(page.locator('#drawer')).not.toHaveClass(/\bon\b/);

        await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe('add');
      } finally {
        await context.close();
      }
    });
  });
}

test.describe('keyboard today tier picker', () => {
  test('opens with Enter, closes on Escape and returns focus to the row', async ({ browser }) => {
    const p = PAGES.find((entry) => entry.name === 'today');

    if (p === undefined) throw new Error('missing today');

    const context = await newIsolatedContext(browser, { width: 1280, height: 800 }, 'dark');
    const page = await context.newPage();

    await open(page, appUrl(p, 'tiers'));

    try {
      const row = page.locator('.qrow[aria-controls]').first();

      await row.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.tiers')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.locator('.tiers')).toHaveCount(0);
      await expect(row).toBeFocused();
    } finally {
      await context.close();
    }
  });
});

test.describe('keyboard today overlay', () => {
  test('traps Tab and closes on Escape', async ({ browser }) => {
    const p = PAGES.find((entry) => entry.name === 'today');

    if (p === undefined) throw new Error('missing today');

    const context = await newIsolatedContext(browser, { width: 1280, height: 800 }, 'dark');
    const page = await context.newPage();

    await open(page, appUrl(p, 'levelup'));

    try {
      await expect(page.locator('.ov')).toHaveCount(1);
      await expect(page.locator('#ovc')).toBeFocused();

      for (let step = 0; step < 3; step += 1) {
        await page.keyboard.press('Tab');
        await expect(page.locator('#ovc'), 'Tab left the overlay').toBeFocused();
      }

      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('#ovc'), 'Shift+Tab left the overlay').toBeFocused();

      await page.keyboard.press('Escape');
      await expect(page.locator('.ov')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
