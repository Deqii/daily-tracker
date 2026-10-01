#!/usr/bin/env bash
set -euo pipefail

# Auto-generated from tasks.md. One `gh issue create` per checklist line.
# Run once, from the repo root, with `gh auth login` already done.
# Safe to re-run: gh issue create does not dedupe, so only run this once.

echo '[1] chore: scaffold Svelte + Vite + TypeScript project'
gh issue create --title 'chore: scaffold Svelte + Vite + TypeScript project' --body '## What
Scaffold Svelte + Vite + TypeScript project, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] scaffold Svelte + Vite + TypeScript project

## Branch
`chore/scaffold-svelte-vite-typescript-project`' --label type:chore --label area:frontend --milestone 'Milestone 1 — Project Setup'

echo '[2] chore: install and configure Tailwind CSS'
gh issue create --title 'chore: install and configure Tailwind CSS' --body '## What
Install and configure Tailwind CSS, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] install and configure Tailwind CSS

## Branch
`chore/install-and-configure-tailwind-css`' --label type:chore --label area:frontend --milestone 'Milestone 1 — Project Setup'

echo '[3] chore: configure ESLint and Prettier'
gh issue create --title 'chore: configure ESLint and Prettier' --body '## What
Configure ESLint and Prettier, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] configure ESLint and Prettier

## Branch
`chore/configure-eslint-and-prettier`' --label type:chore --label area:frontend --milestone 'Milestone 1 — Project Setup'

echo '[4] chore: define folder structure (`components/`, `stores/`, `engine/`, `lib/`)'
gh issue create --title 'chore: define folder structure (`components/`, `stores/`, `engine/`, `lib/`)' --body '## What
Define folder structure (`components/`, `stores/`, `engine/`, `lib/`), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] define folder structure (`components/`, `stores/`, `engine/`, `lib/`)

## Branch
`chore/define-folder-structure-components-store`' --label type:chore --label area:frontend --milestone 'Milestone 1 — Project Setup'

echo '[5] feat: define TypeScript types for Task, TaskVariant, Completion, Reward, RewardPurchase, DailyQuestDay, UserState'
gh issue create --title 'feat: define TypeScript types for Task, TaskVariant, Completion, Reward, RewardPurchase, DailyQuestDay, UserState' --body '## What
Define TypeScript types for Task, TaskVariant, Completion, Reward, RewardPurchase, DailyQuestDay, UserState, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] define TypeScript types for Task, TaskVariant, Completion, Reward, RewardPurchase, DailyQuestDay, UserState

## Branch
`feat/define-typescript-types-for-task-taskvar`' --label type:feature --label area:data --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[6] feat: implement localStorage read/write helpers keyed by `schemaVersion`'
gh issue create --title 'feat: implement localStorage read/write helpers keyed by `schemaVersion`' --body '## What
Implement localStorage read/write helpers keyed by `schemaVersion`, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement localStorage read/write helpers keyed by `schemaVersion`

## Branch
`feat/implement-localstorage-read-write-helper`' --label type:feature --label area:data --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[7] feat: implement first-run initialization with empty-state defaults'
gh issue create --title 'feat: implement first-run initialization with empty-state defaults' --body '## What
Implement first-run initialization with empty-state defaults, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement first-run initialization with empty-state defaults

## Branch
`feat/implement-first-run-initialization-with-`' --label type:feature --label area:data --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[8] feat: implement corrupted-data recovery (guarded JSON parsing, fallback to defaults)'
gh issue create --title 'feat: implement corrupted-data recovery (guarded JSON parsing, fallback to defaults)' --body '## What
Implement corrupted-data recovery (guarded JSON parsing, fallback to defaults), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement corrupted-data recovery (guarded JSON parsing, fallback to defaults)

## Branch
`feat/implement-corrupted-data-recovery-guarde`' --label type:feature --label area:data --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[9] feat: implement `level(xp)` and `xpForLevel(level)` using the `14 × (N−1)²` curve'
gh issue create --title 'feat: implement `level(xp)` and `xpForLevel(level)` using the `14 × (N−1)²` curve' --body '## What
Implement `level(xp)` and `xpForLevel(level)` using the `14 × (N−1)²` curve, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement `level(xp)` and `xpForLevel(level)` using the `14 × (N−1)²` curve

