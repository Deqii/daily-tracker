import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prototype-vs-app fidelity check (UI Revamp Issue 0).
 *
 * Two complementary assertions per page and viewport:
 *   1. pixel diff, full-page screenshots compared with pixelmatch;
 *   2. computed-style diff, both DOM trees walked in parallel.
 *
 * Fix the app, not this file. Every threshold here is a starting point; tighten
 * `MAX_DIFF_RATIO` to 0 as pages come up to spec.
 */

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const PROTO = process.env.PROTO_URL ?? 'http://localhost:4174';

/** Must match FIXED_NOW in src/lib/fixtures/data.ts and scripts/dump-history-fixture.mjs. */
const FIXED_TIME = new Date('2026-10-15T09:00:00+07:00');

/** 0.1% of pixels. Lower it towards 0 as each page passes. */
const MAX_DIFF_RATIO = Number(process.env.MAX_DIFF_RATIO ?? 0.001);

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

const PAGES = [
  { name: 'today', proto: 'today.html', route: '/#/today' },
  { name: 'tasks', proto: 'tasks.html', route: '/#/tasks' },
  { name: 'rewards', proto: 'rewards.html', route: '/#/rewards' },
  { name: 'history', proto: 'history.html', route: '/#/history' },
  { name: 'settings', proto: 'settings.html', route: '/#/settings' },
] as const;

const FONT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'fonts');

type FontEntry = { family: string; weight: number; file: string };

const FONTS: FontEntry[] = (
  JSON.parse(readFileSync(join(FONT_DIR, 'manifest.json'), 'utf8')) as {
    fonts: FontEntry[];
  }
).fonts.map(({ family, weight, file }) => ({ family, weight, file }));

const FONT_CSS = FONTS.map(
  ({ family, weight, file }) =>
    `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:block;src:url(${PROTO}/__fonts__/${file}) format('woff2')}`
).join('\n');

const CONTEXT_OPTIONS = {
  reducedMotion: 'reduce',
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
  colorScheme: 'dark',
} as const;

test.use(CONTEXT_OPTIONS);

async function open(page: Page, url: string, isPrototype: boolean): Promise<void> {
  await page.clock.setFixedTime(FIXED_TIME);

  if (isPrototype) {
    // Same bytes the app bundles via @fontsource, so glyph metrics cannot drift.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
      route.fulfill({ contentType: 'text/css', body: FONT_CSS })
    );
  }

  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '#fx,.scan{display:none!important}' });
  await page.waitForTimeout(150);
}

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test.describe(`${p.name} @ ${vp.width}`, () => {
      test.use({ viewport: vp });

      test('pixel diff', async ({ page, browser }) => {
        const context = await browser.newContext({ viewport: vp, ...CONTEXT_OPTIONS });
        const protoPage = await context.newPage();

        await open(protoPage, `${PROTO}/${p.proto}`, true);
        await open(page, `${APP}${p.route}?fixture=${p.name}`, false);

        const a = PNG.sync.read(
          await protoPage.screenshot({ fullPage: true, animations: 'disabled' })
        );
        const b = PNG.sync.read(await page.screenshot({ fullPage: true, animations: 'disabled' }));

        // Compare the overlapping area so a height difference still reports a ratio.
        const width = Math.min(a.width, b.width);
        const height = Math.min(a.height, b.height);

        const diff = new PNG({ width, height });
        const bad = pixelmatch(
          a.data.subarray(0, width * height * 4),
          b.data.subarray(0, width * height * 4),
          diff.data,
          width,
          height,
          { threshold: 0.1 }
        );
        const ratio = bad / (width * height);

        await test.info().attach('prototype.png', {
          body: PNG.sync.write(a),
          contentType: 'image/png',
        });
        await test.info().attach('app.png', {
          body: PNG.sync.write(b),
          contentType: 'image/png',
        });
        await test.info().attach('diff.png', {
          body: PNG.sync.write(diff),
          contentType: 'image/png',
        });

        expect(
          ratio,
          `diff ratio ${(ratio * 100).toFixed(3)}% over ${width}x${height}`
        ).toBeLessThanOrEqual(MAX_DIFF_RATIO);

        expect(
          { w: a.width, h: a.height },
          `page dimensions must match the prototype (prototype ${a.width}x${a.height}, app ${b.width}x${b.height})`
        ).toEqual({ w: b.width, h: b.height });
      });

      test('computed-style diff', async ({ page, browser }) => {
        const context = await browser.newContext({ viewport: vp, ...CONTEXT_OPTIONS });
        const protoPage = await context.newPage();

        await open(protoPage, `${PROTO}/${p.proto}`, true);
        await open(page, `${APP}${p.route}?fixture=${p.name}`, false);

        const A = await protoPage.evaluate(collect);
        const B = await page.evaluate(collect);

        const problems: string[] = [];

        if (A.length !== B.length) {
          problems.push(`element count differs: prototype ${A.length}, app ${B.length}`);
        }

        for (let i = 0; i < Math.min(A.length, B.length) && problems.length < 40; i++) {
          const a = A[i];
          const b = B[i];

          if (a === undefined || b === undefined) break;

          if (a.path !== b.path) {
            problems.push(`#${i} structure: "${a.path}" vs "${b.path}"`);
            break;
          }

          for (const k of Object.keys(a.st)) {
            if (a.st[k] !== b.st[k]) {
              problems.push(`#${i} ${a.path} [${k}] ${a.st[k]} -> ${b.st[k]}`);
            }
          }
        }

        await test
          .info()
          .attach('style-report.txt', { body: problems.join('\n'), contentType: 'text/plain' });

        expect(problems, problems.join('\n')).toEqual([]);
      });
    });
  }
}

