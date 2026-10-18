import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import {
  CONTEXT_OPTIONS,
  MAX_DIFF_RATIO,
  PAGES,
  VIEWPORTS,
  collect,
  comparePixels,
  compareStyleReports,
  fullPagePng,
  openApp,
  openPrototype,
  overlapNote,
  protoUrl,
  appUrl,
  sideBySide,
  slug,
  writeArtifact,
} from './harness';

/**
 * Prototype-vs-app fidelity diffs (UI Revamp Issue 0).
 *
 * Two assertions per page and viewport, and neither of them guards the other:
 *   1. `pixel diff` - full-page screenshots compared with pixelmatch.
 *   2. `computed-style diff` - both DOM trees walked and compared.
 *
 * Whether the app booted at all is a separate concern and lives in
 * `health.spec.ts`, so a blank or crashed page can never hide a diff number.
 *
 * Fix the app, not this file. Every threshold here is a starting point; tighten
 * `MAX_DIFF_RATIO` to 0 as pages come up to spec.
 */

test.use(CONTEXT_OPTIONS);

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test.describe(`${p.name} @ ${vp.width}`, () => {
      test.use({ viewport: vp });

      const slugName = slug(p, vp);

      async function emit(name: string, body: Buffer, contentType: string): Promise<void> {
        writeArtifact(slugName, name, body);
        await test.info().attach(name, { body, contentType });
      }

      test('pixel diff', async ({ browser }) => {
        const protoPage = await openPrototype(browser, p, vp);
        const appPage = await openApp(browser, p, vp);

        const a = await fullPagePng(protoPage);
        const b = await fullPagePng(appPage);

        await emit('prototype.png', PNG.sync.write(a), 'image/png');
        await emit('app.png', PNG.sync.write(b), 'image/png');
        await emit('side-by-side.png', PNG.sync.write(sideBySide(a, b)), 'image/png');

        // The overlap ratio is computed either way and attached either way, so a
        // size mismatch explains how far apart the two are as well as how far
        // apart in size. It is never the pass/fail number - see `overlapRatio`.
        const note = overlapNote(a, b);
        const overlapBody = Buffer.from(`${note}\n`, 'utf8');

        await emit('overlap-ratio.txt', overlapBody, 'text/plain');

        // Dimensions first. Comparing an overlap would turn a wrong page height
        // into a plausible-looking ratio and hide the real cause.
        expect(
          { w: a.width, h: a.height },
          `page dimensions must match the prototype: prototype ${a.width}x${a.height}, app ${b.width}x${b.height}; ` +
            `${note} ` +
            `(see prototype.png, app.png and side-by-side.png in test-results/visual/${slugName}/)`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio, diff } = comparePixels(a, b);

        await emit('diff.png', PNG.sync.write(diff as PNG), 'image/png');

        expect(
          ratio,
          `diff ratio ${(ratio * 100).toFixed(3)}% over ${a.width}x${a.height}, threshold ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`
        ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
      });

      test('computed-style diff', async ({ browser }) => {
        const protoPage = await openPrototype(browser, p, vp);
        const appPage = await openApp(browser, p, vp);

        const A = await protoPage.evaluate(collect);
        const B = await appPage.evaluate(collect);

        const problems = compareStyleReports(A, B);
        const report = [
          `page ${p.name} @ ${vp.width}x${vp.height}`,
          `prototype: ${protoUrl(p)}  ${A.length} elements`,
          `app:       ${appUrl(p)}  ${B.length} elements`,
          '',
          ...problems,
        ];
        const body = Buffer.from(report.join('\n') + '\n', 'utf8');

        writeArtifact(slugName, 'style-report.txt', body);
        await test.info().attach('style-report.txt', { body, contentType: 'text/plain' });

        expect(problems, problems.join('\n')).toEqual([]);
      });
    });
  }
}
