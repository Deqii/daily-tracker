# UI Revamp: fidelity contract, issues, tests, and agent prompts

Place this file at `docs/UI-REVAMP.md`. Section 1 goes into `AGENTS.md`. Section 3 holds the tests. Sections 2 and 4 are the milestone issues and the prompts to paste into the agent.

Prototypes (the source of truth) live in `docs/prototype/`: `today.html`, `tasks.html`, `rewards.html`, `history.html`, `settings.html`.

---

## 1. Milestone "UI Revamp": issues

Each issue = one PR. Order matters: 0 → 1 → (2–6 in any order) → 7.

### Issue 0: Visual test harness and fixtures

- [ ] Add dev deps `pixelmatch`, `pngjs`; Playwright ≥ 1.45 (needs `page.clock`).
- [ ] Pin the Playwright Docker image (or a fixed OS and browser version) for local and CI runs, so rendering is deterministic.
- [ ] Copy the font files (`woff2`, latin) from `@fontsource/*` into `tests/visual/fonts/`.
- [ ] Fixtures: `?fixture=today|tasks|rewards|history|settings` (dev/test builds only, never in production) seeds `localStorage` and returns. Values are extracted from each prototype's script block (`T`, `R`, `L`, `MASKS`, `SX`, `TT`, ...).
- [ ] History fixture: run `history.html` in Playwright, dump `{ D, EV }` with `page.evaluate(() => ({ D, EV }))` to JSON, and store explicit per-day snapshots (`lifetimeXPEnd`, `levelEnd`, `rankEnd`, `netPointsChange`) plus rank events. Do **not** recompute them with the engine, because the prototype's simulation ignores gate, freeze, and 2x.
- [ ] Add the tests from §3 and the scripts `test:visual` and `test:visual:update`.
- Acceptance: the harness runs against the current (old) UI and fails with a readable diff.

### Issue 1: Foundation and app shell

- Prototype: header, background layers, and brackets, taken from any page (they are identical).
- [ ] Tokens in `src/app.css` (dark + light), `@fontsource` imports, global CSS from the prototype.
- [ ] Layers: grid/glow background, vignette, `#fx` particle canvas, `.scan` sweep.
- [ ] `.panel` with animated corner brackets, `.boot` entrance with `--i` stagger, reduced-motion and `data-motion` rules.
- [ ] Header: logo, nav (active underline), chips (Rank, Streak, Wallet with coin).
- [ ] Persist theme in `daily-tracker:theme` (not part of Export).
- Acceptance: header region diff on all five pages is 0 px at 1280 and 390.

### Issue 2: Today

- Prototype: `today.html`. Fixture: `today`.
- [ ] 3-column layout (status 320px | radar | quest 380px) and bottom strip (14-day heat + rewards).
- [ ] Status window: emblem, Rank, Level, equipped title, XP bar with shine, streak pips, freezes left.
- [ ] Radar with the balance-gate polygon (threshold from the engine: `ceil(sum/(2×count))`), stat chips.
- [ ] Quest rows with stat color, `need` counter for 2x, checkbox animation, ring burst, floating `+N XP`, undo toast.
- [ ] Penalty zone with live countdown to local midnight (clear state turns green).
- [ ] Typing system message; rewards teaser with Buy and the coin.
- Interactions to verify: complete a quest (radar morph, XP bar, wallet tween), undo, clear the penalty by completing Soc twice, buy a reward.

### Issue 3: Tasks

- Prototype: `tasks.html`. Fixture: `tasks`.
- [ ] 2-column stat groups, task cards with badges (Anchor / Rotating / Quest hari ini / Over cap), variant rows with tier colors and `+N XP`.
- [ ] Search plus stat and type filters; "Over cap" banner (count from the engine).
- [ ] Right-hand drawer (add/edit): stat radiogroup, anchor switch, three tier rows, live XP preview, validation messages (cap, integer ≥ 1, description required, at least one tier).
- [ ] Delete with slide-out and undo toast; flash and scroll-into-view after save; Esc closes; focus returns to the trigger.

