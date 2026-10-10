# Product Requirements Document: Daily Tracker (Gamified)

Version 2, revised at issue #12. This document is the source of truth for mechanics and data. Choices and their alternatives are logged in `docs/decisions.md`. If a rule is written neither here nor there, ask; do not guess.

## 1. Overview

Daily Tracker is a gamified habit-tracking web application built on a **token-economy model**: point values are fixed, visible, and predictable, never randomized. Tasks are grouped under five fixed character stats (Strength, Vitality, Intellect, Discipline, Social). Completing tasks earns points that raise a stat, a total Level, and a Rank (E through S); missing tasks has real, bounded consequences rather than being consequence-free.

The system is deliberately inspired by "status window" progression fiction (LitRPG-style rank/stat growth) rather than a flat points-and-badges tracker. This is a considered pivot away from the project's original no-punishment principle: real stakes were chosen specifically to force long-term consistency over a 1–5 year horizon, in exchange for a genuine risk of losing progress.

The application runs entirely client-side for this phase: all data lives in the browser via `localStorage`. No server, database, or account system is involved.

## 2. Requirements

### 2.1 Functional Requirements

**Conventions (apply everywhere)**

- **Local day.** A day is a calendar day in the device's local timezone (00:00–23:59). A `LocalDate` is the string `YYYY-MM-DD`. A local day is never derived from `toISOString()`, which is UTC.
- **Timestamps** are ISO 8601 with a UTC offset, for example `2026-10-04T10:15:30+07:00`. Any record that is grouped by day also stores its `localDate`.
- **Whole numbers.** Nominal points, awarded points, penalties, costs, XP, and Wallet are integers.
- **Floors.** `lifetimeXP ≥ 0` and `wallet ≥ 0` at all times. `statXP` never decreases.
- **Pure engine.** Engine functions never read the clock or a random source. `now`, `today`, seeds, and an id generator are parameters.
- **Two kinds of "active" stat.** A stat is _quest-active_ on a day if it has at least one registered task. A stat is _tracked_ if it has at least one completion ever (`statXP > 0`). The bare word "active" is not used.

**Tasks and stats**

- Every task belongs to exactly one of five fixed stats: STR, VIT, INT, DISC, SOC.
- A task is either an anchor task (always appears in the Daily Quest, never rotates) or a rotating task (the app picks one rotating task per stat each day).
- A task has one to three effort variants — Ringan, Sedang, Berat, each tier at most once — each with its own short description and fixed nominal point value (an integer ≥ 1). A task with exactly one variant is _single-tier_: the UI shows no tier name and no picker, and its completions record `variantTier: null`.
- A variant's nominal value is capped by the user's current Rank (_Max points/task_ in the Rank table). The app prevents saving a variant above the current cap. If the Rank later drops below a stored value, the stored value stays, awards use `min(nominal, cap)`, and the Tasks page marks the variant "Over cap".

**Daily Quest**

- Each day, every quest-active stat has quest rows: all of its anchor tasks plus exactly one rotating task (if the stat has any). The rotating pick is pseudo-random but deterministic (seeded by date and stat), stored when the day is opened, and not re-rolled when tasks are edited that day. If the picked task is deleted, a replacement is chosen from the remaining rotating tasks by the same rule.
- Each quest-active stat needs at least **one** completion that day, or **two** while penalized (below). A completion of any of the stat's quest rows counts. Only quest rows can be completed. A row can be completed at most `requiredCompletions[stat]` times per day, so a penalized stat with one row shows a `0/2` counter.
- A stat is **missed** on a day when `actualCompletions < requiredCompletions`. One completion out of two required is a miss. A stat with no task when the day is closed is not required, and is neither missed nor satisfied.
- **2x requirement.** A missed stat is flagged: the next day its requirement is 2 completions, folded into the same Daily Quest rather than a separate quest. The flag clears when the stat meets its requirement. The requirement never exceeds 2, no matter how often the stat is missed.
- **Penalty deduction.** Each missed stat, on each day it is missed, immediately deducts the current Rank's _Penalty per missed stat_ from both Lifetime XP and Wallet, each floored at 0. Penalties are fixed numbers and are not multiplied by the Rank multiplier. `statXP` is not touched. All stats on one day use the Rank the user had when that day began.
- The _Daily quest_ counter on Today is `satisfied stats / quest-active stats`. It counts stats, not rows.

