import { expect, test } from './harness';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import {
  CONTEXT_OPTIONS,
  FIXED_TIME,
  MAX_DIFF_RATIO,
  PAGES,
  THEMES,
  appUrl,
  captureFullPage,
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
 * Settings interaction diffs (UI Revamp Issue 6).
 *
 * Each scenario performs the same action on the prototype and on the app, then
 * compares the settled page (pixels first, computed styles second) and asserts
 * the app state that the action drives. Import fixtures carry both the app's
 * `schemaVersion` shape and the prototype's `app`/`state` fields so the same
 * file reaches the same confirmation on both sides; the prototype's validation
 * is demo-only and is never copied.
 */

const VIEWPORT: Viewport = { width: 1280, height: 800 };
const SETTINGS: PageSpec | undefined = PAGES.find((page) => page.name === 'settings');

if (SETTINGS === undefined) {
  throw new Error('harness.ts no longer lists a settings page');
}

interface ScenarioContext {
  readonly validImport: Buffer;
  readonly changedImport: Buffer;
  readonly invalidImport: Buffer;
}

interface Scenario {
  readonly name: string;
  readonly slug: string;
  readonly keepsToast?: boolean;
  readonly act: (page: Page, context: ScenarioContext) => Promise<void>;
  readonly assertApp: (page: Page) => Promise<void>;
}

async function storedUserState(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('daily-tracker:userState');

    if (raw === null) throw new Error('userState is not persisted');

    return JSON.parse(raw) as Record<string, unknown>;
  });
}

async function importPayload(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const keys = [
      'tasks',
      'completions',
      'dailyQuestLog',
      'rewards',
      'rewardPurchases',
      'milestoneEvents',
    ] as const;
    const file: Record<string, unknown> = { app: 'daily-tracker', version: 1, schemaVersion: 2 };

    for (const key of keys)
      file[key] = JSON.parse(localStorage.getItem(`daily-tracker:${key}`) ?? 'null');

    const userState = JSON.parse(
      localStorage.getItem('daily-tracker:userState') ?? 'null'
    ) as Record<string, unknown>;

    file.userState = userState;
    file.state = {
      rank: userState.rank,
      lifetimeXP: userState.lifetimeXP,
      wallet: userState.wallet,
      equippedTitle: userState.equippedTitle,
      unlockedTitles: userState.unlockedTitles,
    };

    return file;
  });
}

function withWallet(file: Record<string, unknown>, wallet: number): Record<string, unknown> {
  const userState = file.userState as Record<string, unknown>;
  const state = file.state as Record<string, unknown>;

  return {
    ...file,
    userState: { ...userState, wallet },
    state: { ...state, wallet },
  };
}

async function blurActive(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

async function waitForImportOk(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('#ok') !== null, undefined, {
    timeout: 10000,
  });
}

