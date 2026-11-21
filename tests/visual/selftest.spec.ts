import { expect, test } from './harness';
import { PNG } from 'pngjs';
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
  stitchSlices,
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

function solid(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number]
): PNG {
  const image = new PNG({ width, height });
  const [r, g, b, a] = rgba;

  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = r;
    image.data[i + 1] = g;
    image.data[i + 2] = b;
    image.data[i + 3] = a;
  }

  return image;
}

function pixelAt(image: PNG, x: number, y: number): number[] {
  const start = (y * image.width + x) * 4;

  return Array.from(image.data.subarray(start, start + 4));
}

/**
 * Regression pin for Issue #185 (`tasks @ 390 light`).
 *
 * `captureFullPage` clamps its final slice to `height - vh`, so that slice
 * re-captures rows an aligned slice already wrote. The rule this test pins is
 * that those rows keep the aligned capture and only the tail beyond the last
 * written row comes from the clamped slice.
 *
 * A real page of plain colour bands renders identically in every slice, so it
 * would pass on the old overwrite logic too. Synthetic slices with a deliberate
 * difference in the overlap make the old and new behaviours distinguishable,
 * and the test is pure pixel arithmetic, so it is deterministic on every runner.
 */
test('clamped final slice never overwrites rows captured at an aligned offset', () => {
  const width = 3;
  const viewportHeight = 4;
  const pageHeight = 10;

  const out = stitchSlices(
    [
      { scrollY: 0, image: solid(width, viewportHeight, [10, 0, 0, 255]) },
      { scrollY: 4, image: solid(width, viewportHeight, [20, 0, 0, 255]) },
      {
        scrollY: pageHeight - viewportHeight,
        image: solid(width, viewportHeight, [30, 0, 0, 255]),
      },
    ],
    width,
    pageHeight
  );

  for (const y of [0, 3]) expect(pixelAt(out, 0, y)).toEqual([10, 0, 0, 255]);
  // Rows 6-7 are the overlap. The old code wrote [30, ...] here.
  for (const y of [4, 5, 6, 7]) expect(pixelAt(out, 0, y)).toEqual([20, 0, 0, 255]);
  for (const y of [8, 9]) expect(pixelAt(out, 0, y)).toEqual([30, 0, 0, 255]);
});

test('stitches non-overlapping slices in scroll order', () => {
  const width = 2;

  const out = stitchSlices(
    [
      { scrollY: 0, image: solid(width, 4, [1, 2, 3, 255]) },
      { scrollY: 4, image: solid(width, 4, [4, 5, 6, 255]) },
    ],
    width,
    8
  );

  expect(pixelAt(out, 1, 0)).toEqual([1, 2, 3, 255]);
  expect(pixelAt(out, 1, 7)).toEqual([4, 5, 6, 255]);
});

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
        });
      });
    }
  }
}