## Branch
`feat/implement-level-xp-and-xpforlevel-level-`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[10] feat: implement `rank(level)` and `getRankConfig(rank)` lookup table'
gh issue create --title 'feat: implement `rank(level)` and `getRankConfig(rank)` lookup table' --body '## What
Implement `rank(level)` and `getRankConfig(rank)` lookup table, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement `rank(level)` and `getRankConfig(rank)` lookup table

## Branch
`feat/implement-rank-level-and-getrankconfig-r`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[11] feat: implement point calculation (nominal points × rank multiplier, rounded up)'
gh issue create --title 'feat: implement point calculation (nominal points × rank multiplier, rounded up)' --body '## What
Implement point calculation (nominal points × rank multiplier, rounded up), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement point calculation (nominal points × rank multiplier, rounded up)

## Branch
`feat/implement-point-calculation-nominal-poin`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[12] feat: implement task point-cap validation against the current rank'"'"'s max points/task'
gh issue create --title 'feat: implement task point-cap validation against the current rank'"'"'s max points/task' --body '## What
Implement task point-cap validation against the current rank'"'"'s max points/task, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement task point-cap validation against the current rank'"'"'s max points/task

## Branch
`feat/implement-task-point-cap-validation-agai`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[13] feat: implement deterministic daily rotating-task selection, one per active stat'
gh issue create --title 'feat: implement deterministic daily rotating-task selection, one per active stat' --body '## What
Implement deterministic daily rotating-task selection, one per active stat, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement deterministic daily rotating-task selection, one per active stat

## Branch
`feat/implement-deterministic-daily-rotating-t`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[14] feat: implement Daily Quest evaluation at day rollover (required vs actual completions per stat)'
gh issue create --title 'feat: implement Daily Quest evaluation at day rollover (required vs actual completions per stat)' --body '## What
Implement Daily Quest evaluation at day rollover (required vs actual completions per stat), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement Daily Quest evaluation at day rollover (required vs actual completions per stat)

## Branch
`feat/implement-daily-quest-evaluation-at-day-`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[15] feat: implement penalty deduction (Lifetime XP and Wallet) on a missed stat'
gh issue create --title 'feat: implement penalty deduction (Lifetime XP and Wallet) on a missed stat' --body '## What
Implement penalty deduction (Lifetime XP and Wallet) on a missed stat, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement penalty deduction (Lifetime XP and Wallet) on a missed stat

## Branch
`feat/implement-penalty-deduction-lifetime-xp-`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[16] feat: implement the 2x-completion penalty flag with a hard cap (no further escalation)'
gh issue create --title 'feat: implement the 2x-completion penalty flag with a hard cap (no further escalation)' --body '## What
Implement the 2x-completion penalty flag with a hard cap (no further escalation), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the 2x-completion penalty flag with a hard cap (no further escalation)

## Branch
`feat/implement-the-2x-completion-penalty-flag`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[17] feat: implement streak calculation with one freeze/week per the rank table'
gh issue create --title 'feat: implement streak calculation with one freeze/week per the rank table' --body '## What
Implement streak calculation with one freeze/week per the rank table, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement streak calculation with one freeze/week per the rank table

## Branch
`feat/implement-streak-calculation-with-one-fr`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[18] feat: implement the rank-up balance gate (weakest active stat ≥ 50% of active-stat average)'
gh issue create --title 'feat: implement the rank-up balance gate (weakest active stat ≥ 50% of active-stat average)' --body '## What
Implement the rank-up balance gate (weakest active stat ≥ 50% of active-stat average), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the rank-up balance gate (weakest active stat ≥ 50% of active-stat average)

## Branch
`feat/implement-the-rank-up-balance-gate-weake`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[19] feat: implement rank recomputation so a rank can be lost when Lifetime XP falls'
gh issue create --title 'feat: implement rank recomputation so a rank can be lost when Lifetime XP falls' --body '## What
Implement rank recomputation so a rank can be lost when Lifetime XP falls, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement rank recomputation so a rank can be lost when Lifetime XP falls

## Branch
`feat/implement-rank-recomputation-so-a-rank-c`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[20] feat: implement reward purchase (Wallet deduction + purchase log entry)'
gh issue create --title 'feat: implement reward purchase (Wallet deduction + purchase log entry)' --body '## What
Implement reward purchase (Wallet deduction + purchase log entry), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement reward purchase (Wallet deduction + purchase log entry)