const scenarios: readonly Scenario[] = [
  {
    name: 'switch theme',
    slug: 'theme',
    async act(page) {
      const current = await page.evaluate(() => document.documentElement.dataset.theme);
      const next = current === 'light' ? 'dark' : 'light';

      await page.locator(`#theme [data-v="${next}"]`).click();
      await page.waitForFunction(
        (value) => document.documentElement.dataset.theme === value,
        next,
        { timeout: 10000 }
      );
    },
    async assertApp(page) {
      const theme = await page.evaluate(() => ({
        attribute: document.documentElement.dataset.theme,
        stored: localStorage.getItem('daily-tracker:theme'),
        checked: document.querySelector('#theme [data-v="light"]')?.getAttribute('aria-checked'),
      }));

      expect(theme.attribute).toBe(theme.stored === '"dark"' ? 'dark' : 'light');
      expect(theme.checked).toBe(theme.attribute === 'light' ? 'true' : 'false');
    },
  },
  {
    name: 'switch animation off',
    slug: 'motion-off',
    async act(page) {
      await page.locator('#motion').click();
      await page.locator('#motion').click();
      await page.waitForFunction(
        () => document.documentElement.dataset.motion === 'off',
        undefined,
        { timeout: 10000 }
      );
    },
    async assertApp(page) {
      const state = await page.evaluate(() => {
        const canvas = document.getElementById('fx');
        const scan = document.querySelector('.scan');
        const bracket = document.querySelector('.panel')?.matches(':scope')
          ? getComputedStyle(document.querySelector('.panel') as Element, '::before')
          : null;
        const segment = document.querySelector('.seg button');

        return {
          motion: document.documentElement.dataset.motion,
          stored: localStorage.getItem('daily-tracker:motion'),
          canvas: canvas === null ? null : getComputedStyle(canvas).display,
          scan: scan === null ? null : getComputedStyle(scan).display,
          bracketDuration: bracket?.animationDuration,
          transitionDuration:
            segment === null ? null : getComputedStyle(segment).transitionDuration,
        };
      });

      expect(state.motion).toBe('off');
      expect(state.stored).toBe('"off"');
      expect(state.canvas).toBe('none');
      expect(state.scan).toBe('none');
      expect(state.bracketDuration).toBe('0.001s');
      expect(state.transitionDuration).toBe('0.001s');
    },
  },
  {
    name: 'turn sound effects on',
    slug: 'sound-on',
    async act(page) {
      await page.locator('#sound').click();
      await page.waitForFunction(
        () => document.querySelector('#sound')?.getAttribute('aria-checked') === 'true',
        undefined,
        { timeout: 10000 }
      );
    },
    async assertApp(page) {
      expect(await page.evaluate(() => localStorage.getItem('daily-tracker:sound'))).toBe('"on"');
      await expect(page.locator('#sound')).toHaveAttribute('aria-checked', 'true');
    },
  },
  {
    name: 'unequip the equipped title',
    slug: 'title-unequip',
    keepsToast: true,
    async act(page) {
      await page.locator('[data-t="first-reward"]').click();
      await page.waitForFunction(
        () => document.querySelector('#pv')?.textContent === 'No title',
        undefined,
        { timeout: 10000 }
      );
    },
    async assertApp(page) {
      const state = await storedUserState(page);

      expect(state.equippedTitle).toBeNull();
      await expect(page.locator('#pv')).toHaveText('No title');
      await expect(page.locator('[data-t="first-reward"]')).toHaveText('Equip');
    },
  },
  {
    name: 'equip a title',
    slug: 'title-equip',
    keepsToast: true,
    async act(page) {
      await page.locator('[data-t="first-reward"]').click();
      await page.waitForFunction(
        () => document.querySelector('#pv')?.textContent === 'No title',
        undefined,
        { timeout: 10000 }
      );
      await page.locator('[data-t="first-reward"]').click();
      await page.waitForFunction(
        () => document.querySelector('#pv')?.textContent === 'Hadiah pertama',
        undefined,
        { timeout: 10000 }
      );
    },
    async assertApp(page) {
      const state = await storedUserState(page);

      expect(state.equippedTitle).toBe('first-reward');
      await expect(page.locator('#pv')).toHaveText('Hadiah pertama');
      await expect(page.locator('[data-t="first-reward"]')).toHaveText('Unequip');
    },
  },
  {
    name: 'export data',
    slug: 'export',
    keepsToast: true,
    async act(page) {
      const download = page.waitForEvent('download');

      await page.locator('#exp').click();
      await download;
    },
    async assertApp(page) {
      await expect(page.locator('#bkT')).toHaveText('Last backup: just now');
      await expect(page.locator('#toast')).toHaveText('Data exported');
      expect(
        await page.evaluate(() => localStorage.getItem('daily-tracker:lastExportAt'))
      ).not.toBeNull();
    },
  },
  {
    name: 'import invalid JSON',
    slug: 'import-invalid',
    async act(page, context) {
      await page.locator('#file').setInputFiles({
        name: 'broken.json',
        mimeType: 'application/json',
        buffer: context.invalidImport,
      });
      await page.waitForFunction(() => document.querySelector('.msg.bad') !== null, undefined, {
        timeout: 10000,
      });
    },
    async assertApp(page) {
      await expect(page.locator('#impMsg .msg.bad')).toHaveText(
        'Import failed. The file is not valid JSON. Your data was not changed.'
      );
    },
  },
  {
    name: 'import valid file shows confirmation',
    slug: 'import-confirm',
    async act(page, context) {
      await page.locator('#file').setInputFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: context.validImport,
      });
      await waitForImportOk(page);
    },
    async assertApp(page) {
      await expect(page.locator('#impMsg')).toContainText(
        'Replace all current data with this file?'
      );
      await expect(page.locator('#impMsg')).toContainText('backup.json: Rank E, 65 XP.');
      expect((await storedUserState(page)).wallet).toBe(65);
    },
  },
  {
    name: 'cancel a valid import',
    slug: 'import-cancel',
    async act(page, context) {
      await page.locator('#file').setInputFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: context.validImport,
      });
      await waitForImportOk(page);
      await page.locator('#no').click();
      await page.waitForFunction(() => document.querySelector('#ok') === null, undefined, {
        timeout: 10000,
      });
    },
    async assertApp(page) {
      await expect(page.locator('#ok')).toHaveCount(0);
      expect((await storedUserState(page)).wallet).toBe(65);
    },
  },
];

