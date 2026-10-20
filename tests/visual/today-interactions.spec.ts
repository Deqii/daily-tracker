import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { passesBalanceGate } from '../../src/engine/balance';
import { level as levelOf, xpForLevel } from '../../src/engine/level';
import { pointsAwarded } from '../../src/engine/points';
import { STATS, type Stat } from '../../src/lib/types';
import {
  CONTEXT_OPTIONS,
  MAX_DIFF_RATIO,
  PAGES,
  THEMES,
  collect,
  comparePixels,
  compareStyleReports,
  fullPagePng,
  openApp,
  openPrototype,
  overlapNote,
  settleFrames,
  sideBySide,
  writeArtifact,
  type PageSpec,
  type Viewport,
} from './harness';

/**
 * Today interaction diffs (UI Revamp Issue 2).
 *
 * Each scenario performs the identical action on the prototype and on the app -
 * same selector, same click point, same wait - and then compares the whole page,
 * pixels first and computed styles second, exactly as `fidelity.spec.ts` does.
 *
 * The app's state is asserted separately and against the engine's own functions
 * (`pointsAwarded`, `level`, `xpForLevel`), never against numbers typed into this
 * file, so the expectations follow the rank table and the level curve rather than
 * the fixture. The value the action started from is read off the page before the
 * click.
 *
 * Only 1280x800 is used: the interactions do not move the layout, and the two
 * viewports are already covered by the static fidelity tests.
 */

/**
 * Long enough for the ring burst and the floating `+N XP` to be gone. Both sides
 * remove them 1100 ms after the click (`today.html` line 260, the app's `FX_MS`),
 * so the comparison is of the settled result and not of a particle that may or
 * may not still be on screen. The toast stays up on both sides for 8 s.
 */
const AFTER_MS = 1400;

/** The pause between the two clicks that clear the penalty zone. */
const BETWEEN_CLICKS_MS = 300;

/** The rank the fixture seeds, which decides the cap and the multiplier. */
const FIXTURE_RANK = 'E' as const;

/** The nominal points of the fixture's single-tier quest tasks. */
const FIXTURE_NOMINAL = 5;

const VIEWPORT: Viewport = { width: 1280, height: 800 };

const TODAY: PageSpec | undefined = PAGES.find((page) => page.name === 'today');

const WALLET = '.chips .chip:last-child b';
const XP_TEXT = '.status .row.sub span';
const LEVEL = '.status .lv b';

interface Scenario {
  readonly name: string;
  readonly slug: string;
  /** The identical action, run on both sides. */
  readonly act: (page: Page) => Promise<void>;
  /** App-only: what the engine's own numbers must now say. */
  readonly assertEngine: (page: Page, before: Snapshot) => Promise<void>;
}

/** What the page showed before the action ran, for the engine-derived expectations. */
interface Snapshot {
  readonly wallet: number;
  readonly level: number;
  /** XP already earned inside that level. */
  readonly xpIntoLevel: number;
  /** The cost of the first reward row, the affordable one, read before the action. */
  readonly rewardCost: number;
}

async function text(page: Page, selector: string): Promise<string> {
  return ((await page.locator(selector).first().textContent()) ?? '').trim();
}

async function number(page: Page, selector: string): Promise<number> {
  return Number(await text(page, selector));
}

/** `9 / 70 XP` -> 9 and 70. */
async function readXpLine(page: Page): Promise<[number, number]> {
  const line = await text(page, XP_TEXT);
  const [into, total] = line.split(' / ');

  return [Number(into), Number(total.replace(' XP', ''))];
}

async function snapshot(page: Page): Promise<Snapshot> {
  const [xpIntoLevel] = await readXpLine(page);

  return {
    wallet: await number(page, WALLET),
    level: await number(page, LEVEL),
    xpIntoLevel,
    rewardCost: Number((await text(page, '.rewards .rw .pts')).replace(/[^\d]/g, '')),
  };
}

/** The five per-stat totals the stat chips print, for the engine's own gate check. */
async function readStatXp(page: Page): Promise<Record<Stat, number>> {
  const shown = await page.locator('.stats .stat b').allTextContents();

  return Object.fromEntries(STATS.map((stat, index) => [stat, Number(shown[index])])) as Record<
    Stat,
    number
  >;
}

