# Visual fidelity harness (UI Revamp)

Compares each `docs/prototype/*.html` page with the Svelte app at 1280x800 and
390x844. Four independent specs per page and viewport:

| Spec               | Asserts                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| `health.spec.ts`   | the app booted: no `pageerror` / `console.error`, right route, expected first heading |
| `fidelity.spec.ts` | **pixel diff** (full-page screenshots vs `pixelmatch`) and **computed-style diff**    |
| `selftest.spec.ts` | the harness is deterministic: the same page rendered twice agrees                     |
| `shell.spec.ts`    | the app shell: the `header` region, per page, per viewport, per theme                 |

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

First run only:

```
npx playwright install chromium
```

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
CSS, pulls out the rules the shell owns from both, and compares them after
normalising whitespace, comment removal, quote style, leading and trailing zeros
and operator spacing. It prints what is missing and what differs, property by
property:

```
1 of 55 ported rules do not match docs\prototype\today.html:

    header
      - gap:28px
      + gap:24px
```

It covers the two token blocks, the base and background layers, `.panel` and its
bracket animation, `.boot` and `.scan`, the header and its two media queries,
and both motion opt-outs - 55 rules. Page-content rules (`main`, `.stats`, `.sep`,
`.ranks`, the History table cells) are out of scope and are not compared; they
belong to Issues 2-6. Keyframes are compared one step at a time, so a changed
declaration cannot hide inside a brace.

## What makes the two sides comparable

|                   |                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Clock             | `2026-10-15T09:00:00+07:00`, pinned with `page.clock.setFixedTime`                                                         |
| Timezone / locale | `Asia/Jakarta`, `id-ID`                                                                                                    |
| Theme             | `dark` and `light`, seeded into `localStorage` on both sides before navigation                                             |
| Motion            | `reducedMotion: 'reduce'`, `#fx` and `.scan` hidden                                                                        |
| Settle window     | 2.5 s before capture, plus two committed frames                                                                            |
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
   panels jittered by one colour step on a handful of pixels. Fix: `open()` waits
   2.5s so every animation has reached its end state before anything is
   captured.
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

The fixture parameter goes **before** the hash: `/?fixture=today#/today`. After
the hash it lands inside the fragment, the router never matches, and the app
falls back to the default page.

`src/main.ts` imports `App.svelte` **dynamically**, after `applyFixture()` has
run, and the order matters: `src/stores/app.ts` creates the store at module scope
and `loadState()` reads `localStorage` the instant that module is evaluated. With
a static import the store would be built from an empty storage, `?fixture=` would
seed `localStorage` too late to be seen, and every page would quietly render its
first-run defaults - Rank `E`, Streak `0`, Wallet `0` in the header - which is a
diff that reads like a styling problem and is not one.

| `?fixture=` | Source in the prototype                                           |
| ----------- | ----------------------------------------------------------------- |
| `today`     | `S`, `Q`, `R` and the 14 `heat` levels in `today.html`            |
| `tasks`     | the `T` array and the `pick` flags in `tasks.html`                |
| `rewards`   | the `R` and `L` arrays in `rewards.html`                          |
| `history`   | `src/lib/fixtures/history-snapshot.json`, dumped from `{ D, EV }` |
| `settings`  | `SX`, `RANKS`, `TT` and `un` in `settings.html`                   |

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
