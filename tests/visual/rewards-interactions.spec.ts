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
 * Rewards interaction diffs (UI Revamp Issue 4).
 *
 * Each scenario performs the identical action on the prototype and on the app,
 * then compares the settled page: pixels first, computed styles second. The
 * rewards fixture reproduces `rewards.html`'s catalog, purchase log and the
 * engine data that makes the average income line read 13 (DEVIATIONS.md, "Test
 * scaffolding"), so every number is engine-derived but agrees with the
 * prototype's demo state.
 */

const VIEWPORT: Viewport = { width: 1280, height: 800 };

const REWARDS: PageSpec | undefined = PAGES.find((page) => page.name === 'rewards');

interface StoredUserState {
  lifetimeXP: number;
  statXP: Record<string, number>;
  totalPurchases: number;
  wallet: number;
}

async function storedUserState(page: Page): Promise<StoredUserState> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('daily-tracker:userState');

    if (raw === null) throw new Error('userState is not persisted');

    return JSON.parse(raw) as StoredUserState;
  });
}

async function waitForDrawer(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('#drawer')?.classList.contains('on') === true,
    undefined,
    { timeout: 10000 }
  );
}

/** Removes the focus ring before a visual diff; focus is asserted app-only. */
async function blurActive(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

async function openDrawer(page: Page): Promise<void> {
  await page.locator('#add').click();
  await waitForDrawer(page);
  await settle(page, 'rewards drawer open');
}

function card(page: Page, title: string) {
  return page.locator('.card', { hasText: title }).first();
}

async function settleAfterAction(page: Page, label: string): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll('.cn,.float').length === 0, undefined, {
    timeout: 10000,
  });
  await settle(page, label);
}

interface Scenario {
  readonly name: string;
  readonly slug: string;
  readonly act: (page: Page) => Promise<void>;
  readonly assertApp: (page: Page, before: StoredUserState) => Promise<void>;
}

const scenarios: readonly Scenario[] = [
  {
    name: 'filter affordable now',
    slug: 'filter',
    async act(page) {
      await page.locator('#onlyCan').click();
    },
    async assertApp(page) {
      const cards = page.locator('.card');

      await expect(cards).toHaveCount(2);
      await expect(cards.locator('.ttl')).toHaveText(['Kopi susu santai', 'Main game 2 jam']);
      await expect(page.locator('#onlyCan')).toHaveAttribute('aria-pressed', 'true');
    },
  },
  {
    name: 'sort cheapest',
    slug: 'sort-cheapest',
    async act(page) {
      await page.locator('[data-so="cheap"]').click();
    },
    async assertApp(page) {
      await expect(page.locator('.card .ttl').first()).toHaveText('Kopi susu santai');
      await expect(page.locator('[data-so="cheap"]')).toHaveAttribute('aria-pressed', 'true');
    },
  },
  {
    name: 'buy Main game 2 jam',
    slug: 'buy',
    async act(page) {
      await card(page, 'Main game 2 jam').locator('[data-b]').click();
    },
    async assertApp(page, before) {
      const state = await storedUserState(page);

      expect(state.wallet).toBe(5);
      expect(state.lifetimeXP).toBe(before.lifetimeXP);
      expect(state.statXP).toEqual(before.statXP);
      expect(state.totalPurchases).toBe(before.totalPurchases + 1);

      await expect(page.locator('#bigW')).toHaveText('5');
      await expect(page.locator('.chips .chip:last-child b')).toHaveText('5');
      await expect(page.locator('#summary')).toHaveText('5 items · 0 affordable now');
      await expect(page.locator('#kvCan')).toHaveText('0 of 5');
      await expect(page.locator('#kvSpent')).toHaveText('2,430');
      await expect(page.locator('.card')).toHaveCount(5);
      await expect(page.locator('.card.lock')).toHaveCount(5);
      await expect(card(page, 'Main game 2 jam').locator('.bought b')).toHaveText('5');
      await expect(page.locator('#log li').first()).toContainText('Main game 2 jam');
      await expect(page.locator('#log li').first()).toContainText('Just now');
      await expect(page.locator('#log li')).toHaveCount(16);
      await expect(page.locator('.toast span')).toHaveText('Main game 2 jam bought (−60)');
    },
  },
  {
    name: 'open the add drawer',
    slug: 'open-drawer',
    async act(page) {
      await openDrawer(page);
    },
    async assertApp(page) {
      await expect(page.locator('#dt')).toHaveText('Add reward');
      await expect(page.locator('#fT')).toHaveValue('');
      await expect(page.locator('#fC')).toHaveValue('');
      await expect(page.locator('#drawer')).toHaveClass('drawer on');
    },
  },
  {
    name: 'submit an empty drawer',
    slug: 'validation-empty',
    async act(page) {
      await openDrawer(page);
      await page.locator('#save').click();
    },
    async assertApp(page) {
      await expect(page.locator('#eT')).toHaveText('Reward name is required.');
      await expect(page.locator('#eC')).toHaveText('Enter a whole number of 1 or more.');
      await expect(page.locator('#drawer')).toHaveClass(/\bon\b/);
    },
  },
  {
    name: 'open the edit drawer of Kopi susu santai',
    slug: 'edit-drawer',
    async act(page) {
      await card(page, 'Kopi susu santai').locator('[data-e]').click();
      await waitForDrawer(page);
      await settle(page, 'rewards edit drawer open');
    },
    async assertApp(page) {
      await expect(page.locator('#dt')).toHaveText('Edit reward');
      await expect(page.locator('#fT')).toHaveValue('Kopi susu santai');
      await expect(page.locator('#fC')).toHaveValue('35');
      await expect(page.locator('#hC')).toHaveText('You can buy this now.');
    },
  },
  {
    name: 'ask to delete Beli buku baru',
    slug: 'delete-confirm',
    async act(page) {
      await card(page, 'Beli buku baru').locator('[data-d]').click();
      await page.waitForFunction(() => document.querySelector('.confirm') !== null, undefined, {
        timeout: 10000,
      });
      await page.waitForFunction(() => document.activeElement?.dataset.cc === '1', undefined, {
        timeout: 10000,
      });
    },
    async assertApp(page) {
      await expect(card(page, 'Beli buku baru').locator('.confirm')).toBeVisible();
      await expect(card(page, 'Beli buku baru').locator('.confirm')).toContainText(
        'Delete Beli buku baru?'
      );
    },
  },
  {
    name: 'confirm deleting Beli buku baru',
    slug: 'delete-confirmed',
    async act(page) {
      await card(page, 'Beli buku baru').locator('[data-d]').click();
      await page.waitForFunction(() => document.querySelector('.confirm') !== null, undefined, {
        timeout: 10000,
      });
      await page.locator('.confirm [data-cd]').click();
      await page.waitForFunction(
        () => document.querySelectorAll('.card').length === 4,
        undefined,
        { timeout: 10000 }
      );
    },
    async assertApp(page) {
      await expect(page.locator('.card .ttl', { hasText: 'Beli buku baru' })).toHaveCount(0);
      await expect(page.locator('.card')).toHaveCount(4);
      await expect(page.locator('#log li')).toHaveCount(15);
      await expect(page.locator('#summary')).toHaveText('4 items · 2 affordable now');
      await expect(page.locator('.toast span')).toHaveText(
        '"Beli buku baru" deleted. Purchase history is kept.'
      );
    },
  },
];

