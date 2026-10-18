import { expect, test } from '@playwright/test';
import {
  CONTEXT_OPTIONS,
  FIXED_TIME,
  PAGES,
  PIXEL_THRESHOLD,
  SELF_TEST_MAX_EXACT_RATIO,
  THEMES,
  VIEWPORTS,
  captureFullPage,
  captureRegion,
  collect,
  comparePixels,
  compareStyleReports,
  newIsolatedContext,
  open,
  protoUrl,
} from './harness';

/**
 * Harness self-test (UI Revamp Issue 0).
 *
 * Renders the same page twice, in two separate browser contexts, and asserts
 * the two renders agree. Without this every reported diff ratio is
 * unfalsifiable: 4% could be the app, or a particle that slipped past `#fx`, or
 * a font that had not settled yet.
 *
 * Only the prototypes are rendered. They are the fixed reference, so that is
 * where non-determinism has to be proven absent. The app side is covered by the
 * same code path, so anything that makes the prototype unstable makes the
 * fidelity diff unstable too.
 *
 * Every case runs in both themes. Issue 1 added `shell.spec.ts` over 20
 * page/viewport/theme combinations, and the light theme is the one that would
 * show a theme read as flaky: the prototypes apply `data-theme` from a blocking
 * head script reading `localStorage`, so a lost storage read would leave the
 * page dark for one run and light for the next with nothing else changed. A
 * light case that cannot be proved stable cannot be used as a reference.
 *
 * What this has already caught, and what the harness does about it, is written
 * up in `README.md`. In short: `open()` settles for 2.5s so every staggered
 * animation has finished before the screenshot, `captureFullPage()` scrolls and
 * stitches instead of using beyond-viewport capture, and `CHROMIUM_ARGS` pins
 * text rasterisation.
 */

test.use(CONTEXT_OPTIONS);

/** The subtree `shell.spec.ts` captures; see the test below. */
const HEADER = 'header';

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    for (const theme of THEMES) {
      test.describe(`self-test ${p.name} @ ${vp.width} ${theme}`, () => {
        test.use({ viewport: vp });

        test('renders identically twice', async ({ browser }) => {
          const first = await newIsolatedContext(browser, vp, theme);
          const second = await newIsolatedContext(browser, vp, theme);
          const pageA = await first.newPage();
          const pageB = await second.newPage();

          await open(pageA, protoUrl(p));
          await open(pageB, protoUrl(p));

          const a = await captureFullPage(pageA);
          const b = await captureFullPage(pageB);

          // Dimensions first: a size difference would otherwise be reported as a
          // ratio over whatever overlap happened to exist.
          expect(
            { w: a.width, h: a.height },
            `run 1 ${a.width}x${a.height} vs run 2 ${b.width}x${b.height}`
          ).toEqual({ w: b.width, h: b.height });

          const total = a.width * a.height;
          const exact = comparePixels(a, b, 0);
          const { bad } = comparePixels(a, b, PIXEL_THRESHOLD);

          expect(
            bad,
            `${bad} of ${total} pixels differ between two identical renders ` +
              `(threshold ${PIXEL_THRESHOLD}); clock ${FIXED_TIME.toISOString()}`
          ).toBe(0);

          expect(
            exact.ratio,
            `exact mismatch ${(exact.ratio * 100).toFixed(4)}% of ${total} pixels, ` +
              `budget ${(SELF_TEST_MAX_EXACT_RATIO * 100).toFixed(2)}%; a run of ` +
              `consecutive renders should not disagree at all`
          ).toBeLessThanOrEqual(SELF_TEST_MAX_EXACT_RATIO);

          const stylesA = await pageA.evaluate(collect);
          const stylesB = await pageB.evaluate(collect);
          const problems = compareStyleReports(stylesA, stylesB);

          expect(problems, problems.join('\n')).toEqual([]);

          await first.close();
          await second.close();
        });

        /**
         * The same proof for the capture path `shell.spec.ts` uses.
         *
         * `captureRegion()` is not `captureFullPage()`: it screenshots one
         * element out of the viewport compositor instead of stitching scroll
         * slices, so it is a different code path and needs its own proof that two
         * identical loads of it agree. Same pages, same tolerances, same budget.
         */
        test('header renders identically twice', async ({ browser }) => {
          const first = await newIsolatedContext(browser, vp, theme);
          const second = await newIsolatedContext(browser, vp, theme);
          const pageA = await first.newPage();
          const pageB = await second.newPage();

          await open(pageA, protoUrl(p));
          await open(pageB, protoUrl(p));

          const a = await captureRegion(pageA, HEADER);
          const b = await captureRegion(pageB, HEADER);

          expect(
            { w: a.width, h: a.height },
            `header run 1 ${a.width}x${a.height} vs run 2 ${b.width}x${b.height}`
          ).toEqual({ w: b.width, h: b.height });

          const total = a.width * a.height;
          const exact = comparePixels(a, b, 0);
          const { bad } = comparePixels(a, b, PIXEL_THRESHOLD);

          expect(
            bad,
            `${bad} of ${total} header pixels differ between two identical renders ` +
              `(threshold ${PIXEL_THRESHOLD}); clock ${FIXED_TIME.toISOString()}`
          ).toBe(0);

          expect(
            exact.ratio,
            `header exact mismatch ${(exact.ratio * 100).toFixed(4)}% of ${total} pixels, ` +
              `budget ${(SELF_TEST_MAX_EXACT_RATIO * 100).toFixed(2)}%`
          ).toBeLessThanOrEqual(SELF_TEST_MAX_EXACT_RATIO);

          const stylesA = await pageA.evaluate(collect, HEADER);
          const stylesB = await pageB.evaluate(collect, HEADER);
          const problems = compareStyleReports(stylesA, stylesB);

          expect(problems, problems.join('\n')).toEqual([]);

          await first.close();
          await second.close();
        });
      });
    }
  }
}