## Branch
`feat/implement-reward-purchase-wallet-deducti`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[21] feat: implement title unlock condition checks (streaks, purchases, rank-ups, completions)'
gh issue create --title 'feat: implement title unlock condition checks (streaks, purchases, rank-ups, completions)' --body '## What
Implement title unlock condition checks (streaks, purchases, rank-ups, completions), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement title unlock condition checks (streaks, purchases, rank-ups, completions)

## Branch
`feat/implement-title-unlock-condition-checks-`' --label type:feature --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[22] test: unit tests for level/rank boundary values at every rank transition'
gh issue create --title 'test: unit tests for level/rank boundary values at every rank transition' --body '## What
Unit tests for level/rank boundary values at every rank transition, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] unit tests for level/rank boundary values at every rank transition

## Branch
`test/unit-tests-for-level-rank-boundary-value`' --label type:chore --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[23] test: unit tests for timezone and day-boundary edge cases in rollover'
gh issue create --title 'test: unit tests for timezone and day-boundary edge cases in rollover' --body '## What
Unit tests for timezone and day-boundary edge cases in rollover, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] unit tests for timezone and day-boundary edge cases in rollover

## Branch
`test/unit-tests-for-timezone-and-day-boundary`' --label type:chore --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[24] test: unit tests for penalty deduction and the 2x cap behavior'
gh issue create --title 'test: unit tests for penalty deduction and the 2x cap behavior' --body '## What
Unit tests for penalty deduction and the 2x cap behavior, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] unit tests for penalty deduction and the 2x cap behavior

## Branch
`test/unit-tests-for-penalty-deduction-and-the`' --label type:chore --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[25] test: unit tests for the rank-up balance gate, including a stat with zero completions'
gh issue create --title 'test: unit tests for the rank-up balance gate, including a stat with zero completions' --body '## What
Unit tests for the rank-up balance gate, including a stat with zero completions, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] unit tests for the rank-up balance gate, including a stat with zero completions

## Branch
`test/unit-tests-for-the-rank-up-balance-gate-`' --label type:chore --label area:engine --milestone 'Milestone 2 — Data Layer & Engine (no UI)'

echo '[26] feat: implement the shared top bar (wordmark, 5 nav items, Rank/Streak/Wallet chips)'
gh issue create --title 'feat: implement the shared top bar (wordmark, 5 nav items, Rank/Streak/Wallet chips)' --body '## What
Implement the shared top bar (wordmark, 5 nav items, Rank/Streak/Wallet chips), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the shared top bar (wordmark, 5 nav items, Rank/Streak/Wallet chips)

## Branch
`feat/implement-the-shared-top-bar-wordmark-5-`' --label type:feature --label area:frontend --milestone 'Milestone 3 — App Shell'

echo '[27] feat: implement client-side routing between the 5 pages'
gh issue create --title 'feat: implement client-side routing between the 5 pages' --body '## What
Implement client-side routing between the 5 pages, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement client-side routing between the 5 pages

## Branch
`feat/implement-client-side-routing-between-th`' --label type:feature --label area:frontend --milestone 'Milestone 3 — App Shell'

echo '[28] feat: implement the dark/light theme toggle with persistence'
gh issue create --title 'feat: implement the dark/light theme toggle with persistence' --body '## What
Implement the dark/light theme toggle with persistence, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the dark/light theme toggle with persistence

## Branch
`feat/implement-the-dark-light-theme-toggle-wi`' --label type:feature --label area:frontend --milestone 'Milestone 3 — App Shell'

echo '[29] feat: implement the reusable corner-bracket panel frame component'
gh issue create --title 'feat: implement the reusable corner-bracket panel frame component' --body '## What
Implement the reusable corner-bracket panel frame component, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the reusable corner-bracket panel frame component

## Branch
`feat/implement-the-reusable-corner-bracket-pa`' --label type:feature --label area:frontend --milestone 'Milestone 3 — App Shell'

echo '[30] feat: implement the coin icon component'
gh issue create --title 'feat: implement the coin icon component' --body '## What
Implement the coin icon component, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the coin icon component

## Branch
`feat/implement-the-coin-icon-component`' --label type:feature --label area:frontend --milestone 'Milestone 3 — App Shell'

