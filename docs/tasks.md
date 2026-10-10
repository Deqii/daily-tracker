# Tasks: Daily Tracker

Granular issue/PR checklist for an agentic coding assistant. One GitHub issue per checklist line, one PR per issue. Titles follow `type(scope): description` with an `area:xxx` label (Conventional Commits). Branch: `<type>/<N>-<short-description>`. See `PRD.md` for mechanics and schema, `design.md` for the UI, and `decisions.md` for choices.

How to read this file:

- Milestones 1–10 below are the original checklist. **Do not reorder, edit, or delete those lines.** Issue numbers #1–#62 follow line order, and `create-issues.sh` must not be run again.
- New issues (keys C1 to U5) are created with `scripts/create-new-issues.sh`. They get new numbers. GitHub numbers issues and PRs from one sequence, so expect numbers above the last PR. The execution order below refers to them by key.
- State lives in GitHub (open or closed), not in the checkboxes. #1–#12 are ticked as of this revision, for reference. Agents never edit this file.
- Original issues that need more than their title are specified in "Acceptance criteria for #13–#25" below.

## Execution order

This supersedes the top-to-bottom order wherever they differ.

1. Merge the PR for #12.
2. Checkpoint: C1 (Vitest). Then the human adds `.github/workflows/ci.yml` (without `--if-present`) so tests run under three timezones. Then C2, C3, F, and #22 pulled forward.
3. Engine rules: #13, #14, #15, #16, #17, #18, #19, #20, #21.
4. Orchestrators: E1, E2. Then the remaining engine tests: #23, #24, #25.
5. C4 (storage hardening), then Milestone 3 in this order: #31, #28, #27, #29, #30, S1, #26.
6. Milestones 4 to 9 in order. U1 after #34. U2 after #53. U3 after #54.
7. Milestone 10: #60, U4, U5, #61. #62 is human-only.

## Milestone 1 — Project Setup

- [x] `chore(setup)`: scaffold Svelte + Vite + TypeScript project — `area:frontend`
- [x] `chore(setup)`: install and configure Tailwind CSS — `area:frontend`
- [x] `chore(setup)`: configure ESLint and Prettier — `area:frontend`
- [x] `chore(setup)`: define folder structure (`components/`, `stores/`, `engine/`, `lib/`) — `area:frontend`

## Milestone 2 — Data Layer & Engine (no UI)

- [x] `feat(data)`: define TypeScript types for Task, TaskVariant, Completion, Reward, RewardPurchase, DailyQuestDay, UserState — `area:data`
- [x] `feat(data)`: implement localStorage read/write helpers keyed by `schemaVersion` — `area:data`
- [x] `feat(data)`: implement first-run initialization with empty-state defaults — `area:data`
- [x] `feat(data)`: implement corrupted-data recovery (guarded JSON parsing, fallback to defaults) — `area:data`
- [x] `feat(engine)`: implement `level(xp)` and `xpForLevel(level)` using the `14 × (N−1)²` curve — `area:engine`
- [x] `feat(engine)`: implement `rank(level)` and `getRankConfig(rank)` lookup table — `area:engine`
- [x] `feat(engine)`: implement point calculation (nominal points × rank multiplier, rounded up) — `area:engine`
- [x] `feat(engine)`: implement task point-cap validation against the current rank's max points/task — `area:engine`
- [ ] `feat(engine)`: implement deterministic daily rotating-task selection, one per active stat — `area:engine`
- [ ] `feat(engine)`: implement Daily Quest evaluation at day rollover (required vs actual completions per stat) — `area:engine`
- [ ] `feat(engine)`: implement penalty deduction (Lifetime XP and Wallet) on a missed stat — `area:engine`
- [ ] `feat(engine)`: implement the 2x-completion penalty flag with a hard cap (no further escalation) — `area:engine`
- [ ] `feat(engine)`: implement streak calculation with one freeze/week per the rank table — `area:engine`
- [ ] `feat(engine)`: implement the rank-up balance gate (weakest active stat ≥ 50% of active-stat average) — `area:engine`
- [ ] `feat(engine)`: implement rank recomputation so a rank can be lost when Lifetime XP falls — `area:engine`
- [ ] `feat(engine)`: implement reward purchase (Wallet deduction + purchase log entry) — `area:engine`
- [ ] `feat(engine)`: implement title unlock condition checks (streaks, purchases, rank-ups, completions) — `area:engine`
- [ ] `test(engine)`: unit tests for level/rank boundary values at every rank transition — `area:engine`
- [ ] `test(engine)`: unit tests for timezone and day-boundary edge cases in rollover — `area:engine`
- [ ] `test(engine)`: unit tests for penalty deduction and the 2x cap behavior — `area:engine`
- [ ] `test(engine)`: unit tests for the rank-up balance gate, including a stat with zero completions — `area:engine`

