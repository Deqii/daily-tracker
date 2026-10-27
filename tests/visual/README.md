# Visual fidelity harness (UI Revamp)

Compares each `docs/prototype/*.html` page with the Svelte app at 1280x800 and
390x844, in the dark and the light theme. Eight independent specs:

| Spec                                | Asserts                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `health.spec.ts`                    | the app booted: no `pageerror` / `console.error`, right route, expected first heading |
| `fidelity.spec.ts`                  | **pixel diff** (full-page screenshots vs `pixelmatch`) and **computed-style diff**    |
| `selftest.spec.ts`                  | the harness is deterministic: the same page rendered twice agrees                     |
| `shell.spec.ts`                     | the app shell: the `header` region, per page, per viewport, per theme                 |
| `today-interactions.spec.ts`        | the Today page's interactions: the same action on both sides, then the same diffs     |
| `today-states.spec.ts`              | every reusable Today state (`?state=`) at 1280x800 dark, 390x844 dark, 1280x800 light |
| `today-states-interactions.spec.ts` | the states' mechanics and keyboard/ARIA paths                                         |
| `tasks-interactions.spec.ts`        | the Tasks page's drawers, validation, filters, add and delete interactions            |

They are separate on purpose. Health describes whether the app works, the diffs
describe whether it matches, the self-test describes whether the diffs can be
trusted, and the shell test says the one region Issue 1 owns is already exact
while the rest of each page is still being rebuilt.

## Commands

```
npm run test:visual                      # run everything
npm run test:visual -- selftest          # harness self-test only
npm run test:visual -- shell             # header region only
npm run test:visual -- fidelity health   # the page diffs and health checks
npm run test:visual -- today-interactions # the Today interactions (3 scenarios x 2 themes)
npm run test:visual -- today-states.spec.ts # the Today state diffs (60 tests)
npm run test:visual -- today-states-interactions # the state mechanics (11 tests)
npm run test:visual -- tasks-interactions # the Tasks interactions (6 scenarios x 2 themes)
npm run test:visual:page -- today        # one page: fidelity, health, interactions, states
npm run test:visual:quick                # ported pages at 1280x800 dark, no self-test
npm run test:visual -- --grep "today"    # one page
npm run test:visual -- --grep "@ 390"    # one viewport
npm run test:visual -- --grep "light"    # one theme
MAX_DIFF_RATIO=0 npm run test:visual     # tighten from the 0.001 default

npm run test:visual:update               # refresh fonts + history snapshot
npm run test:visual:fonts                # re-copy woff2 + manifest
npm run test:visual:history-fixture      # re-dump history.html's { D, EV }
npm run test:visual:prototypes           # run the prototype server alone
npm run check:ui-css                     # the ported CSS is still the prototypes' CSS
npm run check:no-fixtures [dist]         # prove no build ships the fixtures
```

`test:visual` builds the app with `--mode visual` into `dist-visual/` and serves
it on port 4173; it serves `docs/prototype/` (plus `tests/visual/fonts/` at
`/__fonts__/`) on port 4174. Both servers start automatically.

`test:visual:page` takes the page name as its argument and runs that page's
fidelity, health, interaction and state tests (`today` and `tasks` have the
interaction/state files; the other three pages only have fidelity and health
until they are ported). `test:visual:quick` runs every ported page at 1280x800
in the dark theme, including shell and both pages' interactions and states, and
skips the self-test.

## CI layout

The required gate is split so that the slow visual suite runs in parallel
shards. Every shard still runs the same tests as before; nothing is skipped or
retried.

| Job                | What it does                                                                                                                              | Required |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `plan`             | Reads `.github/ci-shards.json` and outputs the shard matrix and the informational grep patterns.                                          | yes      |
| `static`           | `npm ci`, lint, types, unit tests, production build + `check:no-fixtures`, `check:ui-css`, `check:prototype-shared`, `check:ci-coverage`. | yes      |
| `build`            | One `npm run build:visual`, uploaded as the `dist-visual` artifact (1 day).                                                               | yes      |
| `visual (<shard>)` | Matrix of the four shards below. Downloads `dist-visual`, sets `PW_SKIP_BUILD=1`, runs the shard's Playwright tests.                      | yes      |
| `quality`          | Aggregate gate. `needs:` plan, static, build and visual and fails unless every one succeeded. This is the protected check.                | yes      |
| `visual-fidelity`  | The unported pages' fidelity and health tests. Runs only on `workflow_dispatch`; not needed by `quality`.                                 | no       |