### Issue 4: Rewards

- Prototype: `rewards.html`. Fixture: `rewards`.
- [ ] Card grid (gold = affordable, blue = locked), progress ring (animated), "≈ N hari lagi" from the engine's average income.
- [ ] Sort (Terjangkau dulu / Termurah / Paling sering dibeli) and "Bisa dibeli sekarang" filter.
- [ ] Buy: coin burst, `−N` float, card flash, count pop, wallet tween, history entry. Wallet panel and purchase history.
- [ ] Add/edit drawer (name required, price integer ≥ 1) and delete with undo. Purchase history snapshots must survive reward deletion (PRD).
- [ ] Decide the purchase-undo question (see Deviations): the PRD does not define refunds.

### Issue 5: History

- Prototype: `history.html`. Fixture: `history`.
- [ ] 4 summary cards, range switch (7 / 14 / 30), draw-in chart, y-axis, tooltip, keyboard cursor (arrows/Home/End).
- [ ] Event markers (rank up/down, level, milestone) and the Rank D threshold line (from the engine, not hardcoded 350).
- [ ] Events list, calendar, daily log; chart, calendar, list, and log stay in sync on click.
- [ ] Chart `aria-label` summary text.

### Issue 6: Settings

- Prototype: `settings.html`. Fixture: `settings`.
- [ ] Theme segmented control (light/dark, fully working light palette), animation switch, sound switch.
- [ ] Rank cards from the engine's rank table (current + next), level progress, balance-gate panel with threshold line.
- [ ] Titles gallery (catalog from the PRD): equip/unequip (one at a time, only unlocked), locked progress, preview chip.
- [ ] Export (real JSON download) and Import (validate → confirm → overwrite or error). Backup-age banner (warn at ≥ 7 days).
- [ ] The "Demo: buka title berikutnya" button is prototype-only and must NOT ship.

### Issue 7: Cross-page polish

- [ ] Responsive: 1100px and 700px breakpoints match prototypes on every page.
- [ ] Reduced motion and `data-motion=off`: all five pages.
- [ ] Contrast in the light theme for small text; fix only via a logged deviation.
- [ ] Performance: no layout thrash, particles pause on hidden tab, Lighthouse ≥ 90 on Performance and Accessibility.
- [ ] Remove dead code from the old UI.

---

## 2. Fidelity tests (Playwright)

Two complementary checks run against every page at 1280×800 and 390×844:

1. **Pixel diff:** full-page screenshot of the prototype vs the app, compared with `pixelmatch`.
2. **Computed-style diff:** walks both DOM trees in parallel and compares computed styles (including `::before`/`::after`). This catches differences that pixels hide, such as a wrong `transition` or `animation-delay`.

Both pages are rendered under identical conditions: fixed clock, fixed timezone and locale, reduced motion, animations disabled, particles and scan hidden, and the same local font files.

`playwright.config.ts` (excerpt):

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/visual',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173' },
  webServer: [
    {
      command: 'npm run build && npm run preview -- --port 4173',
      port: 4173,
      reuseExistingServer: true,
    },
    // static server for prototypes AND the local fonts (CORS enabled)
    { command: 'npx http-server . -p 4174 --cors -c-1', port: 4174, reuseExistingServer: true },
  ],
});
```

> The static server must serve `docs/prototype/` at `/` and `tests/visual/fonts/` at `/__fonts__/`. Do this with two small copy steps in a `pretest:visual` script, or with a tiny custom server. Choose whichever is simpler for this repo.

`tests/visual/fidelity.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const PROTO = process.env.PROTO_URL ?? 'http://localhost:4174';
const FIXED_TIME = new Date('2026-10-15T09:00:00+07:00');
const MAX_DIFF_RATIO = 0.001; // 0.1% of pixels; tighten to 0 once stable
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

