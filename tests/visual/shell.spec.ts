import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import {
  CONTEXT_OPTIONS,
  MAX_DIFF_RATIO,
  PAGES,
  VIEWPORTS,
  appUrl,
  captureRegion,
  collect,
  comparePixels,
  compareStyleReports,
  openApp,
  openPrototype,
  overlapNote,
  protoUrl,
  sideBySide,
  slug,
  writeArtifact,
} from './harness';

/**
 * Header-region fidelity diffs.
 *
 * The whole-page spec in `fidelity.spec.ts` cannot go green until a page is
 * rebuilt, because a page that is still one panel out from spec differs
 * everywhere. The app shell is the first thing Issue 1 owns, and its header is
 * the one region every page has in common, so it needs a test of its own that
 * can turn green while the rest of the page is still wrong.
 *
 * Same machinery as the page tests on every axis that decides a number: the
 * same `open()` (frozen clock, local woff2, `#fx` and `.scan` hidden, reduced
 * motion, settle time), the same pixelmatch threshold, the same ratio ceiling,
 * and the same style report, scoped to the `header` subtree. The only
 * difference is that the captured region is one element instead of the whole
 * document.
 *
 * Pixel and style are asserted in one test, dimension first, so a report can
 * never be read without the numbers that produced it. This test does not
 * depend on `health.spec.ts`: it always runs and always prints its numbers, so
 * a failing shell is diagnosable on its own.
 *
 * It is expected to fail today: the shipped header predates the prototype's
 * unified mobile header.
 */

const HEADER = 'header';

test.use(CONTEXT_OPTIONS);

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test.describe(`${p.name} header @ ${vp.width}`, () => {
      test.use({ viewport: vp });

      const slugName = `${slug(p, vp)}-header`;

      test('pixel and computed-style diff', async ({ browser }) => {
        const protoPage = await openPrototype(browser, p, vp);
        const appPage = await openApp(browser, p, vp);

        const a = await captureRegion(protoPage, HEADER);
        const b = await captureRegion(appPage, HEADER);

        const A = await protoPage.evaluate(collect, HEADER);
        const B = await appPage.evaluate(collect, HEADER);

        const emit = async (name: string, body: Buffer, contentType: string): Promise<void> => {
          writeArtifact(slugName, name, body);
          await test.info().attach(name, { body, contentType });
        };

        await emit('prototype.png', PNG.sync.write(a), 'image/png');
        await emit('app.png', PNG.sync.write(b), 'image/png');

        const sameSize = a.width === b.width && a.height === b.height;

        if (sameSize) {
          const { diff } = comparePixels(a, b);

          await emit('diff.png', PNG.sync.write(diff as PNG), 'image/png');
        } else {
          await emit('side-by-side.png', PNG.sync.write(sideBySide(a, b)), 'image/png');
        }

        const note = overlapNote(a, b);
        const overlapBody = Buffer.from(`${note}\n`, 'utf8');

        await emit('overlap-ratio.txt', overlapBody, 'text/plain');

        // Reported before any assertion fails, so a failing run still states
        // what it measured.
        console.log(
          `[header] ${p.name} @ ${vp.width}x${vp.height} ` +
            `prototype ${a.width}x${a.height} app ${b.width}x${b.height} ` +
            `elements ${A.length}/${B.length} | ${note}`
        );

        // Dimensions first, exactly as the page test does it: an overlap ratio
        // over two different-sized headers would read as a plausible number and
        // hide the real cause, which is that these are different boxes.
        expect(
          { w: a.width, h: a.height },
          `header dimensions must match the prototype: prototype ${a.width}x${a.height}, ` +
            `app ${b.width}x${b.height}; ${note} ` +
            `(see prototype.png, app.png${sameSize ? '' : ' and side-by-side.png'} in ` +
            `test-results/visual/${slugName}/)`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio } = comparePixels(a, b);

        expect(
          ratio,
          `header diff ratio ${(ratio * 100).toFixed(3)}% over ${a.width}x${a.height}, ` +
            `threshold ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`
        ).toBeLessThanOrEqual(MAX_DIFF_RATIO);

        const problems = compareStyleReports(A, B);
        const report = [
          `${p.name} header @ ${vp.width}x${vp.height}`,
          `prototype: ${protoUrl(p)}  ${A.length} elements under <${HEADER}>`,
          `app:       ${appUrl(p)}  ${B.length} elements under <${HEADER}>`,
          note,
          '',
          ...problems,
        ];
        const body = Buffer.from(report.join('\n') + '\n', 'utf8');

        await emit('style-report.txt', body, 'text/plain');

        expect(problems, problems.join('\n')).toEqual([]);
      });
    });
  }
}