### Shards

| Shard          | Tests | Contents                                                                                     | Serial time (base run) | CI time (2 workers) |
| -------------- | ----: | -------------------------------------------------------------------------------------------- | ---------------------: | ------------------: |
| `core`         |    60 | `selftest.spec.ts`, `shell.spec.ts`, plus `npm run check:fixtures`                           |                  253 s |               176 s |
| `today`        |    27 | Today's fidelity + health, `today-interactions.spec.ts`, `today-states-interactions.spec.ts` |                  120 s |                93 s |
| `today-states` |    60 | `today-states.spec.ts`                                                                       |                  269 s |               171 s |
| `tasks`        |    24 | Tasks' fidelity + health (including the 390 overflow check), `tasks-interactions.spec.ts`    |                  153 s |               122 s |

The serial times are the matching steps of the last green base run; the CI times
are from the first green run of the split workflow (2026-10-27), with
`workers: 2`.

### Adding a page

1. Add the page's spec files to a shard's `args` in `.github/ci-shards.json`.
   Keep `args` as a string: it is passed straight to `npx playwright test`.
   Put scripts such as `check:fixtures` in `extra`.
2. If the page is still being ported, add its grep pattern to `informational`
   instead: those tests are run by `visual-fidelity` and are not required.
3. Run `npm run check:ci-coverage`. It fails if a test is in no shard and not
   informational, or if an informational pattern matches nothing, and prints the
   number of tests per shard.

`check:ci-coverage` runs `npx playwright test --list` once for the whole suite
and once per shard (node built-ins only, no browser needed), so it also catches a
typo in an `args` string before the shards start.

### Failed shard artifacts

A failed shard uploads `test-results/` and `playwright-report/` as
`visual-<shard>-failure` (7 days); a passing shard uploads only
`test-results/results.json` as `visual-<shard>-results` (3 days). Download them
from the run page, or:

```
gh run download <run-id> -n visual-core-failure
gh run download <run-id> -n visual-today-results
```

Open `playwright-report/index.html` for the failure; the images and style report
are described under "How to read a failure" below.

### Why `quality` is an aggregate

Branch protection can only require one stable check name. Splitting the work
would otherwise either lose the required check or require every new shard to be
added to branch protection by hand. `quality` therefore has no tests of its own:
it `needs:` the real jobs, runs with `if: always()`, and exits non-zero when any
needed job is not `success` (a skipped or cancelled shard counts as a failure).
Keep its name; never rename or remove it.

### Local workers

`playwright.config.ts` uses `fullyParallel: true` and `workers: 2` in CI and
locally. The suite is parallel-safe after the harness stability work, but the
4-core / 8 GB development machine crashed with 4 workers. Do not raise it without
checking both CI and a local full run.

Both `visual.yml` and `ci.yml` use `concurrency` keyed by workflow and ref with
`cancel-in-progress: true`, so a superseded push does not keep a runner busy.

## Test tiers

Use the smallest tier that can catch a regression; do not run the full suite
when a narrower tier is enough (the rules are in `docs/agent-prompts/common.md`
section 8):

- **Tier 0, after every edit (seconds):** `npm run check`, the unit tests of the
  files you touched (`npx vitest run <path>`), and the one Playwright test that
  covers the change (`npx playwright test <file> -g "<name>"`, plus
  `--last-failed` while iterating). Use `--reporter=line`; keep the preview and
  prototype servers running between runs; run `npm run build:visual` only after
  source changes.
- **Tier 1, end of a stage (once):** `npm run check:ui-css`,
  `npm run check:prototype-shared`, and the current page's fidelity, health,
  interaction and state tests in all combinations with
  `npm run test:visual:page -- <page>`.
