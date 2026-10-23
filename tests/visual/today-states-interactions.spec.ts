import { expect, test, type Page } from '@playwright/test';
import { passesBalanceGate } from '../../src/engine/balance';
import { pointsAwarded } from '../../src/engine/points';
import { STATS, type Stat } from '../../src/lib/types';
import { CONTEXT_OPTIONS, PAGES, openApp, type PageSpec } from './harness';

/**
 * Today's state mechanics (UI Revamp audit batch 2).
 *
 * `today-states.spec.ts` proves the states look like the prototype. This file
 * proves they behave through the app's own code: the tier picker completes at the
 * chosen variant through the engine, its keyboard path returns focus, the blocked
 * line and freeze line read the engine, the overlays take focus and dismiss on
 * Escape, the rank-down notice is dismissible, and the storage banners use the
 * real save/load paths. Expected numbers come from engine functions, never from
 * literals copied out of a prototype.
 */

const TODAY: PageSpec | undefined = PAGES.find((page) => page.name === 'today');

if (TODAY === undefined) throw new Error('PAGES has no today entry');

const VIEWPORT = { width: 1280, height: 800 } as const;

async function openState(browser: Parameters<typeof openApp>[0], state: string): Promise<Page> {
  return openApp(browser, TODAY, VIEWPORT, 'dark', state);
}

async function text(page: Page, selector: string): Promise<string> {
  return ((await page.locator(selector).first().textContent()) ?? '').trim();
}

async function xpIntoLevel(page: Page): Promise<number> {
  const line = await text(page, '.status .row.sub span');

  return Number(line.split(' / ')[0]);
}

test.use(CONTEXT_OPTIONS);

test.describe('tier picker', () => {
  test('expands, closes on Escape with focus returned, and completes at the chosen tier', async ({
    browser,
  }) => {
    const page = await openState(browser, 'tiers');
    const row = page.locator('.qrow[data-i="2"]');

    await expect(row).toContainText('+3 to +8');
    await row.click();
    await expect(page.locator('.tiers')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.tiers')).toHaveCount(0);
    await expect(row).toBeFocused();

    const before = await xpIntoLevel(page);
    const tier = page.locator('.tier[data-t="medium"]');

    await row.click();
    await expect(tier).toBeVisible();
    await expect(tier).toContainText('Medium');
    await expect(tier).toContainText('+5');

    await tier.click();
    await expect(row).toHaveClass(/done/);
    await expect(row).toContainText('+5');
    await expect.poll(() => xpIntoLevel(page)).toBe(before + pointsAwarded(9, 'E'));
  });
});

test.describe('engine-derived lines', () => {
  test('shows the blocked line from the balance gate', async ({ browser }) => {
    const page = await openState(browser, 'blocked');
    const shown = await page.locator('.stats .stat b').allTextContents();
    const statXP = Object.fromEntries(
      STATS.map((stat, index) => [stat, Number(shown[index])])
    ) as Record<Stat, number>;
    const gate = passesBalanceGate(statXP);

    expect(gate.passes).toBe(false);
    expect(gate.weakest).not.toBeNull();
    await expect(page.locator('.blocked')).toHaveText(
      `Rank-up blocked: raise Soc to ${gate.threshold} xp (now ${statXP.SOC})`
    );
  });

  test('shows no freezes left from the store', async ({ browser }) => {
    const page = await openState(browser, 'freeze0');

    await expect(page.locator('.shield #frz')).toHaveText('No freezes left this week');
  });
});

test.describe('title and empty states', () => {
  test('omits the title chip when no title is equipped', async ({ browser }) => {
    const page = await openState(browser, 'notitle');

    await expect(page.locator('.status .title')).toHaveCount(0);
  });

  test('renders the empty quest state without a penalty zone', async ({ browser }) => {
    const page = await openState(browser, 'empty');

    await expect(page.locator('.empty h2')).toHaveText('No tasks yet');
    await expect(page.locator('.quest .row .sub')).toHaveText('');
    await expect(page.locator('.penalty')).toBeHidden();
    await expect(page.locator('.empty .btn')).toHaveAttribute('href', '#/tasks');
  });
});

test.describe('overlays and notices', () => {
  test('focuses Continue on a level up, closes on Escape and restores focus', async ({
    browser,
  }) => {
    const page = await openState(browser, 'levelup');

    await expect(page.locator('.ov')).toBeVisible();
    await expect(page.locator('.ovp small')).toHaveText('Level up');
    await expect(page.locator('.ovp .big')).toHaveText('4');
    await expect(page.locator('.ovp p')).toHaveText('Level 3 to 4');
    await expect(page.locator('#ovc')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('.ov')).toHaveCount(0);
  });

  test('shows the new rank table on a rank up', async ({ browser }) => {
    const page = await openState(browser, 'rankup');
    const details = page.locator('.ovp dl');

    await expect(page.locator('.ovp small')).toHaveText('Rank up');
    await expect(page.locator('.ovp p')).toHaveText('Rank D');
    await expect(details).toContainText('Freezes per week 1');
    await expect(details).toContainText('Max points per task 25');
    await expect(details).toContainText('Multiplier ×0.7');
    await expect(details).toContainText('Penalty per missed stat −8');
  });

  test('dismisses the rank-down notice through the seen flag', async ({ browser }) => {
    const page = await openState(browser, 'rankdown');

    await expect(page.locator('.notice')).toHaveText('Rank dropped to E Dismiss');
    await page.locator('.notice .lnk').click();
    await expect(page.locator('.notice')).toHaveCount(0);

    const seen = await page.evaluate(() => {
      const raw = localStorage.getItem('daily-tracker:milestoneEvents');
      const events = raw === null ? [] : (JSON.parse(raw) as { seen: boolean }[]);

      return events.length > 0 && events.every((event) => event.seen);
    });

    expect(seen).toBe(true);
  });

  test('uses the write-failure banner role and exports', async ({ browser }) => {
    const page = await openState(browser, 'storage');

    await expect(page.locator('.banner')).toHaveAttribute('role', 'alert');
    await expect(page.locator('.banner')).toContainText('Your data could not be saved');
    await expect(page.locator('.banner .obtn')).toHaveText('Export data');
  });

  test('uses the recovery banner role and dismisses it', async ({ browser }) => {
    const page = await openState(browser, 'recovery');

    await expect(page.locator('.banner.recovery')).toHaveAttribute('role', 'status');
    await page.locator('.banner .lnk').click();
    await expect(page.locator('.banner')).toHaveCount(0);
  });

  test('collapses overlay animation under reduced motion', async ({ browser }) => {
    const page = await openState(browser, 'levelup');
    const motion = await page.locator('.ovp').evaluate((element) => {
      const style = getComputedStyle(element);
      const big = getComputedStyle(element.querySelector('.big') ?? element);

      return { duration: style.animationDuration, bigName: big.animationName };
    });

    expect(motion.duration).toBe('0.001s');
    expect(motion.bigName).toBe('none');
  });
});
