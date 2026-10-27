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
  type Viewport,
} from './harness';

/**
 * Tasks interaction diffs (UI Revamp Issue 3).
 *
 * Each scenario performs the identical action on the prototype and on the app,
 * then compares the settled page: pixels first, computed styles second. The
 * tasks fixture has the same eleven tasks and rank E as `tasks.html`, so the
 * copy, the over-cap banner and the drawer previews come from the engine but
 * agree with the prototype's demo state.
 *
 * The delete scenario has no undo step: Audit decision 3 replaced the
 * prototype's old undo toast with the inline Delete/Cancel confirmation, and
 * the page's toast deliberately carries no action. See DEVIATIONS.md.
 */

const VIEWPORT: Viewport = { width: 1280, height: 800 };

const TASKS: PageSpec | undefined = PAGES.find((page) => page.name === 'tasks');

interface Scenario {
  readonly name: string;
  readonly slug: string;
  readonly act: (page: Page) => Promise<void>;
  readonly assertApp: (page: Page, before: string) => Promise<void>;
}

function summaryCount(summary: string): number {
  return Number.parseInt(summary, 10);
}

async function summary(page: Page): Promise<string> {
  return ((await page.locator('#summary').textContent()) ?? '').trim();
}

async function waitForDrawer(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const input = document.querySelector('#drawer input');

      if (!(input instanceof HTMLElement)) return false;

      const rect = input.getBoundingClientRect();

      return rect.width > 0 && rect.height > 0;
    },
    undefined,
    { timeout: 10000 }
  );
}

async function openDrawer(page: Page): Promise<void> {
  await page.locator('#add').click();
  await waitForDrawer(page);
  await settle(page, 'tasks drawer open');
}

const scenarios: readonly Scenario[] = [
  {
    name: 'open the add drawer',
    slug: 'open-drawer',
    async act(page) {
      await page.locator('#add').focus();
      await page.keyboard.press('Enter');
      await waitForDrawer(page);

      if (page.url().includes('4173')) {
        await expect
          .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 2000 })
          .toBe('fname');
      }

      await settle(page, 'tasks drawer open');

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement?.id === 'add', undefined, {
        timeout: 10000,
      });
      await settle(page, 'tasks drawer closed');

      expect(await page.evaluate(() => document.activeElement?.id)).toBe('add');
    },
    async assertApp(page) {
      await expect(page.locator('#drawer')).not.toHaveClass(/\bon\b/);
      await expect(page.locator('#scrim')).not.toHaveClass(/\bon\b/);
    },
  },
  {
    name: 'block saving an empty drawer',
    slug: 'validation-empty',
    async act(page) {
      await openDrawer(page);
      await page.locator('#save').click();
    },
    async assertApp(page) {
      await expect(page.locator('#eName')).toHaveText('Task name is required.');
      await expect(page.locator('.tier').first().locator('.err')).toHaveText(
        'Describe what to do.'
      );
      await expect(page.locator('#drawer')).toHaveClass(/\bon\b/);
    },
  },
  {
    name: 'block points above the rank cap',
    slug: 'validation-over-cap',
    async act(page) {
      await openDrawer(page);
      await page.locator('#fname').fill('Over cap draft');
      const easy = page.locator('.tier').first();

      await easy.locator('.d').fill('10 reps');
      await easy.locator('.p').fill('16');
      await page.locator('#save').click();
    },
    async assertApp(page) {
      await expect(page.locator('.tier').first().locator('.err')).toHaveText(
        'Max 15 points at Rank E.'
      );
      await expect(page.locator('#drawer')).toHaveClass(/\bon\b/);
    },
  },
  {
    name: 'combine stat and type filters',
    slug: 'filters',
    async act(page) {
      await page.locator('#statF [data-s="DISC"]').click();
      await page.locator('#typeF button').nth(2).click();
    },
    async assertApp(page) {
      await expect(page.locator('.group')).toHaveCount(1);
      await expect(page.locator('.group .task')).toHaveCount(1);
      await expect(page.locator('.group .task .nm')).toHaveText('Fokus tanpa HP');
    },
  },
  {
    name: 'add a single-tier task',
    slug: 'add-single-tier',
    async act(page) {
      await openDrawer(page);
      await page.locator('#fname').fill('Dead hang');
      const easy = page.locator('.tier').first();

      await easy.locator('.d').fill('20 seconds');
      await page.locator('#save').click();
    },
    async assertApp(page, before) {
      const count = summaryCount(await summary(page));

      expect(count).toBe(summaryCount(before) + 1);
      await expect(page.locator('.task .nm', { hasText: 'Dead hang' })).toHaveCount(1);
      await expect(page.locator('.toast span')).toHaveText('Task added');
      await expect(page.locator('.toast')).toHaveClass(/\bshow\b/);
    },
  },
  {
    name: 'delete with the inline confirmation',
    slug: 'delete',
    async act(page) {
      const card = page.locator('.task').last();

      await card.locator('.ib.del').click();
      await page.locator('.task .confirm [data-cd]').click();
    },
    async assertApp(page, before) {
      await expect(page.locator('.task .nm', { hasText: 'Telepon keluarga' })).toHaveCount(0);

      const count = summaryCount(await summary(page));

      expect(count).toBe(summaryCount(before) - 1);
      await expect(page.locator('.toast span')).toHaveText('"Telepon keluarga" deleted');
      await expect(page.locator('.toast')).toHaveClass(/\bshow\b/);
    },
  },
];

