import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared machinery for every Playwright spec in this directory.
 *
 * Nothing here decides pass or fail except the specs themselves; this module
 * only makes both sides render under identical conditions and turns raw images
 * and DOM walks into text a human can act on.
 */

export const APP = process.env.APP_URL ?? 'http://localhost:4173';
export const PROTO = process.env.PROTO_URL ?? 'http://localhost:4174';

/** Must match FIXED_NOW in src/lib/fixtures/data.ts and scripts/dump-history-fixture.mjs. */
export const FIXED_TIME = new Date('2026-10-15T09:00:00+07:00');

/** 0.1% of pixels. Lower it towards 0 as each page comes up to spec. */
export const MAX_DIFF_RATIO = Number(process.env.MAX_DIFF_RATIO ?? 0.001);

export const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

export type Viewport = (typeof VIEWPORTS)[number];

/**
 * One row per page: the fixture name, the prototype file, the hash route and
 * the first `h1`/`h2` the prototype shows inside `<main>`. The heading is
 * asserted by `health.spec.ts` only, so a wrong route fails as a health problem
 * and never hides a pixel ratio.
 */
export const PAGES = [
  { name: 'today', proto: 'today.html', route: 'today', heading: 'Stat' },
  { name: 'tasks', proto: 'tasks.html', route: 'tasks', heading: 'Task library' },
  { name: 'rewards', proto: 'rewards.html', route: 'rewards', heading: 'Rewards' },
  { name: 'history', proto: 'history.html', route: 'history', heading: 'History' },
  { name: 'settings', proto: 'settings.html', route: 'settings', heading: 'Settings' },
] as const;

export type PageSpec = (typeof PAGES)[number];

export function protoUrl(p: PageSpec, state: string | null = null): string {
  return `${PROTO}/${p.proto}${state === null ? '' : `?state=${state}`}`;
}

/**
 * The two themes the token blocks cover. Both sides are always rendered in the
 * same one, because `[data-theme=light]` changes the header's colours, its
 * background and its hairline, not just a page's body text.
 */
export const THEMES = ['dark', 'light'] as const;

export type Theme = (typeof THEMES)[number];

/**
 * The query string must sit before the hash. With `/#/tasks?fixture=tasks` the
 * parameter lands inside the fragment, the router never matches the route and
 * falls back to the default page.
 */
export function appUrl(p: PageSpec, state: string | null = null): string {
  return `${APP}/?fixture=${p.name}${state === null ? '' : `&state=${state}`}#/${p.route}`;
}

export function slug(p: PageSpec, vp: Viewport): string {
  return `${p.name}-${vp.width}`;
}

const FONT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'fonts');

type FontEntry = { family: string; weight: number; file: string };

const FONTS: FontEntry[] = (
  JSON.parse(readFileSync(join(FONT_DIR, 'manifest.json'), 'utf8')) as {
    fonts: FontEntry[];
  }
).fonts.map(({ family, weight, file }) => ({ family, weight, file }));

/** Inlined so the app and the prototype never reach for a Google Fonts network call. */
export const FONT_CSS = FONTS.map(
  ({ family, weight, file }) =>
    `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:block;src:url(${PROTO}/__fonts__/${file}) format('woff2')}`
).join('\n');

export const CONTEXT_OPTIONS = {
  reducedMotion: 'reduce',
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
  colorScheme: 'dark',
} as const;

/**
 * Chromium flags every run shares.
 *
 * `--disable-lcd-text`, `--disable-font-subpixel-positioning` and
 * `--font-render-hinting=none` pin text rasterisation; without them a glyph can
 * land on either side of a subpixel boundary depending on which thread rastered
 * the tile. `--force-device-scale-factor=1` stops a stray DPR from rescaling
 * everything. Together these removed most of the residual jitter the self-test
 * was written to catch. See `selftest.spec.ts`.
 */
export const CHROMIUM_ARGS = [
  '--disable-lcd-text',
  '--disable-font-subpixel-positioning',
  '--font-render-hinting=none',
  '--force-device-scale-factor=1',
];