/** Lifetime XP from the level and the XP earned inside it, through the engine's curve. */
function lifetimeXp(level: number, xpIntoLevel: number): number {
  return xpForLevel(level) + xpIntoLevel;
}

const scenarios: readonly Scenario[] = [
  {
    name: 'complete Baca 10 halaman',
    slug: 'complete-int',
    async act(page) {
      await page.locator('.qrow[data-i="2"]').click();
    },
    async assertEngine(page, before) {
      const awarded = pointsAwarded(FIXTURE_NOMINAL, FIXTURE_RANK);

      expect(await number(page, WALLET)).toBe(before.wallet + awarded);

      const row = page.locator('.qrow[data-i="2"]');

      await expect(row).toHaveAttribute('aria-checked', 'true');
      await expect(row).toHaveClass(/done/);
      // Int is not a 2x stat, so the row keeps no counter.
      await expect(row.locator('.need')).toHaveCount(0);

      const xp = lifetimeXp(before.level, before.xpIntoLevel) + awarded;
      const level = levelOf(xp);
      const floor = xpForLevel(level);
      const [into, total] = await readXpLine(page);

      expect(into).toBe(xp - floor);
      expect(total).toBe(xpForLevel(level + 1) - floor);
      await expect(page.locator(LEVEL)).toHaveText(String(level));
      await expect(page.locator('.radar-wrap .row .sub')).toHaveText(
        `Gate threshold: ${passesBalanceGate(await readStatXp(page)).threshold} XP`
      );
      await expect(page.locator('.toast')).toHaveClass(/show/);
      await expect(page.locator('.toast span')).toHaveText('Baca 10 halaman completed');
    },
  },
  {
    name: 'complete Chat 1 teman twice',
    slug: 'clear-penalty',
    async act(page) {
      const row = page.locator('.qrow[data-i="4"]');

      await row.click();
      await page.waitForTimeout(BETWEEN_CLICKS_MS);
      await row.click();
    },
    async assertEngine(page, before) {
      const awarded = pointsAwarded(FIXTURE_NOMINAL, FIXTURE_RANK);

      expect(await number(page, WALLET)).toBe(before.wallet + awarded * 2);

      const row = page.locator('.qrow[data-i="4"]');

      await expect(row).toHaveAttribute('aria-checked', 'true');
      await expect(row.locator('.need')).toHaveText('2/2');

      // The zone is cleared: green border, green title, the cleared texts, and the
      // timer turns to the success colour.
      const penalty = page.locator('.penalty');

      await expect(penalty).toHaveClass(/clear/);
      await expect(penalty.locator('strong')).toHaveText('Penalty cleared');
      await expect(penalty.locator('.sub').first()).toHaveText('Soc has 2 completions.');
      // The timer turns to the success colour, which is `--ok` and therefore a
      // different rgb per theme; it is compared with the title, which is styled
      // from the same token, instead of with a literal.
      expect(
        await penalty.locator('.timer span').evaluate((el) => getComputedStyle(el).color)
      ).toBe(await penalty.locator('strong').evaluate((el) => getComputedStyle(el).color));
      await expect(page.locator('.quest .row .sub')).toHaveText('4/5');
      await expect(page.locator('.sys p span').first()).toHaveText(
        'Penalty cleared. Finish the remaining stats.'
      );
    },
  },
  {
    name: 'buy Main game 2 jam',
    slug: 'buy-reward',
    async act(page) {
      await page.locator('.rewards .rw').first().locator('.btn').click();
    },
    async assertEngine(page, before) {
      const cost = before.rewardCost;
      const wallet = before.wallet - cost;

      expect(await number(page, WALLET)).toBe(wallet);

      // Buying the only affordable reward leaves a single locked row - the
      // dearest locked one, which the prototype's `teaser()` also keeps - with
      // what is still missing instead of a Buy button, and the panel's wallet
      // line agrees with the header chip.
      const rows = page.locator('.rewards .rw');

      await expect(rows).toHaveCount(1);
      await expect(rows.locator('.btn')).toHaveCount(0);

      const lockedCost = Number((await text(page, '.rewards .rw .pts')).replace(/[^\d]/g, ''));

      await expect(rows.locator('.sub')).toHaveText(`${lockedCost - wallet} more coins`);
      await expect(page.locator('.bottom .row .sub span')).toHaveText(String(wallet));
      await expect(page.locator('.toast')).toHaveClass(/show/);
      await expect(page.locator('.toast span')).toHaveText(`Main game 2 jam dibeli (−${cost})`);
    },
  },
];