**Points, Level, Rank**

- Two separate point pools exist: **Lifetime XP** (drives Level and Rank; decreases only through the penalty above) and **Wallet** (spendable on Rewards; reduced by the penalty and by purchases).
- Points awarded for a completion are `ceil(min(nominal, cap) × multiplier)`, using the Rank in effect at that moment. The same amount is added to Lifetime XP, Wallet, and the stat's `statXP`. (Checked: `Math.ceil` with the table multipliers has no floating-point drift for nominal values up to 100,000.)
- Level is derived from Lifetime XP. The XP required to reach level N is `14 × (N − 1)²`, so `level(xp) = floor(sqrt(xp / 14)) + 1`, and any `xp ≤ 0` is Level 1. The curve is deliberately steep at higher levels so the full E-to-S arc spans roughly 1–5 years of consistent use.
- The **level rank** is the Rank whose Level range contains the current Level (`rank(level)`). The user's **effective rank** is stored in `UserState.rank` and applies the balance gate:
  - If the level rank is lower than the effective rank, the effective rank drops to it immediately. There is no floor once a rank has been reached, and no gate on the way down.
  - If the level rank is higher, the effective rank rises one step at a time, and each step needs the **balance gate** to pass. If it fails, the rank-up is _blocked_, the effective rank stays, and the UI says why.
  - The effective rank is recomputed whenever Lifetime XP changes and on every rollover.
- **Balance gate.** Among tracked stats, the weakest `statXP` must be at least 50% of the average `statXP` of the tracked stats. With fewer than two tracked stats the gate passes. Integer form: `2 × weakest × count ≥ sum`. The threshold shown to the user is `ceil(sum / (2 × count))`.
- Every Rank effect (freezes, cap, multiplier, penalty) comes from the effective rank.

| Rank | Level range | Freeze/week | Max points/task | XP multiplier | Penalty per missed stat |
| ---- | ----------- | ----------- | --------------- | ------------- | ----------------------- |
| E    | 1–5         | 1           | 15              | ×0.5          | 5                       |
| D    | 6–10        | 1           | 25              | ×0.7          | 8                       |
| C    | 11–20       | 2           | 40              | ×0.85         | 13                      |
| B    | 21–35       | 2           | 60              | ×1.0          | 20                      |
| A    | 36–50       | 3           | 90              | ×1.15         | 30                      |
| S    | 51+         | 3           | unlimited       | ×1.3          | 45                      |

The Rank E penalty (5) comes from the reference history in `design.md`. The other values are about a third of _Max points/task_ and are defaults to confirm (`decisions.md` D1).

**Streaks and freezes**

- A day _counts_ toward the streak if it has at least one completion in any stat.
- Each Rank allows a number of **freezes per week** (Rank table). Weeks start on Monday (local time). A freeze is used automatically, and only when a day has no completions and a freeze is left. It keeps the streak alive for that day. A freeze protects the streak only; stat penalties still apply.
- When a day is closed (rollover), in this order: (1) if the day falls in a new week, reset `freezesUsedThisWeek` to 0; (2) if the day had no quest-active stats, change nothing; (3) else if the day counts, `currentStreak += 1`; (4) else if a freeze is left, use it and keep the streak; (5) else `currentStreak = 0`.
- `UserState.currentStreak` covers closed days only. The displayed streak (top bar chip and titles) is `currentStreak + 1` when today already has a completion, otherwise `currentStreak`.

**Rewards**

- Rewards are user-defined (title and point cost ≥ 1) and are **repeatable purchases**, not one-time claims. A purchase needs `wallet ≥ cost`, deducts the cost from Wallet only (never from Lifetime XP or `statXP`), and is logged with the reward's title and cost at that moment, so later edits or deletion of the reward do not change history.

**Titles**