/**
 * Long enough for every staggered animation in every prototype to have reached
 * its end state.
 *
 * `prefers-reduced-motion: reduce` collapses the durations to 1ms but leaves
 * `animation-delay` alone, and the prototypes stagger up to ~1.2s
 * (`calc(var(--i) * var(--stagger) + 1200ms)`, `.mk` at `1s + var(--d) * 20ms`).
 * Screenshotting inside those delay windows is what made `selftest.spec.ts`
 * fail: `animations: 'disabled'` then finished them at capture time, and the
 * resulting rasterisation of the filtered, backdrop-blurred panels jittered by
 * one least-significant bit on a few pixels between two identical runs. Letting
 * the page settle first is the fix.
 */
const SETTLE_MS = 2500;

/**
 * Determinism contract for both sides of every comparison:
 *   - the clock is frozen before navigation, so `Date` cannot differ;
 *   - the Google Fonts request is replaced with the same local woff2 bytes;
 *   - animations are collapsed by `prefers-reduced-motion` and then given
 *     `SETTLE_MS` to reach their end state, so the screenshot freezes nothing;
 *   - `#fx` (particle canvas), `.scan` (the sweep) and `#demo` (the
 *     prototype-only demo button) are display:none;
 *   - fonts are awaited and a frame is committed before capture.
 */
export async function open(page: Page, url: string): Promise<void> {
  await page.clock.setFixedTime(FIXED_TIME);

  // Same bytes the app bundles via @fontsource, so glyph metrics cannot drift.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ contentType: 'text/css', body: FONT_CSS })
  );

  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  // `#demo` is the prototype-only "Demo: buka title berikutnya" button in
  // settings.html (DEVIATIONS.md note 3). It is prototype affordance, not UI, so
  // it is hidden on both sides rather than diffed.
  await page.addStyleTag({ content: '#fx,.scan,#demo{display:none!important}' });
  await page.waitForTimeout(SETTLE_MS);
  // The app mounts after a dynamic import, so on a slow run the settle window can
  // start before its first panel exists. Wait for the page to have content and for
  // every staggered `.boot` entrance to reach its end state, then for the finite
  // transitions (the XP bar's width). The prototype already has both.
  await page.waitForFunction(
    () => (document.querySelector('main')?.children.length ?? 0) > 0,
    undefined,
    { timeout: 10000 }
  );
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.boot')].every(
        (element) => getComputedStyle(element).opacity === '1'
      ),
    undefined,
    { timeout: 10000 }
  );
  await settleFiniteAnimations(page);
  await settleFrames(page);
}

/**
 * Waits for every finite CSS animation and transition to reach its end state.
 *
 * The settle window is long enough for all of them on a warm page, but the app
 * mounts from a dynamic import, so on a cold or slow run the XP bar's width
 * transition can still be in flight at the end of it. The prototype and the app
 * would then be read at different points of the same transition. Infinite
 * animations (the caret, the bracket breathe) never finish, so they are skipped;
 * a timeout keeps a broken animation from hanging the harness.
 */
async function settleFiniteAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getTiming();

      return timing !== undefined && timing.iterations !== Infinity;
    });

    await Promise.race([
      Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
  });
}

/** Two committed frames: a style change is only guaranteed painted after one. */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
}

/**
 * A fresh context per page under test. Contexts never share storage or caches,
 * which is what lets the self-test treat two runs as independent.
 *
 * `theme` is seeded with `addInitScript`, which runs before any page script on
 * every navigation. That has to happen on the context rather than after
 * `goto`, for two reasons: the prototype reads `daily-tracker:theme` in a
 * blocking head script, so navigating without the value would paint dark and
 * then never repaint; and the app reads the same key in the equivalent head
 * script in `index.html`, plus `src/lib/fixtures/` clears storage afterwards
 * (it re-applies a theme it finds, which is why seeding before is enough).
 *
 * The value written is the raw `light` / `dark` the prototypes themselves read.
 */
export async function newIsolatedContext(
  browser: Browser,
  vp: Viewport,
  theme: Theme = 'dark'
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    ...CONTEXT_OPTIONS,
  });

  await context.addInitScript((value) => {
    try {
      localStorage.setItem('daily-tracker:theme', value);
    } catch {
      // A storage-less context still renders; both sides fall back to dark.
    }
  }, theme);

  return context;
}