async function render(
  browser: Parameters<typeof openPrototype>[0],
  theme: (typeof THEMES)[number],
  scenario: Scenario,
  context: ScenarioContext
) {
  const protoPage = await openPrototype(browser, SETTINGS, VIEWPORT, theme);
  const appPage = await openApp(browser, SETTINGS, VIEWPORT, theme);

  await protoPage.bringToFront();
  await scenario.act(protoPage, context);
  await appPage.bringToFront();
  await scenario.act(appPage, context);

  for (const page of [protoPage, appPage]) {
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, `settings after "${scenario.name}"`);
    await settleFrames(page);
    await blurActive(page);
  }

  return { protoPage, appPage };
}

test.use(CONTEXT_OPTIONS);

for (const theme of THEMES) {
  test.describe(`settings interactions @ 1280 ${theme}`, () => {
    test.use({ viewport: VIEWPORT });

    for (const scenario of scenarios) {
      test(scenario.name, async ({ browser }) => {
        const slugName = `settings-1280-${theme}-${scenario.slug}`;
        const seedPage = await openApp(browser, SETTINGS, VIEWPORT, theme);
        const payload = await importPayload(seedPage);
        const context: ScenarioContext = {
          validImport: Buffer.from(JSON.stringify(payload)),
          changedImport: Buffer.from(JSON.stringify(withWallet(payload, 123))),
          invalidImport: Buffer.from('{not json'),
        };
        const { protoPage, appPage } = await render(browser, theme, scenario, context);

        await scenario.assertApp(appPage);

        if (scenario.keepsToast === true) {
          // The toast lives 3.2s; a full-page capture can outlast that. Pin it
          // visible on both sides so the capture compares its content and
          // position instead of racing the timer.
          for (const page of [protoPage, appPage]) {
            await page.addStyleTag({
              content: '#toast{opacity:1!important;transform:translate(-50%,0)!important}',
            });
          }
        }

        const A = await protoPage.evaluate(collect);
        const B = await appPage.evaluate(collect);
        const problems = compareStyleReports(A, B);

        writeArtifact(
          slugName,
          'style-report.txt',
          Buffer.from(
            [
              `page settings @ 1280x800 ${theme} after "${scenario.name}"`,
              `prototype ${A.length} elements, app ${B.length} elements`,
              '',
              ...problems,
            ].join('\n') + '\n',
            'utf8'
          )
        );

        console.log(
          `[settings/${scenario.slug}] ${theme} style problems: ${
            problems.length === 0 ? 'none' : 'see style-report.txt'
          }`
        );

        expect(problems, problems.join('\n')).toEqual([]);

        const a = await captureFullPage(protoPage);
        const b = await captureFullPage(appPage);

        writeArtifact(slugName, 'prototype.png', PNG.sync.write(a));
        writeArtifact(slugName, 'app.png', PNG.sync.write(b));
        writeArtifact(slugName, 'side-by-side.png', PNG.sync.write(sideBySide(a, b)));

        const note = overlapNote(a, b);

        console.log(
          `[settings/${scenario.slug}] ${theme} prototype ${a.width}x${a.height} ` +
            `app ${b.width}x${b.height} | ${note}`
        );

        expect(
          { w: a.width, h: a.height },
          `page dimensions must match the prototype after "${scenario.name}"; ${note}`
        ).toEqual({ w: b.width, h: b.height });

        const { ratio, diff } = comparePixels(a, b);

        writeArtifact(slugName, 'diff.png', PNG.sync.write(diff as PNG));
        console.log(
          `[settings/${scenario.slug}] ${theme} diff ratio ${(ratio * 100).toFixed(3)}% ` +
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

test.describe('settings behaviour @ 1280 dark', () => {
  test.use({ viewport: VIEWPORT });

  test('the theme persists across a reload', async ({ browser }) => {
    // A plain context: the harness seeds the theme with an init script on every
    // navigation, which would overwrite the choice this test is reloading past.
    const context = await browser.newContext({ ...CONTEXT_OPTIONS, viewport: VIEWPORT });
    const page = await context.newPage();

    try {
      await page.clock.setFixedTime(FIXED_TIME);
      await page.goto(appUrl(SETTINGS));

      await page.locator('#theme [data-v="light"]').click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      await page.reload();
      await settle(page, 'settings after reload');

      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator('#theme [data-v="light"]')).toHaveAttribute('aria-checked', 'true');
    } finally {
      await context.close();
    }
  });

  test('export excludes the theme and is a real backup', async ({ browser }) => {
    const page = await openApp(browser, SETTINGS, VIEWPORT, 'dark');
    const downloadPromise = page.waitForEvent('download');

    await page.locator('#exp').click();

    const download = await downloadPromise;
    const path = await download.path();

    if (path === null) throw new Error('export produced no download path');

    const file = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;

    expect(download.suggestedFilename()).toBe('daily-tracker-2026-10-15.json');
    expect(file).not.toHaveProperty('theme');
    expect(file.schemaVersion).toBe(2);
    expect(file.userState).toMatchObject({ rank: 'E', lifetimeXP: 65 });

    const stored = await page.evaluate(() => localStorage.getItem('daily-tracker:lastExportAt'));

    expect(stored).not.toBeNull();
    expect(Number.isNaN(Date.parse(JSON.parse(stored ?? 'null') as string))).toBe(false);
  });

  test('a confirmed import replaces the live state', async ({ browser }) => {
    const page = await openApp(browser, SETTINGS, VIEWPORT, 'dark');
    const payload = withWallet(await importPayload(page), 123);

    await page.locator('#file').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    });
    await waitForImportOk(page);
    await page.locator('#ok').click();

    await expect(page.locator('#toast')).toHaveText('Import complete');
    await expect(page.locator('#ok')).toHaveCount(0);
    expect((await storedUserState(page)).wallet).toBe(123);
  });

  test('a confirmed import rejects a file missing state', async ({ browser }) => {
    const page = await openApp(browser, SETTINGS, VIEWPORT, 'dark');
    const payload = await importPayload(page);

    delete payload.userState;

    await page.locator('#file').setInputFiles({
      name: 'missing.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    });
    await page.waitForFunction(() => document.querySelector('.msg.bad') !== null);

    await expect(page.locator('#impMsg .msg.bad')).toHaveText(
      'Import failed. Some data is missing or invalid. Your data was not changed.'
    );
  });

  test('a confirmed import rejects a newer schema', async ({ browser }) => {
    const page = await openApp(browser, SETTINGS, VIEWPORT, 'dark');
    const payload = await importPayload(page);

    payload.schemaVersion = 3;

    await page.locator('#file').setInputFiles({
      name: 'newer.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    });
    await page.waitForFunction(() => document.querySelector('.msg.bad') !== null);

    await expect(page.locator('#impMsg .msg.bad')).toHaveText(
      'Import failed. The file is from a newer version. Your data was not changed.'
    );
  });

  test('equipping a title updates the Today page', async ({ browser }) => {
    const page = await openApp(browser, SETTINGS, VIEWPORT, 'dark');

    await page.locator('[data-t="first-reward"]').click();
    await page.waitForFunction(() => document.querySelector('#pv')?.textContent === 'No title');

    await page.goto('/?from=settings#/today');
    await page.locator('.status').waitFor();
    await expect(page.locator('.status .title')).toHaveCount(0);

    await page.goto('/?from=today#/settings');
    await page.locator('#pv').waitFor();
    await expect(page.locator('#pv')).toHaveText('No title');
    await page.locator('[data-t="first-reward"]').click();
    await expect(page.locator('#pv')).toHaveText('Hadiah pertama');

    await page.goto('/?from=settings2#/today');
    await page.locator('.status').waitFor();
    await expect(page.locator('.status .title')).toHaveText('Hadiah pertama');
  });

  test('keyboard activation reaches the theme and title controls', async ({ browser }) => {
    const page = await openApp(browser, SETTINGS, VIEWPORT, 'dark');

    await page.locator('#theme [data-v="light"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.locator('[data-t="first-reward"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pv')).toHaveText('No title');
  });
});
