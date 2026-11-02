# UI Revamp final report (Issue 155)

Date: 2026-11-02
Branch: `chore/155-cross-page-polish`

## What changed

- **Q9 closed:** the completion toast's inert Undo control was removed from
  `docs/prototype/today.html` and the app, as approved on 2026-11-01.
- **Accessibility attributes:** added `role="img"` to Today's streak pips and
  History's pending/missed marks, and an accessible name to Settings' locked
  title progress bars, in both the prototypes and the app. Recorded in
  `docs/prototype/DEVIATIONS.md`.
- **New cross-page specs:** `responsive.spec.ts` (10 tests), `motion.spec.ts`
  (14) and `keyboard.spec.ts` (9), sharded as `crosspage` in CI.
- **CI:** added `check:contrast` to the static job, removed the non-required
  `visual-fidelity` job, and made every remaining job required through
  `quality`.
- **Dead code/dependencies removed:** `PanelFrame.svelte`, `src/lib/radar.ts`
  and its test, Tailwind and its Vite plugin, the legacy `@fontsource-variable`
  packages, old `--tw-*`/glow/reveal tokens, and empty `.gitkeep` files.
  `today-lines.ts` and `selectRewardPreview` are still used and were kept.

## Verification

| Check                                         | Result                              |
| --------------------------------------------- | ----------------------------------- |
| `npm run lint`                                | pass                                |
| `npm run check`                               | 0 errors, 0 warnings                |
| `npm test`                                    | 518 passed in 38 files              |
| `npm run build` + `npm run check:no-fixtures` | pass; no fixture marker in `dist`   |
| `npm run format:check`                        | pass                                |
| `npm run check:fixtures`                      | all six fixtures match a fresh dump |
| `npm run check:ui-css`                        | 596/596 ported rules match          |
| `npm run check:prototype-shared`              | 68/68 shared rules identical        |
| `npm run check:ci-coverage`                   | pass; 288 tests, eight shards       |
| `PW_SKIP_BUILD=1 npx playwright test`         | **288 passed** (17.0 min)           |

Every page passed pixel and computed-style diffs in all four combinations. The
previously red `tasks @ 390 light` diff measures **0.000%** locally now.

## Responsive, motion and keyboard

- Seven widths were checked on all five pages in both themes: 320, 360, 390,
  768, 1024, 1280 and 1920.
- Reduced motion and `data-motion="off"` stop every finite animation and hide
  the particle canvas on all pages.
- Tab walks reach every visible control with a visible focus indicator. Tasks
  and Rewards drawers and the Today milestone overlay trap Tab, close on Escape
  and restore focus.
- Prototype-caused, reported not "fixed": History's calendar day buttons are
  under 44px between 320 and 390, Settings' animation/sound toggles are under
  44px between 320 and 390, and `settings.html` itself overflows at 320
  (`scrollWidth 333 > 320`). The app matches the prototypes.

## Contrast (light theme)

Dark pairs all pass. Four light pairs are below 4.5:1 and are reported without
changing tokens:

| Pair                        | Ratio |
| --------------------------- | ----- |
| `--ok` on `--bg`            | 4.44  |
| `--gold` on `--bg`          | 3.95  |
| `--gold` on `--panel`       | 4.31  |
| `--gold` on `--panel-solid` | 4.44  |

## Performance and accessibility

- Lighthouse desktop: **Performance 97**, **Accessibility 100**.
- Lighthouse mobile (simulated 4x CPU): Accessibility **100** on all five
  pages; Performance ranged **76-92** across repeated runs on this machine, with
  total blocking time between 250 and 740 ms. The variance is load-sensitive,
  so the desktop result is the stable one.
- CLS is **0**, forced reflow reports no entries, and the particle loop is
  confirmed paused on `document.hidden` (0 canvas clears) and resumes when
  visible.
- Production build: `App` 109.5 kB (CSS 49.9 kB); visual build: `App` 100.1 kB,
  CSS 77.7 kB.

## Deviations and open questions

`docs/prototype/DEVIATIONS.md` was reviewed. Q9 is closed; the accessibility
attributes above are logged with their scope. These entries remain open and
need a human decision; none are changed by this issue:

Q8 (Today teaser uses every reward vs `selectRewardPreview`), Q10 (`freeze2`
impossible at Rank E), Q11 (rank-down notice is session-local), Q12 (export now
exists, so the row is stale and should be marked resolved), Q13 (one Indonesian
Tasks sentence), Q14 (over-cap literal template text), Q15 (Tasks/Rewards still
render a visible inert Undo button from the prototypes), Q16 (History title
milestones are not in the engine's event union), Q17 (Indonesian Settings
subtitle).

`docs/UI-REVAMP.md` does not contain the referenced §4.4 audit prompt; the audit
was done through the new specs and a manual pass instead.

## Not verified here

The GitHub workflow changes (new shard, `check:contrast`, removal of the
informational job) have not run on GitHub. Only local jobs and commands above
were executed.