echo '[31] feat: implement the rank-accent color token system as CSS variables per rank'
gh issue create --title 'feat: implement the rank-accent color token system as CSS variables per rank' --body '## What
Implement the rank-accent color token system as CSS variables per rank, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the rank-accent color token system as CSS variables per rank

## Branch
`feat/implement-the-rank-accent-color-token-sy`' --label type:feature --label area:design --milestone 'Milestone 3 — App Shell'

echo '[32] feat: implement the Rank/Level readout with rank-accent glow'
gh issue create --title 'feat: implement the Rank/Level readout with rank-accent glow' --body '## What
Implement the Rank/Level readout with rank-accent glow, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the Rank/Level readout with rank-accent glow

## Branch
`feat/implement-the-rank-level-readout-with-ra`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[33] feat: implement the equipped-title display line'
gh issue create --title 'feat: implement the equipped-title display line' --body '## What
Implement the equipped-title display line, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the equipped-title display line

## Branch
`feat/implement-the-equipped-title-display-lin`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[34] feat: implement the XP progress bar with in-level progress calculation'
gh issue create --title 'feat: implement the XP progress bar with in-level progress calculation' --body '## What
Implement the XP progress bar with in-level progress calculation, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the XP progress bar with in-level progress calculation

## Branch
`feat/implement-the-xp-progress-bar-with-in-le`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[35] feat: implement the 5-stat radar chart component'
gh issue create --title 'feat: implement the 5-stat radar chart component' --body '## What
Implement the 5-stat radar chart component, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the 5-stat radar chart component

## Branch
`feat/implement-the-5-stat-radar-chart-compone`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[36] feat: implement the system-message and penalty notification blocks'
gh issue create --title 'feat: implement the system-message and penalty notification blocks' --body '## What
Implement the system-message and penalty notification blocks, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the system-message and penalty notification blocks

## Branch
`feat/implement-the-system-message-and-penalty`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[37] feat: implement the Daily Quest checklist (anchor, rotating, and penalty row states)'
gh issue create --title 'feat: implement the Daily Quest checklist (anchor, rotating, and penalty row states)' --body '## What
Implement the Daily Quest checklist (anchor, rotating, and penalty row states), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the Daily Quest checklist (anchor, rotating, and penalty row states)

## Branch
`feat/implement-the-daily-quest-checklist-anch`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[38] feat: wire task completion on Today to the engine'"'"'s point calculation and persistence'
gh issue create --title 'feat: wire task completion on Today to the engine'"'"'s point calculation and persistence' --body '## What
Wire task completion on Today to the engine'"'"'s point calculation and persistence, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] wire task completion on Today to the engine'"'"'s point calculation and persistence

## Branch
`feat/wire-task-completion-on-today-to-the-eng`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[39] feat: implement the Rewards preview section on Today'
gh issue create --title 'feat: implement the Rewards preview section on Today' --body '## What
Implement the Rewards preview section on Today, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the Rewards preview section on Today

## Branch
`feat/implement-the-rewards-preview-section-on`' --label type:feature --label area:frontend --milestone 'Milestone 4 — Today Page'

echo '[40] feat: implement the task list grouped by stat with an active-count header'
gh issue create --title 'feat: implement the task list grouped by stat with an active-count header' --body '## What
Implement the task list grouped by stat with an active-count header, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the task list grouped by stat with an active-count header

## Branch
`feat/implement-the-task-list-grouped-by-stat-`' --label type:feature --label area:frontend --milestone 'Milestone 5 — Tasks Page'

echo '[41] feat: implement the task-family row with indented effort-variant sub-rows'
gh issue create --title 'feat: implement the task-family row with indented effort-variant sub-rows' --body '## What
Implement the task-family row with indented effort-variant sub-rows, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the task-family row with indented effort-variant sub-rows

## Branch
`feat/implement-the-task-family-row-with-inden`' --label type:feature --label area:frontend --milestone 'Milestone 5 — Tasks Page'

echo '[42] feat: implement the single-tier task row'
gh issue create --title 'feat: implement the single-tier task row' --body '## What
Implement the single-tier task row, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the single-tier task row

## Branch
`feat/implement-the-single-tier-task-row`' --label type:feature --label area:frontend --milestone 'Milestone 5 — Tasks Page'

