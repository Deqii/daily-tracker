import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import {
  CONTEXT_OPTIONS,
  MAX_DIFF_RATIO,
  PAGES,
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
  writeArtifact,
  type PageSpec,
} from './harness';

/**
 * Today's deterministic prototype states (UI Revamp audit batch 2).
 *
 * `today.html?state=<name>` and `?fixture=today&state=<name>` must render the
 * same page, pixels and computed styles, at 1280x800 dark, 390x844 dark and
 * 1280x800 light. `freeze2` is absent on purpose: Rank E allows one freeze per
 * week, so the engine cannot produce the prototype's two-freeze state without
 * changing the rank (DEVIATIONS.md Q10). It is reported, not faked.
 *
 * The state values themselves come from `src/lib/fixtures/today-states-snapshot.json`,
 * dumped from the prototype; nothing here copies a prototype literal.
 */

const TODAY: PageSpec | undefined = PAGES.find((page) => page.name === 'today');

if (TODAY === undefined) throw new Error('PAGES has no today entry');

const STATES = [
  'tiers',
  'freeze0',
  'blocked',
  'notitle',
  'empty',
  'levelup',
  'rankup',
  'rankdown',
  'storage',
  'recovery',
] as const;

const CASES = [
  { width: 1280, height: 800, theme: 'dark' as const },
  { width: 390, height: 844, theme: 'dark' as const },
  { width: 1280, height: 800, theme: 'light' as const },
];

test.use(CONTEXT_OPTIONS);

for (const state of STATES) {
  for (const item of CASES) {
    test.describe(`today state ${state} @ ${item.width} ${item.theme}`, () => {
      test.use({ viewport: { width: item.width, height: item.height } });

      const slug = `today-state-${state}-${item.width}-${item.theme}`;

      test('pixel diff', async ({ browser }) => {
        const protoPage = await openPrototype(browser, TODAY, item, item.theme, state);
        const appPage = await openApp(browser, TODAY, item, item.theme, state);

        const a = await fullPagePng(protoPage);
        const b = await fullPagePng(appPage);
        const note = overlapNote(a, b);

        writeArtifact(slug, 'prototype.png', PNG.sync.write(a));
        writeArtifact(slug, 'app.png', PNG.sync.write(b));
        writeArtifact(slug, 'side-by-side.png', PNG.sync.write(sideBySide(a, b)));

        expect(
          { w: a.width, h: a.height },
          `${state}: prototype ${a.width}x${a.height}, app ${b.width}x${b.height}; ${note}`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio, diff } = comparePixels(a, b);

        writeArtifact(slug, 'diff.png', PNG.sync.write(diff as PNG));

        console.log(
          `[today:${state}] ${item.width}x${item.height} ${item.theme} ` +
            `${a.width}x${a.height} | diff ratio ${(ratio * 100).toFixed(3)}% | ${note}`
        );

        expect(
          ratio,
          `${state} diff ratio ${(ratio * 100).toFixed(3)}% over ${a.width}x${a.height}, ` +
            `threshold ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`
        ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
      });

      test('computed-style diff', async ({ browser }) => {
        const protoPage = await openPrototype(browser, TODAY, item, item.theme, state);
        const appPage = await openApp(browser, TODAY, item, item.theme, state);

        const A = await protoPage.evaluate(collect);
        const B = await appPage.evaluate(collect);
        const problems = compareStyleReports(A, B);
        const report = [
          `page today state ${state} @ ${item.width}x${item.height} ${item.theme}`,
          `prototype: ${protoUrl(TODAY, state)}  ${A.length} elements`,
          `app:       ${appUrl(TODAY, state)}  ${B.length} elements`,
          '',
          ...problems,
        ];
        const body = Buffer.from(report.join('\n') + '\n', 'utf8');

        writeArtifact(slug, 'style-report.txt', body);
        await test.info().attach('style-report.txt', { body, contentType: 'text/plain' });

        expect(problems, problems.join('\n')).toEqual([]);
      });
    });
  }
}
