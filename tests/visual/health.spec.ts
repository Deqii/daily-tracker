import { expect, test } from './harness';
import type { Page } from '@playwright/test';
import {
  CONTEXT_OPTIONS,
  PAGES,
  THEMES,
  VIEWPORTS,
  appUrl,
  newIsolatedContext,
  open,
  openApp,
  openPrototype,
} from './harness';

/**
 * App health (UI Revamp Issue 0).
 *
 * Kept out of `fidelity.spec.ts` on purpose. The diff tests must always run and
 * always report a number, so nothing in them may fail first for an unrelated
 * reason. A page that crashed, booted on the wrong route or rendered no heading
 * is a health problem; the pixel and style diffs then describe whatever the app
 * actually drew, which is still the information needed to fix it.
 */

test.use(CONTEXT_OPTIONS);

/** Collects the two event kinds that mean "the app is broken", not "the app looks different". */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });

  return errors;
}

async function readPageHeading(page: Page): Promise<string> {
  return page.evaluate(() => {
    const h = document.querySelector('main h1, main h2');
    return h?.textContent?.trim() ?? '';
  });
}

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test.describe(`health ${p.name} @ ${vp.width}`, () => {
      test.use({ viewport: vp });

      test(`renders ${p.name} without errors`, async ({ browser }) => {
        const context = await newIsolatedContext(browser, vp);
        const page = await context.newPage();

        // Listeners are attached before navigation, so a throw during boot is caught.
        const errors = watchForErrors(page);

        await open(page, appUrl(p));

        expect(errors, `the ${p.name} page reported errors:\n${errors.join('\n')}`).toEqual([]);

        // The hash is `#/<route>`; the fixture query sits before it, so there is
        // no slash between `?` and `#`.
        expect(page.url(), `expected the ${p.name} route`).toContain(`#/${p.route}`);

        const heading = await readPageHeading(page);

        expect(
          heading,
          `expected the ${p.name} page to start with <main> heading "${p.heading}", got "${heading}" (${appUrl(p)})`
        ).toBe(p.heading);
      });
    });
  }
}

const tasksPage = PAGES.find((p) => p.name === 'tasks');

if (tasksPage === undefined) throw new Error('the tasks page is missing from PAGES');

/**
 * The Tasks page must fit a 390px phone, on both sides.
 *
 * The prototype's over-cap variant row used to be 478px wide at this viewport,
 * wider than the phone. The capture stitches up to `max(scrollWidth, viewport)`,
 * so the pixel diff could still pass with an overflowing page; this assertion
 * makes the width itself a health guarantee. Both themes are checked because the
 * theme changes the header, not the Tasks grid, but the guarantee should not
 * depend on which token block is active.
 */
test.describe('health tasks overflow @ 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const theme of THEMES) {
    test(`tasks fits the viewport (${theme})`, async ({ browser }) => {
      const vp = { width: 390, height: 844 } as const;
      const prototype = await openPrototype(browser, tasksPage, vp, theme);
      const app = await openApp(browser, tasksPage, vp, theme);

      const prototypeWidth = await prototype.evaluate(() => document.documentElement.scrollWidth);
      const appWidth = await app.evaluate(() => document.documentElement.scrollWidth);

      expect(
        prototypeWidth,
        `prototype tasks.html overflows 390px in ${theme}`
      ).toBeLessThanOrEqual(390);
      expect(appWidth, `app tasks page overflows 390px in ${theme}`).toBeLessThanOrEqual(390);
    });
  }
});
