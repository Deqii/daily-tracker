import { expect, test } from './harness';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import {
  CONTEXT_OPTIONS,
  MAX_DIFF_RATIO,
  PAGES,
  THEMES,
  collect,
  comparePixels,
  compareStyleReports,
  openApp,
  openPrototype,
  overlapNote,
  settle,
  settleFrames,
  sideBySide,
  writeArtifact,
  type PageSpec,
  type Theme,
  type Viewport,
} from './harness';

/**
 * History interaction diffs (UI Revamp Issue 5).
 *
 * Each scenario performs the same action on the prototype and the app, then
 * compares the settled page (pixels first, computed styles second) and asserts
 * the app state that the action is supposed to drive. The history fixture
 * replays `history.html`'s demo days and events verbatim, so the hovered point,
 * the tooltip text and the highlighted row line up on both sides.
 */

const VIEWPORT: Viewport = { width: 1280, height: 800 };
const HISTORY: PageSpec | undefined = PAGES.find((page) => page.name === 'history');

if (HISTORY === undefined) {
  throw new Error('harness.ts no longer lists a history page');
}

interface Scenario {
  readonly name: string;
  readonly slug: string;
  readonly act: (page: Page) => Promise<void>;
  readonly assertApp: (page: Page) => Promise<void>;
  readonly keepPointer?: true;
}

async function hoverPoint(page: Page, index: number, count: number): Promise<void> {
  const chart = page.locator('#chart');
  const box = await chart.boundingBox();

  if (box === null) throw new Error('history chart has no bounding box');

  const x = 46 + (index * (820 - 46 - 14)) / (count - 1);

  await page.mouse.move(box.x + (x / 820) * box.width, box.y + box.height / 2);
}

function selectedRow(page: Page) {
  return page.locator('tr.d.sel');
}

function selectedCell(page: Page) {
  return page.locator('.cal button.sel');
}

const scenarios: readonly Scenario[] = [
  {
    name: 'hover the third point',
    slug: 'hover',
    keepPointer: true,
    async act(page) {
      await hoverPoint(page, 2, 7);
    },
    async assertApp(page) {
      await expect(page.locator('#tip')).toHaveClass(/on/);
      await expect(page.locator('#tip')).toContainText('Sun 11 Oct');
      await expect(page.locator('#tip')).toContainText('Lifetime XP');
      await expect(selectedRow(page)).toHaveAttribute('data-date', '2026-10-11');
      await expect(selectedCell(page)).toHaveAttribute('data-i', '2026-10-11');
    },
  },
  {
    name: 'keyboard End selects the last day',
    slug: 'keyboard-end',
    async act(page) {
      await page.locator('#chart').focus();
      await page.keyboard.press('End');
    },
    async assertApp(page) {
      await expect(page.locator('#tip')).toHaveClass(/on/);
      await expect(page.locator('#tip')).toContainText('Thu 15 Oct');
      await expect(selectedRow(page)).toHaveAttribute('data-date', '2026-10-15');
      await expect(selectedCell(page)).toHaveAttribute('data-i', '2026-10-15');
    },
  },
  {
    name: 'keyboard Home selects the first day',
    slug: 'keyboard-home',
    async act(page) {
      await page.locator('#chart').focus();
      await page.keyboard.press('Home');
    },
    async assertApp(page) {
      await expect(page.locator('#tip')).toContainText('Fri 9 Oct');
      await expect(selectedRow(page)).toHaveAttribute('data-date', '2026-10-09');
      await expect(selectedCell(page)).toHaveAttribute('data-i', '2026-10-09');
    },
  },
  {
    name: 'range switch to 30 days',
    slug: 'range-30',
    async act(page) {
      await page.locator('[data-r="30"]').click();
    },
    async assertApp(page) {
      await expect(page.locator('#rangeTxt')).toHaveText('16 Sept – 15 Oct 2026');
      await expect(page.locator('.sum .panel').first()).toContainText('in 30 days');
      await expect(page.locator('.cal button')).toHaveCount(30);
      await expect(selectedRow(page)).toHaveAttribute('data-date', '2026-10-15');
    },
  },
  {
    name: 'click the newest event',
    slug: 'event-click',
    async act(page) {
      await page.locator('#evs .ev').first().click();
    },
    async assertApp(page) {
      await expect(page.locator('#tip')).toHaveClass(/on/);
      await expect(page.locator('#tip')).toContainText('Tue 13 Oct');
      await expect(selectedRow(page)).toHaveAttribute('data-date', '2026-10-13');
      await expect(selectedCell(page)).toHaveAttribute('data-i', '2026-10-13');
    },
  },
  {
    name: 'click a calendar cell',
    slug: 'calendar-click',
    async act(page) {
      await page.locator('.cal button').first().click();
    },
    async assertApp(page) {
      await expect(page.locator('#tip')).toHaveClass(/on/);
      await expect(page.locator('#tip')).toContainText('Fri 9 Oct');
      await expect(selectedRow(page)).toHaveAttribute('data-date', '2026-10-09');
    },
  },
];