- **Tier 2, end of an issue (once):** `lint`, `check`, unit tests,
  `format:check`, `npm run build && npm run check:no-fixtures`,
  `check:fixtures`, `check:ui-css`, `check:prototype-shared`,
  `npx playwright test shell`, the current page's tests, and one previously
  ported page as a regression smoke at 1280x800 dark.
- **Tier 3, full (once):** `npx playwright test` for the whole suite, or a single
  self-test run. This tier is required only when the harness, the Playwright
  config, a prototype, the shared token blocks or the shell CSS changed.
  Otherwise CI is the full-suite gate.

First run only:

```
npx playwright install chromium
```

## CSS minification in the visual build

The visual build (`vite build --mode visual`) disables CSS minification
(`build.cssMinify: false` in `vite.config.ts`). The prototypes are served as
hand-written CSS, while Vite 8 minifies CSS with Lightning CSS, which rewrites
`background: none` to `background: 0 0`. Chromium then reports
`backgroundPosition: 0px 0px` for the app and `0% 0%` for the prototype, so the
computed-style diff fails on a property that paints identically. Production
builds still minify.

Consequence: the visual suite no longer exercises minified CSS. A production
smoke check (build `dist/`, load the real app, assert no console errors and the
main regions render) is therefore recommended for Issue 7. Do not build it here.

## The shell test

`shell.spec.ts` is the required check for Issue 1 and, from Issue 7, for every
later page. It captures the `header` element from both sides and asserts the
dimensions match, the pixel diff is within `MAX_DIFF_RATIO`, and the computed-style
report is empty.

It covers **5 pages x 2 viewports x 2 themes = 20 cases**, because
`[data-theme=light]` repaints the header itself: the chips' fill and hairline,
the nav's muted and active text and the active underline all resolve through
different custom properties in the two token blocks. A header that only ever
gets tested in the dark theme has not been tested.

Both sides are put into the theme by `context.addInitScript`, which runs before
any page script on every navigation. It has to be there rather than set after
`goto`: both the prototypes and `index.html` read `daily-tracker:theme` in a
blocking head script, so a page that loaded without the value would paint dark
and then never repaint. The app's fixture seeder runs afterwards and clears
storage, so it re-applies a theme it finds already set (`readSeededTheme` in
`src/lib/fixtures/index.ts`) - without that, the app would fall back to the
fixture's own dark theme while the prototype rendered light.

Output goes to `test-results/visual/<page>-<viewport>-<theme>-header/`.

Every run also logs the header's own numbers before it asserts, so a failure
still says what it measured:

```
[header] history @ 1280x800 light prototype 1280x64 app 1280x64 elements 19/19
[header] history @ 1280x800 light chips Rank D / Streak 13 / Wallet 65
```

## `check:ui-css`

The UI Fidelity Contract asks for the rules in `src/styles/ui/*.css` and the
token blocks in `src/app.css` to be copied verbatim from the prototypes. A pixel
diff cannot enforce that: change `--ease` or drop one corner bracket's `--arm`,
and by the time the harness captures anything every animation has already
reached its end state, so the screenshot is identical and the rule is silently
wrong.

`scripts/check-ui-css.mjs` reads `today.html`'s `<style>` block and the app's own
CSS, pulls the rules out of both, and compares them after normalising whitespace,
comment removal, quote style, leading and trailing zeros and operator spacing. It
prints what is missing and what differs, property by property:

```
1 of 155 ported rules do not match docs\prototype\today.html:

    #radar
      - max-width:440px
      + max-width:441px
```

It covers **155 rules**: the two token blocks, the base and background layers,
`.panel` and its bracket animation, `.boot` and `.scan`, the header and its two
media queries and both motion opt-outs (the shell, 58), plus every page rule of
`today.html` (97). Keyframes are compared one step at a time, so a changed
declaration cannot hide inside a brace.

### Reading through `@scope` and the keyframe renames