## Milestone 3 — App Shell

- [ ] `feat(ui)`: implement the shared top bar (wordmark, 5 nav items, Rank/Streak/Wallet chips) — `area:frontend`
- [ ] `feat(ui)`: implement client-side routing between the 5 pages — `area:frontend`
- [ ] `feat(ui)`: implement the dark/light theme toggle with persistence — `area:frontend`
- [ ] `feat(ui)`: implement the reusable corner-bracket panel frame component — `area:frontend`
- [ ] `feat(ui)`: implement the coin icon component — `area:frontend`
- [ ] `feat(design)`: implement the rank-accent color token system as CSS variables per rank — `area:design`

## Milestone 4 — Today Page

- [ ] `feat(ui)`: implement the Rank/Level readout with rank-accent glow — `area:frontend`
- [ ] `feat(ui)`: implement the equipped-title display line — `area:frontend`
- [ ] `feat(ui)`: implement the XP progress bar with in-level progress calculation — `area:frontend`
- [ ] `feat(ui)`: implement the 5-stat radar chart component — `area:frontend`
- [ ] `feat(ui)`: implement the system-message and penalty notification blocks — `area:frontend`
- [ ] `feat(ui)`: implement the Daily Quest checklist (anchor, rotating, and penalty row states) — `area:frontend`
- [ ] `feat(ui)`: wire task completion on Today to the engine's point calculation and persistence — `area:frontend`
- [ ] `feat(ui)`: implement the Rewards preview section on Today — `area:frontend`

## Milestone 5 — Tasks Page

- [ ] `feat(ui)`: implement the task list grouped by stat with an active-count header — `area:frontend`
- [ ] `feat(ui)`: implement the task-family row with indented effort-variant sub-rows — `area:frontend`
- [ ] `feat(ui)`: implement the single-tier task row — `area:frontend`
- [ ] `feat(ui)`: implement the Add/Edit task form (name, stat, anchor toggle, 1–3 variants) — `area:frontend`
- [ ] `feat(ui)`: implement point-cap validation feedback in the task form — `area:frontend`
- [ ] `feat(ui)`: implement task delete with a confirmation step — `area:frontend`

## Milestone 6 — Rewards Page

- [ ] `feat(ui)`: implement the rewards list (cost, purchase count, buy/locked state) — `area:frontend`
- [ ] `feat(ui)`: implement the Add/Edit reward form — `area:frontend`
- [ ] `feat(ui)`: wire the Buy action to the engine's purchase logic — `area:frontend`

## Milestone 7 — History Page

- [ ] `feat(ui)`: implement the XP trend line chart with level-up/rank-change markers — `area:frontend`
- [ ] `feat(ui)`: implement the day-by-day log table (per-stat check/dash/pending, net points) — `area:frontend`
- [ ] `feat(ui)`: implement milestone highlight rows (level up, rank up, rank down) — `area:frontend`

## Milestone 8 — Settings Page

- [ ] `feat(ui)`: implement the theme toggle row — `area:frontend`
- [ ] `feat(ui)`: implement the expandable rank-reference table — `area:frontend`
- [ ] `feat(ui)`: implement data export as a downloadable JSON file — `area:frontend`
- [ ] `feat(ui)`: implement data import with schema validation — `area:frontend`

## Milestone 9 — Level-up / Rank-up Reveal