- Purely cosmetic. Unlocked at milestones (catalog below) and displayed under the Rank/Level readout on Today. One title is equipped at a time, chosen in Settings. A title is unlocked once and kept.

| id                  | Name                            | Unlock condition                                    |
| ------------------- | ------------------------------- | --------------------------------------------------- |
| `streak-7`          | Konsisten 7 hari                | displayed streak reaches 7                          |
| `streak-30`         | Konsisten 30 hari               | displayed streak reaches 30                         |
| `first-reward`      | Hadiah pertama                  | first reward purchase                               |
| `rank-d` … `rank-s` | Naik ke Rank D … Naik ke Rank S | effective rank reaches that rank for the first time |
| `completions-100`   | 100 tugas selesai               | `totalCompletions ≥ 100`                            |

Names are placeholders; the ids are what is stored.

**Pages**

- Five pages, no nested routing, no login or auth screens: Today, Tasks, Rewards, History, Settings. Routing is hash-based. See `docs/design.md` for the visual and per-page specification.

### 2.2 Non-Functional Requirements

- Points, streak, level, and rank logic must have zero drift across timezone and day-boundary edge cases. CI runs the test suite under three timezones: Asia/Jakarta (UTC+7), America/Los_Angeles (DST), and Pacific/Kiritimati (UTC+14).
- All data is stored exclusively in the user's browser via `localStorage`; nothing is transmitted to a server. Clearing site data permanently deletes all progress, and there is no cross-device sync. Export/Import in Settings is the only backup.
- The app must handle a first-run state and recover gracefully from missing or corrupted `localStorage` entries. When data must be reset because of a schema mismatch, offer an export first when possible.
- A failed write (quota exceeded, storage disabled) must never crash the app. Keep the state in memory, show the persistent notice defined in `design.md` §7, and offer export.
- Daily rollover and the weekly freeze reset are computed client-side by comparing the stored date with today's date, since there is no server-side scheduler. They run on app load, when the tab becomes visible again, and when local midnight passes while the app is open. Every missed day is evaluated, not only the last one. If today is earlier than the stored date (the clock moved back), rollover does nothing.
- Every point value, penalty, and rank threshold must be visible to the user before it affects them; no hidden mechanics. This includes the rank-up gate status, freezes left this week, and the "Over cap" marker.
- Capacity: the target horizon is 5 years at about 10 completions a day. That is roughly 4 million characters (about 190 characters per Completion and 350 per DailyQuestDay) against a typical quota of about 5 million characters per origin. Ids are short random strings (8 characters). `totalCompletions` and `totalPurchases` are counters so old log entries can be compacted later without breaking titles (parked in `decisions.md`).

### 2.3 Out of Scope (current phase)

- User accounts, authentication, or any server-side auth.
- Cross-device or cross-browser sync.
- Social features (friends, leaderboards, sharing).
- Native mobile apps.
- Randomized point values — only the rotating-task _selection_ is random; a task's point value is always fixed and visible before it is completed.

## 3. Core Features

| Feature           | Description                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local persistence | All data lives in browser `localStorage`; no account or server needed                                                                              |
| Task library      | Create/edit/delete tasks, assign to a stat, mark anchor or rotating, define 1–3 effort variants                                                    |
| Daily Quest       | Auto-generated per stat per day; one seeded rotating pick per stat; anchors always included                                                        |
| Penalty system    | A missed stat requires 2x the next day (capped) and deducts Lifetime XP + Wallet immediately                                                       |
| Stats             | Five fixed stats (STR, VIT, INT, DISC, SOC), each a running total, shown on a radar chart                                                          |
| Level & Rank      | Non-linear level curve; Rank E–S with real gates (freeze allowance, point cap, XP multiplier, penalty, balance requirement); rank can rise or fall |
| Wallet & Rewards  | Separate spendable currency; user-defined, repeatable reward purchases                                                                             |
| Titles            | Cosmetic milestone unlocks, one equipped at a time, chosen in Settings                                                                             |
| History           | Long-range XP trend chart and a day-by-day log, with level-up/rank-up/rank-down events highlighted                                                 |