export async function openPrototype(
  browser: Browser,
  p: PageSpec,
  vp: Viewport,
  theme: Theme = 'dark',
  state: string | null = null
): Promise<Page> {
  const context = await newIsolatedContext(browser, vp, theme);
  const page = await context.newPage();

  await open(page, protoUrl(p, state));

  return page;
}

export async function openApp(
  browser: Browser,
  p: PageSpec,
  vp: Viewport,
  theme: Theme = 'dark',
  state: string | null = null
): Promise<Page> {
  const context = await newIsolatedContext(browser, vp, theme);
  const page = await context.newPage();

  await open(page, appUrl(p, state));

  return page;
}

/**
 * Full-page capture by scrolling, not by `fullPage: true`.
 *
 * `fullPage` asks Chromium to raster beyond the viewport. Every prototype paints
 * a `position: fixed` background (`body::before` gradients, `body::after`
 * vignette) plus a `backdrop-filter` on each panel, and beyond-viewport capture
 * resizes those fixed layers per capture. That path was measurably
 * non-deterministic: two identical loads of `rewards.html` at 390x844 differed
 * by 12,978 pixels (1.7%) with the same geometry, purely because the fixed
 * gradient layer was rastered with a different dither.
 *
 * Scrolling and stitching gives the same full-page image with one difference:
 * fixed and sticky chrome is drawn where it sits at each scroll offset, which
 * is exactly what a reader scrolling the page sees. It is also deterministic.
 * Both sides of every comparison go through this function, so the diff stays
 * apples-to-apples.
 */
export async function captureFullPage(page: Page): Promise<PNG> {
  const viewport = page.viewportSize();
  const vw = viewport?.width ?? 1280;
  const vh = viewport?.height ?? 800;

  const doc = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));

  const width = Math.max(doc.width, vw);
  const height = Math.max(doc.height, vh);
  const out = new PNG({ width, height });

  for (let y = 0; y < height; y += vh) {
    // Clamp the last slice so the tail of a tall page is still captured.
    const scrollY = Math.min(y, Math.max(0, height - vh));

    await page.evaluate((v) => window.scrollTo(0, v), scrollY);
    await settleFrames(page);

    const slice = PNG.sync.read(await page.screenshot({ animations: 'disabled' }));

    for (let row = 0; row < slice.height && scrollY + row < height; row++) {
      const from = row * slice.width * 4;
      const to = (scrollY + row) * width * 4;
      const span = Math.min(slice.width, width) * 4;

      slice.data.copy(out.data, to, from, from + span);
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));

  return out;
}

export async function fullPagePng(page: Page): Promise<PNG> {
  return captureFullPage(page);
}

/**
 * Captures one element by selector, for region tests.
 *
 * The header sits at the top of both pages, so `scrollIntoViewIfNeeded` is a
 * no-op in practice and the capture comes straight out of the viewport
 * compositor. It goes through the same `open()` context as the full-page path
 * (frozen clock, local fonts, `#fx` and `.scan` hidden, reduced motion, settle
 * time), so a region diff and a page diff are cut from the same cloth.
 */
export async function captureRegion(page: Page, selector: string): Promise<PNG> {
  const el = page.locator(selector).first();

  if ((await el.count()) === 0) {
    throw new Error(`captureRegion: no element matches ${selector}`);
  }

  await el.scrollIntoViewIfNeeded();
  await settleFrames(page);

  return PNG.sync.read(await el.screenshot({ animations: 'disabled' }));
}

/* ------------------------------------------------------------------ pixels */

/**
 * The harness's own definition of "a pixel differs": pixelmatch's default YIQ
 * tolerance. The fidelity check has always used it, so the self-test uses the
 * same yardstick rather than a stricter one the browser cannot meet.
 */
export const PIXEL_THRESHOLD = 0.1;

/**
 * Ceiling on the *exact* mismatch ratio in the self-test.
 *
 * With `PIXEL_THRESHOLD` the self-test is insensitive to one least-significant
 * bit of colour on an anti-aliased edge, which is all that is left over after
 * the settle window and the Chromium flags. That bit is measurable but it is
 * Chromium rasteriser jitter, not page behaviour, so it gets a budget instead
 * of a veto. Real non-determinism - a particle that slipped past `#fx`, a timer
 * that repainted - moves whole regions and blows straight through this.
 */