// Adjust the app routes to the real hash routes.
const PAGES = [
  { name: 'today', proto: 'today.html', route: '/#/today' },
  { name: 'tasks', proto: 'tasks.html', route: '/#/tasks' },
  { name: 'rewards', proto: 'rewards.html', route: '/#/rewards' },
  { name: 'history', proto: 'history.html', route: '/#/history' },
  { name: 'settings', proto: 'settings.html', route: '/#/settings' },
];

test.use({
  reducedMotion: 'reduce',
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
  colorScheme: 'dark',
});

const FONTS: [family: string, weight: number, file: string][] = [
  ['Chakra Petch', 500, 'chakra-petch-latin-500-normal.woff2'],
  ['Chakra Petch', 600, 'chakra-petch-latin-600-normal.woff2'],
  ['Chakra Petch', 700, 'chakra-petch-latin-700-normal.woff2'],
  ['Manrope', 400, 'manrope-latin-400-normal.woff2'],
  ['Manrope', 500, 'manrope-latin-500-normal.woff2'],
  ['Manrope', 700, 'manrope-latin-700-normal.woff2'],
  ['JetBrains Mono', 500, 'jetbrains-mono-latin-500-normal.woff2'],
];
const FONT_CSS = FONTS.map(
  ([f, w, file]) =>
    `@font-face{font-family:'${f}';font-weight:${w};font-style:normal;font-display:block;src:url(${PROTO}/__fonts__/${file}) format('woff2')}`
).join('\n');

async function open(page: Page, url: string, proto: boolean) {
  await page.clock.setFixedTime(FIXED_TIME);
  if (proto) {
    // Replace Google Fonts with the same local files the app bundles via @fontsource.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) =>
      r.fulfill({ contentType: 'text/css', body: FONT_CSS })
    );
  }
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '#fx,.scan{display:none!important}' });
  await page.waitForTimeout(100);
}

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test.describe(`${p.name} @ ${vp.width}`, () => {
      test.use({ viewport: vp });

      test('pixel diff', async ({ page, browser }) => {
        const protoPage = await (
          await browser.newContext({
            viewport: vp,
            reducedMotion: 'reduce',
            locale: 'id-ID',
            timezoneId: 'Asia/Jakarta',
            colorScheme: 'dark',
          })
        ).newPage();

        await open(protoPage, `${PROTO}/${p.proto}`, true);
        await open(page, `${APP}${p.route}?fixture=${p.name}`, false);

        const a = PNG.sync.read(
          await protoPage.screenshot({ fullPage: true, animations: 'disabled' })
        );
        const b = PNG.sync.read(await page.screenshot({ fullPage: true, animations: 'disabled' }));

        expect({ w: b.width, h: b.height }, 'page dimensions must match the prototype').toEqual({
          w: a.width,
          h: a.height,
        });

        const diff = new PNG({ width: a.width, height: a.height });
        const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
        const ratio = bad / (a.width * a.height);
        if (ratio > MAX_DIFF_RATIO) {
          await test
            .info()
            .attach('diff.png', { body: PNG.sync.write(diff), contentType: 'image/png' });
          await test
            .info()
            .attach('prototype.png', { body: PNG.sync.write(a), contentType: 'image/png' });
          await test
            .info()
            .attach('app.png', { body: PNG.sync.write(b), contentType: 'image/png' });
        }
        expect(ratio, `diff ratio ${(ratio * 100).toFixed(3)}%`).toBeLessThanOrEqual(
          MAX_DIFF_RATIO
        );
      });

      test('computed-style diff', async ({ page, browser }) => {
        const protoPage = await (
          await browser.newContext({
            viewport: vp,
            reducedMotion: 'reduce',
            locale: 'id-ID',
            timezoneId: 'Asia/Jakarta',
            colorScheme: 'dark',
          })
        ).newPage();
        await open(protoPage, `${PROTO}/${p.proto}`, true);
        await open(page, `${APP}${p.route}?fixture=${p.name}`, false);

        const A = await protoPage.evaluate(collect);
        const B = await page.evaluate(collect);

        const problems: string[] = [];
        if (A.length !== B.length)
          problems.push(`element count differs: prototype ${A.length}, app ${B.length}`);
        for (let i = 0; i < Math.min(A.length, B.length) && problems.length < 40; i++) {
          if (A[i].path !== B[i].path) {
            problems.push(`#${i} structure: "${A[i].path}" vs "${B[i].path}"`);
            break;
          }
          for (const k of Object.keys(A[i].st)) {
            if (A[i].st[k] !== B[i].st[k])
              problems.push(`#${i} ${A[i].path} [${k}] ${A[i].st[k]} → ${B[i].st[k]}`);
          }
        }
        expect(problems, problems.join('\n')).toEqual([]);
      });
    });
  }
}