## 4. User Flow

1. **Open the app** — no login. First run shows an empty state inviting the user to add their first task.
2. **Today** — see Rank, Level, equipped title, XP progress, freezes left, a 5-stat radar chart, the day's Daily Quest checklist (with any active 2x requirement flagged), and a Rewards preview.
3. **Complete a task** — pick a quest row (and its effort variant, if it has several) and mark it done. Its nominal points, capped and multiplied by the current rank multiplier and rounded up, are added to Lifetime XP, Wallet, and that stat.
4. **Miss a stat** — at day rollover, any stat that did not meet its requirement is flagged: the next day it needs 2 completions, and Lifetime XP and Wallet are docked immediately by that rank's penalty.
5. **Level up / rank up** — crossing a level threshold updates the Level display. Crossing into a new Rank (once the balance requirement is also met) unlocks that rank's freeze allowance, point cap, multiplier, and penalty. If Lifetime XP falls far enough, a rank can be lost.
6. **Manage tasks** — add, edit, or remove tasks and their effort variants from the Tasks page at any time.
7. **Spend Wallet** — buy a defined reward as many times as the balance allows; Lifetime XP is never touched by a purchase.
8. **Review history** — check the long-range XP trend and the day-by-day log to see the pattern over weeks and months, not just today.

## 5. Architecture

A fully client-side single-page app. Svelte components render the UI and read/write state through Svelte stores. The stores call a small **engine** module — pure functions that compute level, rank, multiplier, penalties, and the next state — so the mechanics are unit-testable independently of the UI.

```
┌────────────────────────────────────────────────────────────┐
│                       Browser (client)                      │
│                                                              │
│   UI components ───────────▶ Svelte stores                   │
│   Today, Tasks, Rewards,     tasks, completions,             │
│   History, Settings          dailyQuestLog, rewards,         │
│                              userState, milestoneEvents      │
│                                   │            ▲             │
│                          state in │            │ next state  │
│                                   ▼            │ + events    │
│                          Engine (pure functions)             │
│                          completeTask, runRollover,          │
│                          purchaseReward, level, rank,        │
│                          penalty, gate, streak, titles       │
│                                   │                          │
│                                   ▼                          │
│                          lib/storage ──▶ localStorage        │
└────────────────────────────────────────────────────────────┘
```

- Svelte stores hold in-memory state and persist to `localStorage` on every mutation. The mutation is always `engine function → next state → persist`; components and stores contain no game rules.
- Rollover (closing past days, applying penalties, opening today and picking its rotating tasks) runs through `runRollover`. It runs on load, when the tab becomes visible, and from a timer set for the next local midnight. It is gated by comparing `lastRolloverDate` with today.
- Static bundle, deployable to any static host.

## 6. Data Model (localStorage schema)

