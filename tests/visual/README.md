# Visual fidelity harness (UI Revamp)

Compares each `docs/prototype/*.html` page with the Svelte app at 1280x800 and
390x844. Two assertions per page and viewport:

1. **Pixel diff** - full-page screenshots compared with `pixelmatch`.
2. **Computed-style diff** - both DOM trees walked in parallel, every listed CSS
   property plus `::before` / `::after` compared. Catches what pixels hide, such
   as a wrong `transition` or `animation-delay`.

## Commands

```
npm run test:visual                      # run everything
npm run test:visual -- --grep "today"   # one page
npm run test:visual -- --grep "@ 390"    # one viewport
MAX_DIFF_RATIO=0 npm run test:visual    # tighten from the 0.001 default

npm run test:visual:update              # refresh fonts + history snapshot
npm run test:visual:fonts               # re-copy woff2 + manifest
npm run test:visual:history-fixture     # re-dump history.html's { D, EV }
npm run test:visual:prototypes           # run the prototype server alone
```

`test:visual` builds and previews the app on port 4173 and serves
`docs/prototype/` (plus `tests/visual/fonts/` at `/__fonts__/`) on port 4174.
Both servers start automatically.

First run only:

```
npx playwright install chromium
```

## What makes the two sides comparable

|                   |                                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| Clock             | `2026-10-15T09:00:00+07:00`, pinned with `page.clock.setFixedTime`            |
| Timezone / locale | `Asia/Jakarta`, `id-ID`                                                       |
| Theme             | `dark`                                                                        |
| Motion            | `reducedMotion: 'reduce'`, `animations: 'disabled'`, `#fx` and `.scan` hidden |
| Fonts             | the same woff2 bytes on both sides, via `/__fonts__/`                         |

## Determinism

`@playwright/test` is pinned to an exact version in `package.json` and
`npx playwright install chromium` resolves one Chromium build. Record the build
a set of diffs was taken with here when a baseline is accepted:

```
Playwright:  1.64.1
Chromium:    156.0.8078.4 (chromium-headless-shell v1248)
Platform:    windows
Fonts:       see fonts/manifest.json (sha256 per file)
```

CI should run the same pinned Playwright version on a fixed Ubuntu image
(`ubuntu-24.04`). Note that text rasterisation is not bit-identical across
operating systems; if a CI baseline is wanted, generate it on the same image the
job uses.

## Fixtures

The app is built with `--mode visual` for tests. In that mode, and in `dev`,
`src/main.ts` loads `src/lib/fixtures/`, which seeds `localStorage` from
`?fixture=` and returns. The condition folds to `false` in a production build,
so Rollup drops the import and emits no fixtures chunk.

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

Every threshold in `fidelity.spec.ts` is a starting point. When a diff fails,
compare `prototype.png`, `app.png` and `diff.png` from the test attachments.