echo '[43] feat: implement the Add/Edit task form (name, stat, anchor toggle, 1–3 variants)'
gh issue create --title 'feat: implement the Add/Edit task form (name, stat, anchor toggle, 1–3 variants)' --body '## What
Implement the Add/Edit task form (name, stat, anchor toggle, 1–3 variants), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the Add/Edit task form (name, stat, anchor toggle, 1–3 variants)

## Branch
`feat/implement-the-add-edit-task-form-name-st`' --label type:feature --label area:frontend --milestone 'Milestone 5 — Tasks Page'

echo '[44] feat: implement point-cap validation feedback in the task form'
gh issue create --title 'feat: implement point-cap validation feedback in the task form' --body '## What
Implement point-cap validation feedback in the task form, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement point-cap validation feedback in the task form

## Branch
`feat/implement-point-cap-validation-feedback-`' --label type:feature --label area:frontend --milestone 'Milestone 5 — Tasks Page'

echo '[45] feat: implement task delete with a confirmation step'
gh issue create --title 'feat: implement task delete with a confirmation step' --body '## What
Implement task delete with a confirmation step, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement task delete with a confirmation step

## Branch
`feat/implement-task-delete-with-a-confirmatio`' --label type:feature --label area:frontend --milestone 'Milestone 5 — Tasks Page'

echo '[46] feat: implement the rewards list (cost, purchase count, buy/locked state)'
gh issue create --title 'feat: implement the rewards list (cost, purchase count, buy/locked state)' --body '## What
Implement the rewards list (cost, purchase count, buy/locked state), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the rewards list (cost, purchase count, buy/locked state)

## Branch
`feat/implement-the-rewards-list-cost-purchase`' --label type:feature --label area:frontend --milestone 'Milestone 6 — Rewards Page'

echo '[47] feat: implement the Add/Edit reward form'
gh issue create --title 'feat: implement the Add/Edit reward form' --body '## What
Implement the Add/Edit reward form, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the Add/Edit reward form

## Branch
`feat/implement-the-add-edit-reward-form`' --label type:feature --label area:frontend --milestone 'Milestone 6 — Rewards Page'

echo '[48] feat: wire the Buy action to the engine'"'"'s purchase logic'
gh issue create --title 'feat: wire the Buy action to the engine'"'"'s purchase logic' --body '## What
Wire the Buy action to the engine'"'"'s purchase logic, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] wire the Buy action to the engine'"'"'s purchase logic

## Branch
`feat/wire-the-buy-action-to-the-engine-s-purc`' --label type:feature --label area:frontend --milestone 'Milestone 6 — Rewards Page'

echo '[49] feat: implement the XP trend line chart with level-up/rank-change markers'
gh issue create --title 'feat: implement the XP trend line chart with level-up/rank-change markers' --body '## What
Implement the XP trend line chart with level-up/rank-change markers, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the XP trend line chart with level-up/rank-change markers

## Branch
`feat/implement-the-xp-trend-line-chart-with-l`' --label type:feature --label area:frontend --milestone 'Milestone 7 — History Page'

echo '[50] feat: implement the day-by-day log table (per-stat check/dash/pending, net points)'
gh issue create --title 'feat: implement the day-by-day log table (per-stat check/dash/pending, net points)' --body '## What
Implement the day-by-day log table (per-stat check/dash/pending, net points), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the day-by-day log table (per-stat check/dash/pending, net points)

## Branch
`feat/implement-the-day-by-day-log-table-per-s`' --label type:feature --label area:frontend --milestone 'Milestone 7 — History Page'

echo '[51] feat: implement milestone highlight rows (level up, rank up, rank down)'
gh issue create --title 'feat: implement milestone highlight rows (level up, rank up, rank down)' --body '## What
Implement milestone highlight rows (level up, rank up, rank down), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement milestone highlight rows (level up, rank up, rank down)

## Branch
`feat/implement-milestone-highlight-rows-level`' --label type:feature --label area:frontend --milestone 'Milestone 7 — History Page'

echo '[52] feat: implement the theme toggle row'
gh issue create --title 'feat: implement the theme toggle row' --body '## What
Implement the theme toggle row, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the theme toggle row

## Branch
`feat/implement-the-theme-toggle-row`' --label type:feature --label area:frontend --milestone 'Milestone 8 — Settings Page'