```typescript
type Stat = 'STR' | 'VIT' | 'INT' | 'DISC' | 'SOC';
type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
type Tier = 'ringan' | 'sedang' | 'berat';
type LocalDate = string; // 'YYYY-MM-DD', device-local day
type Timestamp = string; // ISO 8601 with UTC offset, e.g. '2026-10-04T10:15:30+07:00'

// key: "daily-tracker:schemaVersion" -> number
// Bump on any change to a persisted shape. Pre-release: no migrations.
// On mismatch: offer export, then reset to defaults.

// key: "daily-tracker:tasks" -> Task[]
interface TaskVariant {
  tier: Tier;
  description: string;
  points: number; // nominal, pre-multiplier, integer >= 1
}
interface Task {
  id: string; // short random id (8 chars)
  familyName: string; // e.g. "Push up routine"
  stat: Stat;
  isAnchor: boolean; // true = always in Daily Quest, never rotated
  variants: TaskVariant[]; // 1 to 3 entries, tiers unique; exactly 1 = single-tier
  createdAt: Timestamp;
}

// key: "daily-tracker:completions" -> Completion[]
interface Completion {
  id: string;
  taskId: string;
  taskName: string; // snapshot of familyName
  stat: Stat; // snapshot
  variantTier: Tier | null; // null for single-tier tasks
  pointsAwarded: number; // after cap and multiplier, rounded up
  completedAt: Timestamp;
  localDate: LocalDate;
}

// key: "daily-tracker:dailyQuestLog" -> DailyQuestDay[]
interface DailyQuestDay {
  date: LocalDate;
  selectedTaskIdPerStat: Partial<Record<Stat, string>>; // the rotating pick per quest-active stat
  requiredCompletions: Record<Stat, number>; // 0 = not required that day, 1 normal, 2 penalized
  actualCompletions: Record<Stat, number>;
  netPointsChange: number; // Lifetime XP delta for the day (earned - deducted); live while open, final when closed
  freezeUsed: boolean;
  closed: boolean; // false while the day is open
  lifetimeXPEnd: number | null; // snapshots, filled when the day is closed
  levelEnd: number | null;
  rankEnd: Rank | null;
}

// key: "daily-tracker:rewards" -> Reward[]
interface Reward {
  id: string;
  title: string;
  cost: number; // Wallet points, integer >= 1
  createdAt: Timestamp;
}

// key: "daily-tracker:rewardPurchases" -> RewardPurchase[]
interface RewardPurchase {
  id: string;
  rewardId: string;
  rewardTitle: string; // snapshot
  costAtPurchase: number; // snapshot
  purchasedAt: Timestamp;
  localDate: LocalDate;
}

// key: "daily-tracker:userState" -> UserState
interface UserState {
  lifetimeXP: number; // >= 0; drives Level and Rank; decreases only via penalty
  wallet: number; // >= 0; decreases via penalty and purchases
  statXP: Record<Stat, number>; // per-stat totals; monotonic, never decreases
  rank: Rank; // effective rank; can lag the level rank when the gate blocks
  currentStreak: number; // closed days only
  freezesUsedThisWeek: number;
  lastFreezeWeekReset: LocalDate; // Monday of the current freeze week
  penaltyStats: Stat[]; // stats currently requiring 2 completions
  equippedTitle: string | null; // title id
  unlockedTitles: string[]; // title ids
  totalCompletions: number;
  totalPurchases: number;
  lastRolloverDate: LocalDate; // the open day; every earlier day is closed
}

// key: "daily-tracker:milestoneEvents" -> MilestoneEvent[]
type MilestoneEvent =
  | { id: string; type: 'levelUp'; localDate: LocalDate; from: number; to: number; seen: boolean }
  | {
      id: string;
      type: 'rankUp' | 'rankDown';
      localDate: LocalDate;
      from: Rank;
      to: Rank;
      seen: boolean;
    };

// key: "daily-tracker:theme" -> 'dark' | 'light'   (not part of Export)
```

**Design notes.**

- Deductions reduce `lifetimeXP` and `wallet`, but never `statXP`. A stat's historical total only ever grows. This keeps the radar chart and the balance gate honest as a record of what was actually done, while `lifetimeXP` (and therefore Level and Rank) can genuinely fall behind it after a bad stretch.
- `rank` is stored because the balance gate makes it depend on history, so it cannot be recomputed from Lifetime XP alone.
- Snapshots (`taskName`, `stat`, `rewardTitle`, `costAtPurchase`, end-of-day values) keep History correct after tasks or rewards are edited or deleted.

## 7. Engine Specification

Everything below lives in `src/engine/` unless it says `lib/`. Functions are pure. Time, seeds, and ids are parameters.

```typescript
interface AppState {
  tasks: Task[];
  completions: Completion[];
  dailyQuestLog: DailyQuestDay[];
  rewards: Reward[];
  rewardPurchases: RewardPurchase[];
  userState: UserState;
  milestoneEvents: MilestoneEvent[];
}
type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
```

### 7.1 Level, rank, points (implemented in #9–#12; keep the existing names)