test.use(CONTEXT_OPTIONS);

if (TASKS === undefined) {
  throw new Error('harness.ts no longer lists a tasks page');
}

for (const theme of THEMES) {
  test.describe(`tasks interactions @ 1280 ${theme}`, () => {
    test.use({ viewport: VIEWPORT });

    for (const scenario of scenarios) {
      test(scenario.name, async ({ browser }) => {
        const slugName = `tasks-1280-${theme}-${scenario.slug}`;
        const protoPage = await openPrototype(browser, TASKS, VIEWPORT, theme);
        const appPage = await openApp(browser, TASKS, VIEWPORT, theme);
        const before = await summary(appPage);

        await scenario.act(protoPage);
        await scenario.act(appPage);

        await settle(protoPage, `tasks prototype after "${scenario.name}"`);
        await settle(appPage, `tasks app after "${scenario.name}"`);

        for (const page of [protoPage, appPage]) {
          await page.locator('#drawer').evaluate((el) => {
            el.scrollTop = 0;
          });
          await page.evaluate(() => window.scrollTo(0, 0));
        }

        await protoPage.mouse.move(0, 0);
        await appPage.mouse.move(0, 0);
        await settleFrames(protoPage);
        await settleFrames(appPage);

        await scenario.assertApp(appPage, before);

        const A = await protoPage.evaluate(collect);
        const B = await appPage.evaluate(collect);
        const problems = compareStyleReports(A, B);

        writeArtifact(
          slugName,
          'style-report.txt',
          Buffer.from(
            [
              `page tasks @ 1280x800 ${theme} after "${scenario.name}"`,
              `prototype ${A.length} elements, app ${B.length} elements`,
              '',
              ...problems,
            ].join('\n') + '\n',
            'utf8'
          )
        );

        console.log(
          `[tasks/${scenario.slug}] ${theme} style problems: ${
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
          `[tasks/${scenario.slug}] ${theme} prototype ${a.width}x${a.height} ` +
            `app ${b.width}x${b.height} | ${note}`
        );

        expect(
          { w: a.width, h: a.height },
          `page dimensions must match the prototype after "${scenario.name}"; ${note}`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio, diff } = comparePixels(a, b);

        writeArtifact(slugName, 'diff.png', PNG.sync.write(diff as PNG));
        console.log(
          `[tasks/${scenario.slug}] ${theme} diff ratio ${(ratio * 100).toFixed(3)}% ` +
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