test.use(CONTEXT_OPTIONS);

if (REWARDS === undefined) {
  throw new Error('harness.ts no longer lists a rewards page');
}

for (const theme of THEMES) {
  test.describe(`rewards interactions @ 1280 ${theme}`, () => {
    test.use({ viewport: VIEWPORT });

    for (const scenario of scenarios) {
      test(scenario.name, async ({ browser }) => {
        const slugName = `rewards-1280-${theme}-${scenario.slug}`;
        const protoPage = await openPrototype(browser, REWARDS, VIEWPORT, theme);
        const appPage = await openApp(browser, REWARDS, VIEWPORT, theme);
        const before = await storedUserState(appPage);

        await protoPage.bringToFront();
        await scenario.act(protoPage);
        await appPage.bringToFront();
        await scenario.act(appPage);

        await protoPage.mouse.move(0, 0);
        await appPage.mouse.move(0, 0);

        await settleAfterAction(protoPage, `rewards prototype after "${scenario.name}"`);
        await settleAfterAction(appPage, `rewards app after "${scenario.name}"`);

        // Let the prototype's 150ms focus timer (and the app's 400ms one) land,
        // then drop the focus ring on both sides: the prototype's timer fires
        // while the drawer is still `visibility: hidden`, so whether it lands
        // depends on tab throttling. Focus itself is asserted app-only below.
        await protoPage.waitForTimeout(500);
        await appPage.waitForTimeout(500);
        await blurActive(protoPage);
        await blurActive(appPage);

        for (const page of [protoPage, appPage]) {
          await page.locator('#drawer').evaluate((el) => {
            el.scrollTop = 0;
          });
          await page.evaluate(() => window.scrollTo(0, 0));
        }

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
              `page rewards @ 1280x800 ${theme} after "${scenario.name}"`,
              `prototype ${A.length} elements, app ${B.length} elements`,
              '',
              ...problems,
            ].join('\n') + '\n',
            'utf8'
          )
        );

        console.log(
          `[rewards/${scenario.slug}] ${theme} style problems: ${
            problems.length === 0 ? 'none' : 'see style-report.txt'
          }`
        );

        expect(problems, problems.join('\n')).toEqual([]);

        // Viewport captures, like the Tasks interactions: the open drawer is
        // `position: fixed`, and scrolling/stitching it would draw it twice.
        const a = PNG.sync.read(await protoPage.screenshot({ animations: 'disabled' }));
        const b = PNG.sync.read(await appPage.screenshot({ animations: 'disabled' }));

        writeArtifact(slugName, 'prototype.png', PNG.sync.write(a));
        writeArtifact(slugName, 'app.png', PNG.sync.write(b));
        writeArtifact(slugName, 'side-by-side.png', PNG.sync.write(sideBySide(a, b)));

        const note = overlapNote(a, b);

        console.log(
          `[rewards/${scenario.slug}] ${theme} prototype ${a.width}x${a.height} ` +
            `app ${b.width}x${b.height} | ${note}`
        );

        expect(
          { w: a.width, h: a.height },
          `page dimensions must match the prototype after "${scenario.name}"; ${note}`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio, diff } = comparePixels(a, b);

        writeArtifact(slugName, 'diff.png', PNG.sync.write(diff as PNG));
        console.log(
          `[rewards/${scenario.slug}] ${theme} diff ratio ${(ratio * 100).toFixed(3)}% ` +
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

test.describe('rewards drawer focus management @ 1280 dark', () => {
  test.use({ viewport: VIEWPORT });

  test('focus enters the name field and Escape returns it to the trigger', async ({ browser }) => {
    const page = await openApp(browser, REWARDS, VIEWPORT, 'dark');

    await page.bringToFront();
    await page.locator('#add').click();
    await waitForDrawer(page);

    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 5000 })
      .toBe('fT');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#drawer')?.classList.contains('on'));
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 5000 })
      .toBe('add');
  });
});