The five prototypes are five standalone documents whose class names and
`@keyframes` names collide with different rules. The app has one global
stylesheet, so:

- a page's rules are wrapped in `@scope (body[data-page="<route>"])`, and
  `src/components/AppShell.svelte` keeps `document.body.dataset.page` equal to
  the current route;
- a page's own keyframes carry a `today-` prefix (`spin` -> `today-spin`),
  because `@keyframes` names are global CSS. The shared ones (`brk-in`,
  `brk-breathe`, `boot`, `scan`) are not renamed.

Both are pure text changes, and the checker undoes them before comparing:
`unscopeContext` drops the wrapper from the context chain, `unrenameKeyframes`
strips the `today-` prefix from the `@keyframes` contexts and from the
`animation` declarations that name them, and `harness.ts` does the same for
`computedStyle.animationName` so the style diff does not report four renames as
four differences. Every rename is listed in `docs/prototype/DEVIATIONS.md` under
"Mechanical renames".

## The Today interaction test

`today-interactions.spec.ts` (Issue 2) applies the **identical** action to the
prototype and to the app - same selector, same click point, same wait - and then
runs the same two diffs as `fidelity.spec.ts`: full-page pixels first, then the
computed-style walk. Three scenarios at 1280x800 in both themes, six tests:

| Scenario                   | Selector                    | What it moves                                  |
| -------------------------- | --------------------------- | ---------------------------------------------- |
| complete "Baca 10 halaman" | `.qrow[data-i="2"]`         | XP, wallet, radar, INT chip, row state, toast  |
| complete "Chat 1 teman" x2 | `.qrow[data-i="4"]`         | the 2x counter, the cleared penalty zone, copy |
| buy "Main game 2 jam"      | `.rewards .rw` first `.btn` | wallet, the teaser, the toast                  |

Two details the ordering depends on:

- both sides wait for the ring burst and the floating `+N XP` to be removed
  (1100 ms after the click) and then call `settle()`, so they are compared
  settled rather than at a fixed delay;
- the engine assertions and the style walk run **before** the screenshots,
  because the toast hides itself after 8 s and four full-page captures plus two
  DOM walks take longer than that. Asserting the toast afterwards would test the
  clock rather than the page.

The app-only assertions compare against `pointsAwarded`, `level`, `xpForLevel`
and `passesBalanceGate` imported from `src/engine/`, and against values read off
the page before the click, so they follow the rank table and the level curve
rather than the fixture's numbers.

Output goes to `test-results/visual/today-1280-<theme>-<scenario>/`.

## The Today state tests

`today.html?state=<name>` and `/?fixture=today&state=<name>#/today` render the
same page for every state the app can reproduce. `today-states.spec.ts` runs the
full-page pixel and computed-style diffs for each of them at **1280x800 dark,
390x844 dark and 1280x800 light**; `today-states-interactions.spec.ts` then
exercises the behaviour through the app's own code (tier picker, Escape and focus
return, engine-derived blocked/freeze lines, title/empty state, overlay focus and
Escape, rank-down dismissal, both banners, reduced motion).

Supported states: `tiers`, `freeze0`, `blocked`, `notitle`, `empty`, `levelup`,
`rankup`, `rankdown`, `storage`, `recovery`. `freeze2` is intentionally absent:
Rank E allows one freeze per week, so the engine cannot produce the prototype's
two-freeze page without changing the rank. It is recorded in
`docs/prototype/DEVIATIONS.md` (Q10) and reported in the PR rather than faked.

## What makes the two sides comparable

|                   |                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Clock             | `2026-10-15T09:00:00+07:00`, pinned with `page.clock.setFixedTime`                                                         |
| Timezone / locale | `Asia/Jakarta`, `id-ID`                                                                                                    |
| Theme             | `dark` and `light`, seeded into `localStorage` on both sides before navigation                                             |
| Motion            | `reducedMotion: 'reduce'`, `#fx` and `.scan` hidden                                                                        |
| Settle condition  | fonts loaded, every finite animation finished, ten committed frames (10 s cap)                                             |
| Fonts             | the same woff2 bytes on both sides, via `/__fonts__/`                                                                      |
| Rasterisation     | `--disable-lcd-text`, `--disable-font-subpixel-positioning`, `--font-render-hinting=none`, `--force-device-scale-factor=1` |