test.use(CONTEXT_OPTIONS);

if (TODAY === undefined) {
  throw new Error('harness.ts no longer lists a today page');
}

for (const theme of THEMES) {
  test.describe(`today interactions @ 1280 ${theme}`, () => {
    test.use({ viewport: VIEWPORT });

    for (const scenario of scenarios) {
      test(scenario.name, async ({ browser }) => {
        const slugName = `today-1280-${theme}-${scenario.slug}`;

        const protoPage = await openPrototype(browser, TODAY, VIEWPORT, theme);
        const appPage = await openApp(browser, TODAY, VIEWPORT, theme);

        const before = await snapshot(appPage);

        await scenario.act(protoPage);
        await scenario.act(appPage);

        await protoPage.waitForTimeout(AFTER_MS);
        await appPage.waitForTimeout(AFTER_MS);

        // Park the cursor off the page on both sides. The clicked row keeps
        // `:hover` (a 3px translate and a lighter fill) for as long as the cursor
        // is over it, and which of the two pages is the foreground window when a
        // screenshot is taken decides whether that state is still painted. Moving
        // the cursor is done identically on both sides, so the settled state is
        // what is compared rather than where the pointer happened to be left.
        await protoPage.mouse.move(0, 0);
        await appPage.mouse.move(0, 0);
        await settleFrames(protoPage);
        await settleFrames(appPage);

        // The engine assertions run first because they read state that expires:
        // the toast hides itself eight seconds after the click, and taking four
        // full-page screenshots and two DOM walks afterwards takes longer than
        // that. The style walk goes before the screenshots for the same reason -
        // it must see the same toast state the prototype is in.
        await scenario.assertEngine(appPage, before);

        const A = await protoPage.evaluate(collect);
        const B = await appPage.evaluate(collect);
        const problems = compareStyleReports(A, B);

        writeArtifact(
          slugName,
          'style-report.txt',
          Buffer.from(
            [
              `page today @ 1280x800 ${theme} after "${scenario.name}"`,
              `prototype ${A.length} elements, app ${B.length} elements`,
              '',
              ...problems,
            ].join('\n') + '\n',
            'utf8'
          )
        );

        console.log(
          `[today/${scenario.slug}] ${theme} style problems: ${
            problems.length === 0 ? 'none' : 'see style-report.txt'
          }`
        );

        expect(problems, problems.join('\n')).toEqual([]);

        const a = await fullPagePng(protoPage);
        const b = await fullPagePng(appPage);

        writeArtifact(slugName, 'prototype.png', PNG.sync.write(a));
        writeArtifact(slugName, 'app.png', PNG.sync.write(b));
        writeArtifact(slugName, 'side-by-side.png', PNG.sync.write(sideBySide(a, b)));

        const note = overlapNote(a, b);

        console.log(
          `[today/${scenario.slug}] ${theme} prototype ${a.width}x${a.height} ` +
            `app ${b.width}x${b.height} | ${note}`
        );

        expect(
          { w: a.width, h: a.height },
          `page dimensions must match the prototype after "${scenario.name}"; ${note}`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio, diff } = comparePixels(a, b);

        writeArtifact(slugName, 'diff.png', PNG.sync.write(diff as PNG));
        console.log(
          `[today/${scenario.slug}] ${theme} diff ratio ${(ratio * 100).toFixed(3)}% ` +
            `(threshold ${(MAX_DIFF_RATIO * 100).toFixed(3)}%)`
        );

        expect(
          ratio,
          `diff ratio ${(ratio * 100).toFixed(3)}% over ${a.width}x${a.height} after "${scenario.name}"`
        ).toBeLessThanOrEqual(MAX_DIFF_RATIO);

        await protoPage.context().close();
        await appPage.context().close();
      });
    }
  });
}