async function render(browser: Parameters<typeof openPrototype>[0], theme: Theme, scenario: Scenario) {
  const protoPage = await openPrototype(browser, HISTORY, VIEWPORT, theme);
  const appPage = await openApp(browser, HISTORY, VIEWPORT, theme);

  await protoPage.bringToFront();
  await scenario.act(protoPage);
  await appPage.bringToFront();
  await scenario.act(appPage);

  for (const page of [protoPage, appPage]) {
    if (scenario.keepPointer !== true) await page.mouse.move(0, 0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, `history after "${scenario.name}"`);
    await settleFrames(page);
  }

  return { protoPage, appPage };
}

test.use(CONTEXT_OPTIONS);

for (const theme of THEMES) {
  test.describe(`history interactions @ 1280 ${theme}`, () => {
    test.use({ viewport: VIEWPORT });

    for (const scenario of scenarios) {
      test(scenario.name, async ({ browser }) => {
        const slugName = `history-1280-${theme}-${scenario.slug}`;
        const { protoPage, appPage } = await render(browser, theme, scenario);

        await scenario.assertApp(appPage);

        const A = await protoPage.evaluate(collect);
        const B = await appPage.evaluate(collect);
        const problems = compareStyleReports(A, B);

        writeArtifact(
          slugName,
          'style-report.txt',
          Buffer.from(
            [
              `page history @ 1280x800 ${theme} after "${scenario.name}"`,
              `prototype ${A.length} elements, app ${B.length} elements`,
              '',
              ...problems,
            ].join('\n') + '\n',
            'utf8'
          )
        );

        console.log(
          `[history/${scenario.slug}] ${theme} style problems: ${
            problems.length === 0 ? 'none' : 'see style-report.txt'
          }`
        );

        expect(problems, problems.join('\n')).toEqual([]);

        const a = PNG.sync.read(await protoPage.screenshot({ animations: 'disabled' }));
        const b = PNG.sync.read(await appPage.screenshot({ animations: 'disabled' }));

        writeArtifact(slugName, 'prototype.png', PNG.sync.write(a));
        writeArtifact(slugName, 'app.png', PNG.sync.write(b));
        writeArtifact(slugName, 'side-by-side.png', PNG.sync.write(sideBySide(a, b)));

        const note = overlapNote(a, b);

        console.log(
          `[history/${scenario.slug}] ${theme} prototype ${a.width}x${a.height} ` +
            `app ${b.width}x${b.height} | ${note}`
        );

        expect(
          { w: a.width, h: a.height },
          `page dimensions must match the prototype after "${scenario.name}"; ${note}`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio, diff } = comparePixels(a, b);

        writeArtifact(slugName, 'diff.png', PNG.sync.write(diff as PNG));
        console.log(
          `[history/${scenario.slug}] ${theme} diff ratio ${(ratio * 100).toFixed(3)}% ` +
            `(threshold ${(MAX_DIFF_RATIO * 100).toFixed(3)}%)`
        );

        expect(
          ratio,
          `diff ratio ${(ratio * 100).toFixed(3)}% over ${a.width}x${a.height} after "${scenario.name}"`
        ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
      });
    }
  });
}