- [ ] `feat(ui)`: implement the level-up reveal overlay (motion + glow, reusing the corner-bracket frame) — `area:frontend`
- [ ] `feat(ui)`: implement the rank-up reveal overlay (new rank's config summary) — `area:frontend`
- [ ] `feat(ui)`: implement a quiet rank-down notice with no celebratory motion — `area:frontend`
- [ ] `feat(ui)`: respect `prefers-reduced-motion` for every reveal overlay — `area:frontend`

## Milestone 10 — Polish & Deploy

- [ ] `feat(ui)`: implement first-run empty states (no tasks, no rewards) — `area:frontend`
- [ ] `chore(perf)`: Lighthouse pass, target 90+ — `area:frontend`
- [ ] `chore(deploy)`: configure static hosting and domain — `area:frontend`

## New issues (created with `scripts/create-new-issues.sh`)

Full bodies with acceptance criteria are in the script.

### Checkpoint, before #13

- [ ] `chore(setup)`: configure Vitest with a single-run `test` script and a smoke test — `area:frontend` (C1)
- [ ] `feat(lib)`: implement local-date helpers (`toLocalDate`, `toTimestamp`, `addDays`, `daysBetween`, `eachDay`, `weekStart`) with tests — `area:data` (C2)
- [ ] `fix(data)`: align persisted types, defaults, validation, and write errors with PRD v2 — `area:data` (C3)
- [ ] `fix(engine)`: apply the rank cap in point calculation and return a reason from cap validation — `area:engine` (F)

### Orchestration, before Milestone 3

- [ ] `feat(engine)`: implement `completeTask` orchestration (validation, points, XP, Wallet, statXP, log, events, titles) — `area:engine` (E1)
- [ ] `feat(engine)`: implement `runRollover` orchestration (every missed day, ordered steps, events, open today) — `area:engine` (E2)
- [ ] `feat(store)`: implement persisted stores; run rollover on load, on tab focus, and at local midnight — `area:frontend` (S1)
- [ ] `fix(data)`: harden `lib/storage` (guarded reads and writes, per-key shape validation, schema mismatch, recovery report with raw backup) — `area:data` (C4)

### UI additions

- [ ] `feat(ui)`: implement the freezes-left line and the rank-up-blocked line on Today — `area:frontend` (U1)
- [ ] `feat(ui)`: implement the title picker row in Settings — `area:frontend` (U2)
- [ ] `feat(ui)`: implement the storage-failure notice — `area:frontend` (U3)
- [ ] `feat(ui)`: implement responsive layouts for all pages — `area:frontend` (U4)
- [ ] `chore(a11y)`: keyboard, focus, and contrast pass in both themes — `area:frontend` (U5)

## Acceptance criteria for #13–#25

All engine issues are blocked by C1 and C3, and include tests for the code they add. Terms: _quest-active_ and _tracked_ are defined in `PRD.md` §2.1.

**#13 Rotating-task selection** (PRD §2.1 Daily Quest, §7.3). "Active stat" in the title means quest-active.

- `getQuestStats(tasks)` returns quest-active stats in the order STR, VIT, INT, DISC, SOC.
- `selectDailyTasks(tasks, date)` returns the picked id per quest-active stat that has rotating tasks. Anchors are never returned. Seeded exactly as PRD §7.3; the result does not depend on input order.
- One rotating task means that task; none means the stat is absent.
- Tests: determinism and order independence; single and no rotating task; each of 3 candidates appears at least once over 60 consecutive dates; dates across a month and year boundary.

**#14 Day evaluation** (PRD §7.4).

- `buildRequired(questStats, penaltyStats)` returns 0, 1, or 2 per stat.
- `evaluateDay(required, actual)` returns `missed` (`actual < required`, `required > 0`) and `satisfied` in the fixed stat order.
- Tests: normal miss; 0 of 1; 1 of 2 is a miss; 2 of 2 is satisfied; a stat with `required = 0` appears in neither list.
- Looping over several days is not part of this issue (see E2).

**#15 Penalty deduction** (PRD §2.1, §7.4; decision D1, D2).

- Add `penalty` to the rank config: E 5, D 8, C 13, B 20, A 30, S 45. This small edit to #10's file is in scope.
- `applyPenalty(state, rank, missedCount)` deducts `penalty × missedCount` from Lifetime XP and Wallet, each floored at 0, and reports what was actually deducted. `statXP` is untouched and inputs are not mutated.
- Tests: normal; XP clamps while Wallet does not; Wallet clamps while XP does not; both clamp; zero missed; penalty values per rank.
- `RANK_CONFIGS` and each config become readonly (`as const` or `Object.freeze`). A rank config is never persisted.

**#16 2x flag** (PRD §7.4).

- `nextPenaltyStats(prev, missed, satisfied, questStats)` as specified. A required value never exceeds 2.
- Tests: first miss flags; 1 of 2 under a flag keeps it; 2 of 2 clears it; a stat that stops being quest-active is cleared; repeated misses never produce 3.

**#17 Streak and freezes** (PRD §2.1 Streaks, §7.5; D4). "One freeze/week" in the title means the freezes per week in the Rank table (1 to 3).

- `closeDayStreak(streakState, day, rank)` implements the five steps. `displayStreak(currentStreak, todayHasCompletion)`.
- Tests: Appendix A scenario 5 exactly; 2 freezes allowed at Rank C; more freezes used than allowed after a rank drop means none left; a day with no quest-active stats changes nothing; week reset on a Monday across a month and a year boundary.

**#18 Balance gate** (PRD §2.1, §7.6). "Active stat" in the title means tracked.

- `getTrackedStats(statXP)` and `passesBalanceGate(statXP)` with the integer comparison `2 × weakest × count ≥ sum` and `threshold = ceil(sum / (2 × count))`.
- Tests: Appendix A scenario 4; a stat with zero completions is excluded; exactly 50% passes and one below fails; one tracked stat and none both pass.

**#19 Rank resolution** (PRD §2.1, §7.6; D5).

- `resolveRank(currentRank, level, statXP)`: down is immediate and ungated; up goes one step at a time, each step gated; `blocked` is set when the level rank stays above the result.
- Tests: Appendix A scenario 3 and scenario 4's rank resolution lines; blocked at E with Level 6 and unbalanced stats; two steps up when balanced; re-climbing after a drop needs the gate again.

**#20 Reward purchase** (PRD §2.1 Rewards, §7.7).

- `purchaseReward(state, rewardId, now, newId)` as specified: Wallet only, snapshots, `totalPurchases`, titles. It returns an error result (no exception) when Wallet is short.
- Tests: exact balance leaves 0; one point short fails; repeat purchases; Lifetime XP and `statXP` unchanged; a later edit of the reward does not change the log.

**#21 Titles** (PRD §2.1 Titles, §7.8).

- `TITLES` catalog, `evaluateTitles`, `equipTitle`.
- Tests: each condition at its boundary (6 and 7 day streaks, 99 and 100 completions); no duplicates on repeated calls; a `rank-*` title only on the first time; equipping a locked id is rejected.

**#22 Level and rank boundaries** (run right after C1; PRD Appendix B).

- Every `level(xp)` vector in Appendix B, XP at or below 0 is Level 1, `rank(level)` at 5/6, 10/11, 20/21, 35/36, 50/51, and `getRankConfig` matches the Rank table.

**#23 Rollover edge cases** (after E2).

- Appendix A scenario 2 (several days away); a clock that moved back; month, year and leap-day boundaries; a week boundary; DST dates. Runs green under all three CI timezones.

**#24 Penalty and 2x tests** (after E2).

- Appendix A scenarios 1 to 3 through `runRollover` and `completeTask`: XP, Wallet, flags, events.

**#25 Balance gate tests** (after E2).

- Appendix A scenario 4 through the orchestrators, including a stat with zero completions.

## Notes for later issues

| Issue    | Note                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #26      | Needs S1 first (chips read derived stores).                                                                                                                   |
| #27      | Hash router, no library: `#/today`, `#/tasks`, `#/rewards`, `#/history`, `#/settings`; default `#/today`; unknown hash goes to Today (D13).                   |
| #28      | Theme stored under `daily-tracker:theme`, default dark, sets `data-theme` on `<html>` (D16).                                                                  |
| #31      | Implement `design.md` §2 verbatim (dark and light). `data-rank` on `<html>` follows the effective rank (set by S1). Fonts per D15.                            |
| #35, #49 | In-house SVG with the accessible labels from `design.md` §9 (D14).                                                                                            |
| #37, #38 | The checklist and completion call `completeTask` through the stores. No game logic in components.                                                             |
| #40      | "Active-count header" means the task count shown in `design.md` ("11 tasks").                                                                                 |
| #48      | Buying calls `purchaseReward` through the stores.                                                                                                             |
| #54, #55 | Export and import the keys in PRD §6 except the theme. Import validates `schemaVersion` and shapes without a validation library; any failure changes nothing. |
| #56–#59  | `design.md` §6.                                                                                                                                               |
| #60      | Copy in `design.md` §7.                                                                                                                                       |
| #61      | Both themes. Contrast already follows `design.md` §2 and §9.                                                                                                  |
| #62      | Human-only (domain, DNS). The agent may prepare static-hosting config only.                                                                                   |