`selftest.spec.ts` now runs 40 cases - the same page, viewport and theme twice -
for the same reason it already ran 20: a theme that is read from `localStorage` in
a blocking head script is exactly the kind of thing that can be flaky, and a
light case that cannot be proved stable cannot be used as a reference.

## Determinism, and what it cost

`selftest.spec.ts` renders every prototype twice in two separate browser
contexts and asserts the two renders agree. Writing it is what turned up three
real sources of non-determinism, all fixed in `harness.ts`:

1. **Animations were still in flight at capture.** `prefers-reduced-motion:
reduce` collapses the durations to 1ms but leaves `animation-delay` alone,
   and the prototypes stagger up to ~1.2s. `animations: 'disabled'` finished
   them at screenshot time, and the re-raster of the filtered, backdrop-blurred
   panels jittered by one colour step on a handful of pixels. Fix: `open()` calls
   `settle()`, which waits for fonts, awaits every finite animation, and
   commits ten frames before anything is captured. (It used to wait a fixed
   2.5s; that was correct but spent most of the suite's time asleep.)
2. **Beyond-viewport capture.** `page.screenshot({ fullPage: true })` asked
   Chromium to raster past the viewport, which resizes the `position: fixed`
   background (`body::before` gradients, `body::after` vignette) that every
   prototype paints, and behind each panel's `backdrop-filter`. Two identical
   loads of `rewards.html` at 390x844 differed by **12,978 pixels (1.7%)** with
   identical geometry. Fix: `captureFullPage()` scrolls, waits two frames and
   stitches viewport slices instead. Same image, and deterministic.
3. **Text rasterisation.** Glyphs could land on either side of a subpixel
   boundary depending on which thread rastered the tile. Fix: the four Chromium
   flags listed above.

What is left is one least-significant bit on an anti-aliased SVG stroke or a
blurred shadow edge. It is below pixelmatch's `threshold: 0.1`, so the self-test
asserts **zero differing pixels at that threshold** - the same yardstick the
fidelity check uses - and separately keeps the exact mismatch ratio under 1% so
that real non-determinism, which moves whole regions, still fails loudly. No
Chromium flag removes that last bit; `--deterministic-mode` breaks screenshots
outright.

### No CI baseline

**There is no stored baseline screenshot anywhere in this repo, and there does
not need to be one.** The prototype and the app are rendered in the same run, in
the same browser, on the same machine, and compared against each other. Whatever
differences exist between operating systems cancel out, because neither side is
a recording. This harness therefore does not need the baseline to be regenerated
on the CI image, and CI does not need to store or diff against images.

### Recorded build

```
Playwright:  1.64.1
Chromium:    156.0.8078.4 (Chrome for Testing v1248, chromium-headless-shell v1248)
Platform:    windows
Fonts:       see fonts/manifest.json (sha256 per file)
```

The pins that matter are in `package.json` (`@playwright/test` is an exact
version) and `harness.ts` (`CHROMIUM_ARGS`). CI runs the same on `ubuntu-24.04`;
a ratio taken on Linux is not comparable to one taken on Windows, but each run
is internally consistent, which is all a prototype-vs-app diff needs.

## How to read a failure

Every failing test writes to `test-results/visual/<page>-<viewport>/` (the shell
test adds the theme: `<page>-<viewport>-<theme>-header/`):

| File               | What it is                                                         |
| ------------------ | ------------------------------------------------------------------ |
| `prototype.png`    | the reference render                                               |
| `app.png`          | what the app rendered                                              |
| `side-by-side.png` | prototype left, app right, 12 px gap - the fastest way to see it   |
| `diff.png`         | pixelmatch output, differing pixels in red                         |
| `style-report.txt` | the computed-style report (also attached to the Playwright report) |

Open `playwright-report/index.html` for the same files inline plus the stack
trace.

Three failure types, and they mean different things:

- **`health` failed** - the app is broken, not merely different. The message
  carries the `pageerror` / `console.error` text, or the route and heading it
  actually got. A wrong route or a blank page also makes the diffs huge and
  meaningless, so fix health first.
- **`pixel diff` failed** - the app renders and is at the right route, but
  differs from the prototype. If the assertion is the _dimensions_ one, the two
  heights or widths differ: look at `side-by-side.png` for what is missing, and
  remember no ratio is produced in that case, because comparing an overlap would
  hide the real problem. If it is the _ratio_, the numbers are in the message.
- **`computed-style diff` failed** - either a structural summary (the two DOM
  trees are not aligned: both element counts, the first 10 differing DOM paths,
  and the class names only one side has) or, when the trees do line up, the
  mismatched properties grouped by element path. Both mean the same thing: the
  markup or the tokens are not what the prototype has. The `chips` line in the
  report says which header number was wrong.
- **`self-test` failed** - stop and read it before trusting anything else. The
  harness itself moved between two identical renders, so every ratio the other
  specs report is unreliable until this passes again.

## Fixtures

The app is built with `--mode visual` for tests. In that mode, and in `dev`,
`src/main.ts` loads `src/lib/fixtures/`, which seeds `localStorage` from
`?fixture=` and returns. The condition folds to `false` in a production build,
so Rollup drops the import and emits no fixtures chunk - and
`npm run check:no-fixtures` proves it, by scanning `dist/` for the
`DT_PROTOTYPE_FIXTURE_DO_NOT_SHIP` marker declared in `src/lib/fixtures/index.ts`.
The visual build goes to `dist-visual/`, which the script is expected to _fail_
on; that is what proves the marker is real rather than a check that can never
fire.

The fixture parameter goes **before** the hash: `/?fixture=today#/today`, and a
state is another query parameter: `/?fixture=today&state=tiers#/today`. After
the hash it lands inside the fragment, the router never matches, and the app
falls back to the default page.

`src/main.ts` imports `App.svelte` **dynamically**, after `applyFixture()` has
run, and the order matters: `src/stores/app.ts` creates the store at module scope
and `loadState()` reads `localStorage` the instant that module is evaluated. With
a static import the store would be built from an empty storage, `?fixture=` would
seed `localStorage` too late to be seen, and every page would quietly render its
first-run defaults - Rank `E`, Streak `0`, Wallet `0` in the header - which is a
diff that reads like a styling problem and is not one.

| `?fixture=`       | Source in the prototype                                           |
| ----------------- | ----------------------------------------------------------------- |
| `today`           | `S`, `Q`, `R` and the 14 `heat` levels in `today.html`            |
| `tasks`           | the `T` array and the `pick` flags in `tasks.html`                |
| `rewards`         | the `R` and `L` arrays in `rewards.html`                          |
| `history`         | `src/lib/fixtures/history-snapshot.json`, dumped from `{ D, EV }` |
| `settings`        | `SX`, `RANKS`, `TT` and `un` in `settings.html`                   |
| `today` + `state` | `today.html?state=`, via `today-states-snapshot.json`             |

Notes on the data:

- The History snapshot is the prototype's own simulation, which ignores the
  balance gate, freezes and 2x requirements. It is replayed verbatim; do not
  regenerate it with the engine.
- Each page has its own fixture, and the prototypes' demo data is not
  self-consistent across pages (`today.html` shows 'Minum air 2L' worth 5 pts
  while `tasks.html` shows 3). Each fixture follows its own page.
- `rewards.html` hardcodes `AVG = 13`; the app derives that from the engine's
  average income. `tasks.html` hardcodes `CAP = 15`; so does the app, from the
  rank table.
- `MAXV = 20` in the settings gate bars and `thr` in the history chart are
  prototype-local scales, not engine values.

## Fix the app, not the test

`MAX_DIFF_RATIO` in `harness.ts` is a starting point, not a target. When a diff
fails, compare `prototype.png`, `app.png` and `diff.png`.