/** Runs inside the browser: must stay serialisable and closure-free. */
function collect(): { path: string; st: Record<string, string> }[] {
  const PROPS = [
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'width',
    'height',
    'margin',
    'padding',
    'border',
    'borderRadius',
    'backgroundColor',
    'backgroundImage',
    'backgroundSize',
    'backgroundPosition',
    'color',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'textDecoration',
    'opacity',
    'transform',
    'boxShadow',
    'filter',
    'backdropFilter',
    'gap',
    'gridTemplateColumns',
    'flexDirection',
    'alignItems',
    'justifyContent',
    'overflow',
    'zIndex',
    'cursor',
    'animationName',
    'animationDuration',
    'animationDelay',
    'animationTimingFunction',
    'animationIterationCount',
    'animationFillMode',
    'transitionProperty',
    'transitionDuration',
    'transitionTimingFunction',
  ];

  const SKIP = ['SCRIPT', 'STYLE', 'CANVAS', 'LINK', 'META', 'TITLE', 'HEAD'];

  const norm = (c: string): string =>
    c
      .replace(/\bsvelte-[a-z0-9]+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const out: { path: string; st: Record<string, string> }[] = [];

  const walk = (el: Element, parent: string): void => {
    if (SKIP.includes(el.tagName)) return;

    const cn = typeof el.className === 'string' ? norm(el.className) : '';
    const path = `${parent}>${el.tagName.toLowerCase()}${cn ? '.' + cn.split(' ').join('.') : ''}`;
    const cs = getComputedStyle(el);
    const st: Record<string, string> = {};

    for (const k of PROPS) st[k] = (cs as unknown as Record<string, string>)[k] ?? '';

    for (const ps of ['::before', '::after']) {
      const c = getComputedStyle(el, ps);
      if (c.content !== 'none') {
        for (const k of PROPS) st[ps + k] = (c as unknown as Record<string, string>)[k] ?? '';
      }
    }

    out.push({ path, st });

    for (const child of Array.from(el.children)) walk(child, path);
  };

  walk(document.body, '');

  return out;
}