echo '[53] feat: implement the expandable rank-reference table'
gh issue create --title 'feat: implement the expandable rank-reference table' --body '## What
Implement the expandable rank-reference table, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the expandable rank-reference table

## Branch
`feat/implement-the-expandable-rank-reference-`' --label type:feature --label area:frontend --milestone 'Milestone 8 — Settings Page'

echo '[54] feat: implement data export as a downloadable JSON file'
gh issue create --title 'feat: implement data export as a downloadable JSON file' --body '## What
Implement data export as a downloadable JSON file, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement data export as a downloadable JSON file

## Branch
`feat/implement-data-export-as-a-downloadable-`' --label type:feature --label area:frontend --milestone 'Milestone 8 — Settings Page'

echo '[55] feat: implement data import with schema validation'
gh issue create --title 'feat: implement data import with schema validation' --body '## What
Implement data import with schema validation, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement data import with schema validation

## Branch
`feat/implement-data-import-with-schema-valida`' --label type:feature --label area:frontend --milestone 'Milestone 8 — Settings Page'

echo '[56] feat: implement the level-up reveal overlay (motion + glow, reusing the corner-bracket frame)'
gh issue create --title 'feat: implement the level-up reveal overlay (motion + glow, reusing the corner-bracket frame)' --body '## What
Implement the level-up reveal overlay (motion + glow, reusing the corner-bracket frame), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the level-up reveal overlay (motion + glow, reusing the corner-bracket frame)

## Branch
`feat/implement-the-level-up-reveal-overlay-mo`' --label type:feature --label area:frontend --milestone 'Milestone 9 — Level-up / Rank-up Reveal'

echo '[57] feat: implement the rank-up reveal overlay (new rank'"'"'s config summary)'
gh issue create --title 'feat: implement the rank-up reveal overlay (new rank'"'"'s config summary)' --body '## What
Implement the rank-up reveal overlay (new rank'"'"'s config summary), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement the rank-up reveal overlay (new rank'"'"'s config summary)

## Branch
`feat/implement-the-rank-up-reveal-overlay-new`' --label type:feature --label area:frontend --milestone 'Milestone 9 — Level-up / Rank-up Reveal'

echo '[58] feat: implement a quiet rank-down notice with no celebratory motion'
gh issue create --title 'feat: implement a quiet rank-down notice with no celebratory motion' --body '## What
Implement a quiet rank-down notice with no celebratory motion, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement a quiet rank-down notice with no celebratory motion

## Branch
`feat/implement-a-quiet-rank-down-notice-with-`' --label type:feature --label area:frontend --milestone 'Milestone 9 — Level-up / Rank-up Reveal'

echo '[59] feat: respect `prefers-reduced-motion` for every reveal overlay'
gh issue create --title 'feat: respect `prefers-reduced-motion` for every reveal overlay' --body '## What
Respect `prefers-reduced-motion` for every reveal overlay, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] respect `prefers-reduced-motion` for every reveal overlay

## Branch
`feat/respect-prefers-reduced-motion-for-every`' --label type:feature --label area:frontend --milestone 'Milestone 9 — Level-up / Rank-up Reveal'

echo '[60] feat: implement first-run empty states (no tasks, no rewards)'
gh issue create --title 'feat: implement first-run empty states (no tasks, no rewards)' --body '## What
Implement first-run empty states (no tasks, no rewards), per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] implement first-run empty states (no tasks, no rewards)

## Branch
`feat/implement-first-run-empty-states-no-task`' --label type:feature --label area:frontend --milestone 'Milestone 10 — Polish & Deploy'

echo '[61] chore: Lighthouse pass, target 90+'
gh issue create --title 'chore: Lighthouse pass, target 90+' --body '## What
Lighthouse pass, target 90+, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] Lighthouse pass, target 90+

## Branch
`chore/lighthouse-pass-target-90`' --label type:chore --label area:frontend --milestone 'Milestone 10 — Polish & Deploy'

echo '[62] chore: configure static hosting and domain'
gh issue create --title 'chore: configure static hosting and domain' --body '## What
Configure static hosting and domain, per `daily-tracker-prd.md` and `desain.md`.

## Tasks
- [ ] configure static hosting and domain

## Branch
`chore/configure-static-hosting-and-domain`' --label type:chore --label area:frontend --milestone 'Milestone 10 — Polish & Deploy'