export const SELF_TEST_MAX_EXACT_RATIO = 0.01;

export type PixelResult = {
  ratio: number;
  bad: number;
  total: number;
  /** Only meaningful when both images share their dimensions. */
  diff: PNG | null;
};

/**
 * Compares two full-page screenshots. Dimensions are deliberately *not* the
 * caller's problem: callers assert them first, and a size mismatch yields
 * `diff: null` rather than a misleading overlap ratio.
 */
export function comparePixels(a: PNG, b: PNG, threshold = 0.1): PixelResult {
  if (a.width !== b.width || a.height !== b.height) {
    return { ratio: NaN, bad: NaN, total: a.width * a.height, diff: null };
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold });

  return { ratio: bad / (a.width * a.height), bad, total: a.width * a.height, diff };
}

/** Top-left copy of `src` clipped to `w` x `h`. */
function crop(src: PNG, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h });

  for (let y = 0; y < h; y++) {
    src.data.copy(out.data, y * w * 4, y * src.width * 4, y * src.width * 4 + w * 4);
  }

  return out;
}

/**
 * Mismatch ratio over the region both images have in common, i.e. over
 * `min(width) x min(height)` from the top-left corner.
 *
 * INFORMATIONAL ONLY. A size mismatch is always the finding: reporting an
 * overlap ratio as a pass/fail number would let a page of the right size but
 * the wrong content pass, and would let a wrong-size page hide behind a small
 * ratio. This number only helps a human judge *how* two mismatched things
 * differ, so no test may branch on it.
 */
export function overlapRatio(a: PNG, b: PNG, threshold = PIXEL_THRESHOLD): number {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);

  if (width === 0 || height === 0) return NaN;

  const bad = pixelmatch(
    crop(a, width, height).data,
    crop(b, width, height).data,
    new PNG({ width, height }).data,
    width,
    height,
    { threshold }
  );

  return bad / (width * height);
}

/** The one-line form of `overlapRatio`, safe to paste into a failure message. */
export function overlapNote(a: PNG, b: PNG, threshold = PIXEL_THRESHOLD): string {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const ratio = overlapRatio(a, b, threshold);

  if (Number.isNaN(ratio)) {
    return `overlap region min(${a.width},${b.width}) x min(${a.height},${b.height}) is empty (informational, not used for pass/fail)`;
  }

  return (
    `overlap ratio ${(ratio * 100).toFixed(3)}% over min(w)=${width} x min(h)=${height} ` +
    `(informational, not used for pass/fail)`
  );
}

/** Prototype on the left, app on the right, on a neutral background. */
export function sideBySide(a: PNG, b: PNG): PNG {
  const gap = 12;
  const width = a.width + gap + b.width;
  const height = Math.max(a.height, b.height);
  const out = new PNG({ width, height });

  out.data.fill(0x20);

  const blit = (src: PNG, x: number): void => {
    const rows = Math.min(src.height, height);

    for (let y = 0; y < rows; y++) {
      const from = y * src.width * 4;
      const to = (y * width + x) * 4;

      src.data.copy(out.data, to, from, from + src.width * 4);
    }
  };

  blit(a, 0);
  blit(b, a.width + gap);

  return out;
}

/** Writes the raw bytes a comparison would otherwise only attach. */
export function writeArtifact(slugName: string, name: string, body: Buffer): string {
  const dir = resolve('test-results', 'visual', slugName);

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), body);

  return join('test-results', 'visual', slugName, name);
}

/* ------------------------------------------------------------------ styles */

export type StyleEntry = { path: string; st: Record<string, string> };

/**
 * Runs inside the browser: must stay serialisable and closure-free. Playwright
 * ships `fn.toString()`, so this cannot close over anything in this module.
 *
 * `rootSelector` narrows the walk to one subtree (the header, in
 * `shell.spec.ts`). It travels as the `page.evaluate` argument, which is how a
 * serialised function receives it. A selector that matches nothing yields an
 * empty report rather than a crash, so the caller's dimension assertion is
 * always the first thing it sees.
 */