// Runs inside the browser: serialisable, no closures.
function collect() {
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
  const norm = (c: string) =>
    c
      .replace(/\bsvelte-[a-z0-9]+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const out: { path: string; st: Record<string, string> }[] = [];
  const walk = (el: Element, parent: string) => {
    if (SKIP.includes(el.tagName)) return;
    const cn = typeof el.className === 'string' ? norm(el.className) : '';
    const path = `${parent}>${el.tagName.toLowerCase()}${cn ? '.' + cn.split(' ').join('.') : ''}`;
    const cs = getComputedStyle(el),
      st: Record<string, string> = {};
    for (const k of PROPS) st[k] = (cs as any)[k];
    for (const ps of ['::before', '::after']) {
      const c = getComputedStyle(el, ps);
      if (c.content !== 'none') for (const k of PROPS) st[ps + k] = (c as any)[k];
    }
    out.push({ path, st });
    for (const child of Array.from(el.children)) walk(child, path);
  };
  walk(document.body, '');
  return out;
}
```

Extra states to cover once the defaults pass (copy the same pattern, with the interaction applied identically on both pages before the screenshot):

| Page     | State                                                            |
| -------- | ---------------------------------------------------------------- |
| Today    | one quest completed; penalty cleared (Soc ×2)                    |
| Tasks    | drawer open (add) with a validation error; drawer open (edit)    |
| Rewards  | after buying "Kopi susu santai"; sort = Termurah; drawer open    |
| History  | range 7 and 14; cursor on a rank event                           |
| Settings | light theme; import confirmation shown; one extra title unlocked |

Notes:

- `reducedMotion: 'reduce'` plus `animations: 'disabled'` freezes motion at its end state on both sides. Motion correctness (timing, easing) is verified by the computed-style diff and by manual review.
- Start with `MAX_DIFF_RATIO = 0.001`. Once all pages pass, move to 0 or a small absolute pixel count.
- These test scripts are a starting point and have not been run against your repo. Expect to adjust imports, routes, and server setup in Issue 0.

## 3. Deviations log template (`docs/prototype/DEVIATIONS.md`)

```markdown
# Deviations from prototype

| #   | Page    | Element / rule       | Prototype            | App                | Reason                | PRD reference | Approved by |
| --- | ------- | -------------------- | -------------------- | ------------------ | --------------------- | ------------- | ----------- |
| 1   | Rewards | Buy toast "Batalkan" | Refunds the purchase | (decision pending) | PRD defines no refund | §2 Rewards    |             |
```

Likely entries to resolve up front:

1. **Rewards:** purchase undo. The PRD defines no refund. Either keep it (documenting it as an extension) or remove it.
2. **Settings:** animation and sound switches are not in the PRD. Keep or drop.
3. **Settings:** the "Demo: buka title berikutnya" button is for the prototype only. Do not ship it.
4. **Tasks:** the prototype deletes immediately with undo; the PRD says delete. An "archive" option is not specified.
5. **Light theme:** only settings.html has light-theme tokens. Decide whether the other four pages must support it in this milestone.

---

### 3.1 One-line reminders

- "Do not redesign. Match the prototype exactly. If you disagree with a design choice, tell me instead of changing it."
- "Copy the CSS verbatim. Do not rewrite it in your own style."
- "Fix the app, not the test."

---
