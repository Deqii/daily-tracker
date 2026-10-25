# Common rules for the UI Revamp issue prompts (human-owned: agents never edit this file)

Revision 2: adds tiered testing (section 8), the aggregate CI gate (section 9) and efficiency rules (section 11). Sections 1 to 4 and 6 are unchanged.

## 1. Source of truth

- docs/prototype/*.html is the visual and interaction spec. For anything visual (layout, spacing, colour, type, motion, copy, ARIA), the prototype beats design.md (the old visual brief) and everything else.
- docs/PRD.md wins for behaviour and rules (points, rank, gate, penalties, streaks, titles). If a prototype and the PRD disagree on behaviour, follow the PRD and record it in docs/prototype/DEVIATIONS.md. Never resolve a conflict silently.
- Never edit files in docs/prototype/ (the prompt may tell you to commit a prototype file that a human already modified: commit it as it is). Never edit docs/UI-REVAMP.md or docs/agent-prompts/. In DEVIATIONS.md you may ADD entries (open questions, deviations, mechanical renames); never edit or delete existing entries unless the prompt tells you to.

## 2. Never do

- Change MAX_DIFF_RATIO, the self-test tolerances, or any test threshold; skip, loosen or delete a test; add retries. Fix the app, never the test and never the prototype.
- Change engine rules or behaviour. You may expose values the engine already computes. If the engine cannot do something the page needs, STOP that item and report it as an open question with evidence. Do not invent engine behaviour, and do not render a control that cannot act (no inert buttons) unless the prompt explicitly says to.
- Add dependencies (removing unused ones is allowed when the prompt says so).
- Use `gh` to write: no issue edits or comments, no labels, no closing. You may open the PR. The PR body ends with "Refs #<issue>", never "Closes".
- Copy the prototype's demo logic as business logic (award(), lvOf(), gate(), scaleMax(), teaser(), hardcoded constants such as CAP, MULT, AVG, MAX, thresholds, rank tables, simulations, STATE handling, demo buttons). Read every value from the engine and stores. Copy only UI mechanics: tweening, floating numbers, bursts, focus management, drawer open/close, flash and scroll-into-view, toasts, keyboard handling.
- Run the full visual suite locally unless section 8 says you must.

## 3. Port rules

- Rendered DOM identical to the prototype in every tested state: tags, order, classes, attributes (role, aria-_, tabindex, data-_, title; ids may be dropped unless a CSS rule uses them), and copy text. Component boundaries are free.
- CSS copied verbatim: no cleanup, no reordering of values, no rewrite with utility classes, no px to rem.
- UI copy is English. User content (task, reward and title names) stays as written. Dates en-GB, numbers en-US.
- Typographic punctuation in visible text as in the prototype.

## 4. CSS architecture

- Page rules go in src/styles/ui/<page>.css, copied verbatim from the prototype and wrapped in `@scope (body[data-page="<page>"]) { ... }`. Media queries stay outside and repeat the wrapper: `@media(...){ @scope (...) { ...page rules only... } }`. Shared shell rules already in the app are not repeated. Rules that must work on every page (shell, overlays, notices) are global and unscoped.
- The shell sets `document.body.dataset.page` to the route name before the page renders.
- Page-specific `@keyframes` get the page prefix (`rewards-pulse`) together with every `animation`/`animation-name` reference. Shared keyframes (`brk-in`, `brk-breathe`, `boot`, `scan`, `ov-*`) are never renamed. Append every rename to "Mechanical renames" in DEVIATIONS.md (old name, new name, page).
- Extend `check:ui-css` to cover ALL of the page's rules (selectors, declarations, media queries, keyframes), reading through the wrapper and un-prefixing keyframe names. Prove it: change one value, show the failure, revert.

## 5. Stages (commit when each stage is done)

- Stage A, static page: read the prototype completely (HTML, CSS, JS), write the table "prototype value -> engine/store source", port markup, CSS and data, delete the old components that became unused (keep anything shared). Gate: the page's fidelity and health tests pass (first at 1280x800 dark while iterating, then once in all four combinations: 2 viewports x 2 themes; dimensions equal, pixel diff within the existing ratio, empty computed-style problem list); `npm run check:ui-css` passes.
- Stage B, behaviour: port the interactions with the prototype's exact mechanics (durations, easing, created DOM, focus behaviour); add tests/visual/<page>-interactions.spec.ts in which identical actions (same selector, same click point, same settle condition) run on the prototype and the app and the full page is compared by pixels and computed styles at 1280x800 in dark and light; add behavioural assertions in the app only (values come from the engine, not hardcoded; persistence through the store/engine). Gate: those tests pass.
- Stage C, quality: unit tests for data mapping and validation (values from the engine, including different ranks where relevant), a manual pass in both themes at both viewports with no console errors or warnings, a keyboard-only and prefers-reduced-motion pass (describe what you checked), README and CI updates.
- Time-box: for any failing region of a diff, stop after 3 DISTINCT fix attempts on that region, commit what you have, and report with the diff images. If a stage cannot meet its gate, stop after committing and report where you are. Do not keep iterating.

## 6. Tests and fixtures

- Fixtures are generated from the prototype by the dump scripts (never hand-copied) and guarded by check:fixtures. Non-default prototype states use the `state` query parameter (`/?fixture=<page>&state=<name>#/<route>` is compared with `<page>.html?state=<name>`). If a state needs data the prototype computes, dump it from the rendered prototype.
- Where the prototype's display depends on something the engine computes (for example an average), the fixture may seed engine data that makes the engine produce the prototype's number. Record every such scaffolding in DEVIATIONS.md as test scaffolding.
- Add unit tests, using only the engine and the fixtures, that assert the derived values the page shows.
- Elements that exist only in the prototype (demo controls) are removed from the prototype DOM by the harness before capture, on the prototype side only, and skipped by the style collector.

## 7. Standard preconditions (check first, stop and tell me if any fails)

1. Find the issue number with a read-only `gh issue list --state all --search "<issue title>"` and read its body.
2. The previous issue's PR and any fix PR from the plan-mode review are merged, and the latest CI run of the base branch is green (check it with a read-only `gh run list --branch <base> --limit 3`). Locally run only the static checks: `npm run check`, `check:ui-css`, `check:prototype-shared`, `check:fixtures`, and the previous page's tests at 1280x800 dark. Do NOT run the full visual suite for a precondition: CI already did.
3. Working tree clean. Create a new branch from the updated base.

## 8. Test tiers (never run more than the tier needs)

- Tier 0, after every edit (seconds): `npm run check` (types), the unit tests of the files you touched (`npx vitest run <path>`), and the ONE Playwright test that covers what you changed (`npx playwright test <file> -g "<name>"`, add `--last-failed` when iterating). Use `--reporter=line`. Keep the preview and prototype servers running between runs; run `npm run build:visual` only after source changes.
- Tier 1, end of each stage (once): `npm run check:ui-css`, `npm run check:prototype-shared`, and the current page's own fidelity, health and interaction tests in all combinations (`npm run test:visual:page -- <page>` if it exists, otherwise `npx playwright test --grep "<page>"`).
- Tier 2, end of the issue (once): lint, check, unit tests, format:check, `npm run build && npm run check:no-fixtures`, `check:fixtures`, `check:ui-css`, `check:prototype-shared`, `npx playwright test shell`, the current page's tests, and a regression smoke of exactly one previously ported page (Today) at 1280x800 dark.
- Tier 3, full (self-test once, not three times, plus the whole `npm run test:visual`): run it locally ONLY if you changed tests/visual/*.ts, the Playwright config, a docs/prototype file, the shared token blocks or the shell CSS. Otherwise CI is the full-suite gate: say so in the report and list what you did not run.
- Never re-run a passing suite to "confirm". A test that fails once and passes on a re-run is a flake: report it with `--repeat-each=10` evidence; do not add retries.

## 9. CI

- The required job named `quality` is the aggregate gate. Jobs may be split and sharded, but a final job named `quality` must `needs:` all of them, so branch protection keeps working. Never rename or remove `quality`.
- Add the page's fidelity, health and interaction tests to the visual jobs (keep pinned action versions and read-only permissions). State what you could not verify without a real GitHub run.

## 10. Report format (required, compact)

1. Branch and PR: name, title, link; confirmation of "Refs #<issue>"; evidence for each precondition.
2. Per task: done / partly / not done, one line each; where a time-box or an engine gap stopped you, say where and give diff image paths.
3. The prototype value -> engine source table.
4. Files changed: path and one line each; key before/after lines for the page's @scope wrapper and one renamed keyframe.
5. Results table: page x viewport x theme: dimensions (prototype vs app), pixel diff ratio, element counts, style problems; plus the interaction results. Counts only; paste the first error lines of each DISTINCT failure, never full logs.
6. Mechanical renames, new DEVIATIONS.md entries and open questions, engine gaps found.
7. check:ui-css evidence: the passing run and the deliberate-failure run.
8. Old-UI and test impact: unit tests updated and why; code left unused.
9. CI: what changed and what you could not verify.
10. Decisions and assumptions you made that I did not specify.
11. Not done / uncertain, and other observations left alone (list problems you noticed and left alone).
12. Commands that took longer than 30 seconds, with their wall time, and which Tier 3 items you skipped and why.
    Do not claim done if any step failed. If something blocks you, say exactly what and stop. Stop after the PR and wait for my review.

## 11. Efficiency rules

- Read each prototype file once and keep notes; do not re-read files you have already read unless they changed.
- No fixed sleeps: wait for a condition (an element, a finished animation, fonts ready). Do not add `waitForTimeout` to tests.
- Summarise tool output: `--reporter=line` or `dot`, `tail -n 40`, `grep -c`; never print or paste whole logs, traces or reports into your reasoning or the report.
- Prefer `rg` over repeated directory listings; batch related edits into one script; commit after each task.
- Do not regenerate fixtures unless the prototype for that state changed (`check:fixtures` tells you).
- If the same command fails three times with the same error, stop and report instead of retrying.