export function collect(rootSelector = 'body'): StyleEntry[] {
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

  const out: StyleEntry[] = [];

  const walk = (el: Element, parent: string): void => {
    if (SKIP.includes(el.tagName)) return;

    const cn = typeof el.className === 'string' ? norm(el.className) : '';
    const label = `${el.tagName.toLowerCase()}${cn ? '.' + cn.split(' ').join('.') : ''}`;
    const path = parent === '' ? label : `${parent}>${label}`;
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

  walk(document.querySelector(rootSelector) ?? document.body, '');

  return out;
}

const MAX_PATHS_LISTED = 10;
const MAX_PROPS_PER_ELEMENT = 5;
const MAX_ELEMENTS_LISTED = 30;

function counts(entries: StyleEntry[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const e of entries) map.set(e.path, (map.get(e.path) ?? 0) + 1);

  return map;
}

/** Class names carried by each path segment, de-duplicated per element. */
function classNames(entries: StyleEntry[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const e of entries) {
    const seen = new Set<string>();

    for (const segment of e.path.split('>')) {
      const dots = segment.split('.').slice(1);

      for (const c of dots) {
        if (c) seen.add(`.${c}`);
      }
    }

    for (const c of seen) map.set(c, (map.get(c) ?? 0) + 1);
  }

  return map;
}

function onlyIn(a: Map<string, number>, b: Map<string, number>): string[] {
  const out: string[] = [];

  for (const [key, n] of a) {
    if (b.has(key)) continue;
    out.push(`${key} (x${n})`);
  }

  return out;
}

function listClassNames(names: string[]): string {
  if (names.length === 0) return '    (none)';

  const shown = names.slice(0, 20);

  return `    ${shown.join(', ')}${names.length > shown.length ? `, ... +${names.length - shown.length} more` : ''}`;
}

/**
 * Structural report. Used whenever the two trees are not aligned, so it never
 * compares by index: both sides are reduced to a path -> count multiset and
 * every difference is listed, instead of stopping at the first break.
 */
export function compareStructure(A: StyleEntry[], B: StyleEntry[]): string[] {
  const lines: string[] = [];
  const ca = counts(A);
  const cb = counts(B);

  lines.push(
    'STRUCTURAL MISMATCH (the two DOM trees are not aligned, so styles were not compared)'
  );
  lines.push(`  prototype elements: ${A.length}`);
  lines.push(`  app elements:       ${B.length}`);
  lines.push(
    `  delta:              ${A.length === B.length ? '0' : A.length > B.length ? `prototype +${A.length - B.length}` : `app +${B.length - A.length}`}`
  );
  lines.push('');
  lines.push(`first ${MAX_PATHS_LISTED} DOM paths that differ:`);

  const differing: string[] = [];

  for (const [path, n] of ca) {
    if ((cb.get(path) ?? 0) !== n)
      differing.push(`    ${path}  prototype x${n}  app x${cb.get(path) ?? 0}`);
  }

  for (const [path, n] of cb) {
    if ((ca.get(path) ?? 0) !== n)
      differing.push(`    ${path}  prototype x${ca.get(path) ?? 0}  app x${n}`);
  }

  if (differing.length === 0) lines.push('    (none: same paths, different counts)');

  const shownPaths = differing.slice(0, MAX_PATHS_LISTED);

  lines.push(...shownPaths);

  if (differing.length > shownPaths.length) {
    lines.push(`    ... +${differing.length - shownPaths.length} more differing paths`);
  }

  lines.push('');
  lines.push('class names only on the prototype side (elements carrying them):');
  lines.push(listClassNames(onlyIn(classNames(A), classNames(B))));
  lines.push('');
  lines.push('class names only on the app side (elements carrying them):');
  lines.push(listClassNames(onlyIn(classNames(B), classNames(A))));

  return lines;
}

function pseudoKeys(st: Record<string, string>): string[] {
  return Object.keys(st).filter((k) => k.startsWith('::'));
}

/**
 * The page-local keyframe renames (UI Revamp Issue 2), listed in
 * `docs/prototype/DEVIATIONS.md` under "Mechanical renames".
 *
 * `@keyframes` names are global CSS, so the five prototypes' identical names for
 * five different animations cannot share one global stylesheet: the app's page
 * keyframes carry a `today-` prefix and the animation bodies are the
 * prototype's, unchanged. `computedStyle.animationName` therefore reports a
 * different identifier for the same animation, so both sides are un-prefixed
 * before they are compared. Nothing else in a computed style contains these
 * tokens, and no other value is touched.
 */
const KEYFRAME_RENAMES = ['spin', 'shine', 'blink', 'pen', 'pulse', 'fl', 'rg'];

function unrenameKeyframes(value: string): string {
  return value.replace(new RegExp(`\\btoday-(${KEYFRAME_RENAMES.join('|')})\\b`, 'g'), '$1');
}

/** Style report for two trees that line up element for element. */
/**
 * Chromium serialises a finished entrance differently depending on whether the
 * animation was still on the compositor when the style was read: the end of
 * `transform: none` can come back as the identity matrix, and the end of
 * `filter: none` as `blur(0px)`. Both are pixel-identical to `none`, so they
 * are compared as such; a real transform or a non-zero blur still differs.
 */
function normaliseIdentity(value: string): string {
  if (value === 'matrix(1, 0, 0, 1, 0, 0)') return 'none';
  if (value === 'blur(0px)') return 'none';

  return value;
}

export function compareStyles(A: StyleEntry[], B: StyleEntry[]): string[] {
  const lines: string[] = [];
  const problems: { path: string; found: string[] }[] = [];

  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const a = A[i];
    const b = B[i];

    if (a === undefined || b === undefined) break;

    const found: string[] = [];
    const pa = new Set(pseudoKeys(a.st));
    const pb = new Set(pseudoKeys(b.st));
    const onlyA = [...pa].filter((k) => !pb.has(k));
    const onlyB = [...pb].filter((k) => !pa.has(k));

    if (onlyA.length > 0 || onlyB.length > 0) {
      const names = (list: string[]): string =>
        list.length === 0 ? '-' : list.map((k) => k.replace(/[a-zA-Z]+$/, '')).join('+');

      found.push(`::before/::after  prototype ${names(onlyA)} / app ${names(onlyB)}`);
    }

    const shared = Object.keys(a.st).filter((k) => !k.startsWith('::'));

    for (const k of shared) {
      const left = normaliseIdentity(unrenameKeyframes(a.st[k]));
      const right = normaliseIdentity(unrenameKeyframes(b.st[k]));

      if (left !== right) {
        found.push(`[${k}] ${left || '(empty)'} -> ${right || '(empty)'}`);
      }
    }

    if (found.length === 0) continue;

    problems.push({ path: a.path, found });
  }

  if (problems.length === 0) return [];

  lines.push(`STYLE MISMATCHES in ${problems.length} of ${A.length} elements (aligned)`);
  lines.push(
    `(at most ${MAX_PROPS_PER_ELEMENT} properties per element, ${MAX_ELEMENTS_LISTED} elements listed)`
  );
  lines.push('');

  const width = Math.max(...problems.map((p) => p.path.length));

  for (const p of problems.slice(0, MAX_ELEMENTS_LISTED)) {
    for (const f of p.found.slice(0, MAX_PROPS_PER_ELEMENT)) {
      lines.push(`  ${p.path.padEnd(width)}  ${f}`);
    }

    if (p.found.length > MAX_PROPS_PER_ELEMENT) {
      lines.push(
        `  ${p.path.padEnd(width)}  ... +${p.found.length - MAX_PROPS_PER_ELEMENT} more properties`
      );
    }
  }

  if (problems.length > MAX_ELEMENTS_LISTED) {
    lines.push('');
    lines.push(`  ... +${problems.length - MAX_ELEMENTS_LISTED} more elements with differences`);
  }

  return lines;
}

/**
 * Picks the right report: element-for-element styles when the trees line up, a
 * structural summary when they do not. Returns an empty array when they match.
 */
export function compareStyleReports(A: StyleEntry[], B: StyleEntry[]): string[] {
  const aligned = A.length === B.length && A.every((a, i) => a.path === B[i]?.path);

  return aligned ? compareStyles(A, B) : compareStructure(A, B);
}
