import { expect, test, type Page } from '@playwright/test';
import { CONTEXT_OPTIONS, PAGES, VIEWPORTS, appUrl, newIsolatedContext, open } from './harness';

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

        await context.close();
      });
    });
  }
}
