# Tasks: Daily Tracker

Granular issue/PR checklist for an agentic coding assistant. Follows the standard workflow: open the GitHub issue first, one PR per issue, `type(scope): description` — `area:xxx` label, Conventional Commits, branch `type/short-description`. See `PRD.md` for mechanics and schema, and `design.md` for the per-page UI spec.

Work milestones in order — later milestones assume earlier ones are merged. Within Milestone 2, the engine has no UI dependency and should be fully unit-tested before Milestones 4–8 start consuming it.

## Milestone 1 — Project Setup

- [ ] `chore(setup)`: scaffold Svelte + Vite + TypeScript project — `area:frontend`
- [ ] `chore(setup)`: install and configure Tailwind CSS — `area:frontend`
- [ ] `chore(setup)`: configure ESLint and Prettier — `area:frontend`
- [ ] `chore(setup)`: define folder structure (`components/`, `stores/`, `engine/`, `lib/`) — `area:frontend`

## Milestone 2 — Data Layer & Engine (no UI)

- [ ] `feat(data)`: define TypeScript types for Task, TaskVariant, Completion, Reward, RewardPurchase, DailyQuestDay, UserState — `area:data`
- [ ] `feat(data)`: implement localStorage read/write helpers keyed by `schemaVersion` — `area:data`
- [ ] `feat(data)`: implement first-run initialization with empty-state defaults — `area:data`
- [ ] `feat(data)`: implement corrupted-data recovery (guarded JSON parsing, fallback to defaults) — `area:data`
- [ ] `feat(engine)`: implement `level(xp)` and `xpForLevel(level)` using the `14 × (N−1)²` curve — `area:engine`
- [ ] `feat(engine)`: implement `rank(level)` and `getRankConfig(rank)` lookup table — `area:engine`
- [ ] `feat(engine)`: implement point calculation (nominal points × rank multiplier, rounded up) — `area:engine`
- [ ] `feat(engine)`: implement task point-cap validation against the current rank's max points/task — `area:engine`
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