- `xpForLevel(level) = 14 × (level − 1)²`. `level(xp) = floor(sqrt(max(xp, 0) / 14)) + 1`.
- `rank(level)` returns the _level rank_. It ignores the balance gate. `getRankConfig(rank)` returns the Rank table row. The penalty column is added by the penalty issue. "Unlimited" cap exists in code only and is never persisted (`Infinity` becomes `null` in JSON).
- Point calculation (#11): `ceil(min(nominal, cap) × multiplier)`. Cap validation (#12): reject non-integers, values below 1, and values above the cap.
- Edge behaviour (kept from the implementation): `level(xp)` returns 1 for `xp ≤ 0` and for non-finite input. `xpForLevel(level)` throws a `RangeError` for a non-integer or a level below 1; `level(xp)` never produces one.
- Cap validation returns `{ ok: true } | { ok: false; reason: 'INVALID_NUMBER' | 'ABOVE_CAP'; cap: number | null }`. `INVALID_NUMBER` covers non-integers, non-finite values, and values below 1. The task form maps the two reasons to the two messages in section 7 of `design.md`.

### 7.2 Date helpers (`lib/date.ts`)

`toLocalDate(d: Date)`, `toTimestamp(d: Date)` (local offset, never `Z`), `addDays(date, n)`, `daysBetween(a, b)`, `eachDay(from, toExclusive)`, `weekStart(date)` (the Monday). String-date arithmetic uses UTC math so results do not depend on the machine's timezone.

### 7.3 Daily selection

- `getQuestStats(tasks): Stat[]` — stats with at least one task, in the order STR, VIT, INT, DISC, SOC.
- `selectDailyTasks(tasks, date): Partial<Record<Stat, string>>` — for each quest-active stat with at least one rotating task, the id of the pick. Seed: 32-bit FNV-1a hash of `` `${date}:${stat}` `` fed to mulberry32. Candidates are sorted by id; index = `floor(rand() × n)`. Anchors are never returned.

### 7.4 Day evaluation and penalties

- `buildRequired(questStats, penaltyStats): Record<Stat, number>` — 0 for stats that are not quest-active, 1 normally, 2 for penalized quest-active stats.
- `evaluateDay(required, actual): { missed: Stat[]; satisfied: Stat[] }` — considers only stats with `required > 0`. Results are in the fixed stat order.
- `applyPenalty({ lifetimeXP, wallet }, rank, missedCount)` — deducts `penalty(rank) × missedCount` from each, floored at 0, and returns the new values plus `xpDeducted` and `walletDeducted` actually applied.
- `nextPenaltyStats(prev, missed, satisfied, questStats)` — add missed stats; remove satisfied stats and stats that are no longer quest-active.

### 7.5 Streak

- `closeDayStreak(streakState, day, rank)` implements the five-step rule in §2.1. `streakState` is `{ currentStreak, freezesUsedThisWeek, lastFreezeWeekReset }`; `day` is `{ date, completionCount, hasQuestStats }`. It returns the new `streakState` and `freezeUsed`.
- `displayStreak(currentStreak, todayHasCompletion)`.

### 7.6 Balance gate and rank resolution

- `getTrackedStats(statXP)` and `passesBalanceGate(statXP): { passes: boolean; weakest: Stat | null; threshold: number }`.
- `resolveRank(currentRank, level, statXP): { rank: Rank; change: 'up' | 'down' | null; blocked: boolean }`. `blocked` is true when the level rank is above the result.

### 7.7 Orchestrators

Each takes the whole `AppState` and returns the next one. Stores call them and persist the result.

`completeTask(state, { taskId, variantTier }, now, newId)` returns `Result<{ state, completion, events }, 'NO_OPEN_DAY' | 'TASK_NOT_IN_QUEST' | 'VARIANT_NOT_FOUND' | 'ROW_LIMIT_REACHED'>`:

1. The open day is `lastRolloverDate`; the task must be one of its quest rows; the row's completions today must be below `requiredCompletions[stat]`; a multi-variant task needs a matching `variantTier`.
2. Points = point calculation with `min(nominal, cap)` and the effective rank. Add them to `lifetimeXP`, `wallet`, and `statXP[stat]`. Append a `Completion` with snapshots and `localDate`. Increment `actualCompletions[stat]`, `totalCompletions`, and the open day's `netPointsChange`.
3. Recompute `level`, then `resolveRank`. Emit `levelUp` (from → to, one event even if several levels were crossed) and `rankUp` events dated today.
4. `evaluateTitles` with the displayed streak; append newly unlocked ids.

`runRollover(state, today, newId)` returns `{ state, events }`:

0. If `today < lastRolloverDate`, return the state unchanged. If equal, only make sure the open day's log entry exists.
1. For each day `d` from `lastRolloverDate` up to the day before `today`, ascending, close `d`:
   1. **Freeze week.** If `weekStart(d) > lastFreezeWeekReset`, set `freezesUsedThisWeek = 0` and `lastFreezeWeekReset = weekStart(d)`.
   2. **Required.** Use the day's stored entry, or create one with all-zero counts when none exists (a day the app was not opened). `required` is the stored value, or `buildRequired` for a created entry. A stat with no task now gets 0.
   3. **Evaluate.** `evaluateDay(required, actual)`.
   4. **Penalty.** With the Rank held at the start of `d`, apply the penalty once per missed stat. Deduct from Lifetime XP and Wallet with floors.
   5. **Flags.** `penaltyStats = nextPenaltyStats(...)`.
   6. **Streak.** `closeDayStreak`; record `freezeUsed`.
   7. **Level and rank.** Recompute `level`, then `resolveRank`. Emit `rankDown` dated `d` when the rank fell.
   8. **Close.** `closed = true`; fill `lifetimeXPEnd`, `levelEnd`, `rankEnd`; `netPointsChange` = points awarded on `d` minus `xpDeducted`.
2. Run `evaluateTitles`.
3. **Open today.** Add a `DailyQuestDay` for `today` with `selectDailyTasks`, `buildRequired`, zero counts, `closed = false`. Set `lastRolloverDate = today`.

Calling it twice with the same `today` gives the same state as calling it once.

`purchaseReward(state, rewardId, now, newId)` returns `Result<{ state, purchase }, 'REWARD_NOT_FOUND' | 'INSUFFICIENT_WALLET'>`. It needs `wallet ≥ cost`; deducts the cost from Wallet only; appends a `RewardPurchase` with `rewardTitle`, `costAtPurchase`, and `localDate`; increments `totalPurchases`; runs `evaluateTitles`.

### 7.8 Titles

- A `TITLES` constant holds the catalog in §2.1 (ids, names, conditions).
- `evaluateTitles({ userState, displayedStreak }): string[]` returns ids that are newly unlocked, never duplicates. `rank-*` titles unlock only the first time the effective rank reaches that rank.
- `equipTitle(userState, id | null)` rejects ids that are not unlocked.

## 8. Tech Stack

| Layer              | Technology                                                           |
| ------------------ | -------------------------------------------------------------------- |
| Frontend framework | Svelte 5 (runes) with Vite                                           |
| Language           | TypeScript, strict                                                   |
| Styling            | Tailwind CSS v4 (CSS-first config, tokens in `src/app.css`)          |
| Fonts              | Manrope and JetBrains Mono, self-hosted via `@fontsource-variable/*` |
| State management   | Svelte stores, persisted to `localStorage`                           |
| Engine             | Plain TypeScript functions, no framework dependency                  |
| Tests              | Vitest                                                               |
| Routing            | Hash-based, no router library                                        |
| Charts             | In-house SVG, no chart library                                       |
| Persistence        | Browser `localStorage` (Web Storage API)                             |
| Backend            | None for this phase                                                  |
| Version control    | GitHub — milestone/issue/label/PR structured workflow                |

## Appendix A. Reference scenarios (use as test vectors)

All use Rank E unless stated. A 5-point task awards 3 at Rank E (5 × 0.5 = 2.5, rounded up).

**Scenario 1 — 2x requirement, cap, and clearing.** Five quest-active stats, one 5-point anchor task each. Start: Lifetime XP 100, Wallet 100, every `statXP` 20, no flags.

| Day | Completions                        | Missed       | XP change     | Lifetime XP after | Flags after | Level                      |
| --- | ---------------------------------- | ------------ | ------------- | ----------------- | ----------- | -------------------------- |
| 1   | STR, VIT, INT, DISC once; SOC none | SOC          | +12 − 5 = +7  | 107               | SOC         | 3                          |
| 2   | every stat once (SOC needs 2)      | SOC (1 of 2) | +15 − 5 = +10 | 117               | SOC         | 3                          |
| 3   | every stat once, SOC twice         | none         | +18           | 135               | none        | 4 (levelUp 3 → 4 on day 3) |

After day 3: Wallet 135, every `statXP` 29.

**Scenario 2 — four days away.** Lifetime XP 60, Wallet 60, five quest-active stats, the open day has no completions, and the app is next opened four days later. Closing days 0–3:

| Day | Missed | Lifetime XP | Wallet | Net           |
| --- | ------ | ----------- | ------ | ------------- |
| 0   | all 5  | 35          | 35     | −25           |
| 1   | all 5  | 10          | 10     | −25           |
| 2   | all 5  | 0           | 0      | −10 (floored) |
| 3   | all 5  | 0           | 0      | 0             |

Flags after: all five stats. Level is 2 after day 0 and 1 after day 1. No rank change.

**Scenario 3 — rank drop.** Rank D, Lifetime XP 360 (Level 6), Wallet 360, every `statXP` 72. A day where all five stats are missed: penalty at Rank D is 8 per stat, 40 in total. Result: Lifetime XP 320 (Level 5), Wallet 320, effective rank D → E, one `rankDown` D → E event dated that day.

**Scenario 4 — balance gate.** `statXP` STR, VIT, INT, DISC = 100 each:

| SOC | Tracked stats | Sum | Threshold | Passes |
| --- | ------------- | --- | --------- | ------ |
| 0   | 4             | 400 | 50        | yes    |
| 10  | 5             | 410 | 41        | no     |
| 44  | 5             | 444 | 45        | no     |
| 45  | 5             | 445 | 45        | yes    |

Rank resolution: effective rank E and Level 6 with SOC = 10 stays E and is blocked. With every `statXP` equal it becomes D. At Level 12 with equal `statXP` it becomes C (two steps). Effective rank D at Level 4 drops to E.

**Scenario 5 — streak and freeze.** Rank E (1 freeze per week), weeks Monday–Sunday, every day has quest-active stats:

| Day      | Completions | Result                          | Streak | Freezes used |
| -------- | ----------- | ------------------------------- | ------ | ------------ |
| Mon      | ≥ 1         | counts                          | 1      | 0            |
| Tue      | ≥ 1         | counts                          | 2      | 0            |
| Wed      | 0           | freeze used                     | 2      | 1            |
| Thu      | ≥ 1         | counts                          | 3      | 1            |
| Fri      | 0           | no freeze left, reset           | 0      | 1            |
| Sat      | ≥ 1         | counts                          | 1      | 1            |
| Sun      | 0           | no freeze left, reset           | 0      | 1            |
| next Mon | ≥ 1         | new week resets freezes; counts | 1      | 0            |

## Appendix B. Level thresholds

XP needed to reach a level: L2 = 14, L3 = 56, L4 = 126, L5 = 224, L6 = 350, L11 = 1,400, L21 = 5,600, L36 = 17,150, L51 = 35,000.

`level(xp)` vectors:

| xp    | −5  | 0   | 13  | 14  | 55  | 56  | 349 | 350 | 1,399 | 1,400 | 5,599 | 5,600 | 17,149 | 17,150 | 34,999 | 35,000 |
| ----- | --- | --- | --- | --- | --- | --- | --- | --- | ----- | ----- | ----- | ----- | ------ | ------ | ------ | ------ |
| level | 1   | 1   | 1   | 2   | 2   | 3   | 5   | 6   | 10    | 11    | 20    | 21    | 35     | 36     | 50     | 51     |

`rank(level)`: 5 → E, 6 → D, 10 → D, 11 → C, 20 → C, 21 → B, 35 → B, 36 → A, 50 → A, 51 → S.
