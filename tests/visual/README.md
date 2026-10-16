# Visual fidelity harness (UI Revamp)

Compares each `docs/prototype/*.html` page with the Svelte app at 1280x800 and
390x844. Three independent specs per page and viewport:

| Spec               | Asserts                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| `health.spec.ts`   | the app booted: no `pageerror` / `console.error`, right route, expected first heading |
| `fidelity.spec.ts` | **pixel diff** (full-page screenshots vs `pixelmatch`) and **computed-style diff**    |
| `selftest.spec.ts` | the harness is deterministic: the same page rendered twice agrees                     |

They are separate on purpose. Health describes whether the app works, the diffs
describe whether it matches, and the self-test describes whether the diffs can be
trusted. A failure in one never hides a number from another.

## Commands

```
npm run test:visual                      # run everything
npm run test:visual -- selftest          # harness self-test only
npm run test:visual -- fidelity health   # the page diffs and health checks
npm run test:visual -- --grep "today"    # one page
npm run test:visual -- --grep "@ 390"    # one viewport
MAX_DIFF_RATIO=0 npm run test:visual     # tighten from the 0.001 default

npm run test:visual:update               # refresh fonts + history snapshot
npm run test:visual:fonts                # re-copy woff2 + manifest
npm run test:visual:history-fixture      # re-dump history.html's { D, EV }
npm run test:visual:prototypes           # run the prototype server alone
npm run check:no-fixtures [dist]         # prove no build ships the fixtures
```

`test:visual` builds the app with `--mode visual` into `dist-visual/` and serves
it on port 4173; it serves `docs/prototype/` (plus `tests/visual/fonts/` at
`/__fonts__/`) on port 4174. Both servers start automatically.

First run only:

```
npx playwright install chromium
```

## What makes the two sides comparable

|                   |                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Clock             | `2026-10-15T09:00:00+07:00`, pinned with `page.clock.setFixedTime`                                                         |
| Timezone / locale | `Asia/Jakarta`, `id-ID`                                                                                                    |
| Theme             | `dark`                                                                                                                     |
| Motion            | `reducedMotion: 'reduce'`, `#fx` and `.scan` hidden                                                                        |
| Settle window     | 2.5 s before capture, plus two committed frames                                                                            |
| Fonts             | the same woff2 bytes on both sides, via `/__fonts__/`                                                                      |
| Rasterisation     | `--disable-lcd-text`, `--disable-font-subpixel-positioning`, `--font-render-hinting=none`, `--force-device-scale-factor=1` |

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

Every failing test writes to `test-results/visual/<page>-<viewport>/`:

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
  markup or the tokens are not what the prototype has.
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
