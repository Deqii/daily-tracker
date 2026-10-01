# Product Requirements Document: Daily Tracker (Gamified)

## 1. Overview

Daily Tracker is a gamified habit-tracking web application built on a **token-economy model**: point values are fixed, visible, and predictable, never randomized. Tasks are grouped under five fixed character stats (Strength, Vitality, Intellect, Discipline, Social). Completing tasks earns points that raise a stat, a total Level, and a Rank (E through S); missing tasks has real, bounded consequences rather than being consequence-free.

The system is deliberately inspired by "status window" progression fiction (LitRPG-style rank/stat growth) rather than a flat points-and-badges tracker. This is a considered pivot away from the project's original no-punishment principle: real stakes were chosen specifically to force long-term consistency over a 1–5 year horizon, in exchange for a genuine risk of losing progress.

The application runs entirely client-side for this phase: all data lives in the browser via `localStorage`. No server, database, or account system is involved for this phase (see Future Considerations for a later migration path).

## 2. Requirements

### 2.1 Functional Requirements

**Tasks and stats**

- Every task belongs to exactly one of five fixed stats: STR, VIT, INT, DISC, SOC.
- A task is either an anchor task (always appears every day, never rotates) or a rotating task (one of possibly several registered tasks for that stat; the app picks one at random each day to be that stat's quest).
- A task has one to three effort variants — Ringan, Sedang, Berat — each with its own short description of what that tier requires and its own fixed point value. A task can also have a single tier with no variant selection at all.
- A task's nominal point value is capped by the user's current Rank (see Rank table below); the app must prevent saving a variant above the current cap.

**Daily Quest**

- Each day, the Daily Quest requires at least one completion in every stat that has at least one registered task ("active" stat).
- If a stat's requirement was missed the previous day, that stat's requirement becomes 2 completions instead of 1, folded into the same day's Daily Quest rather than a separate quest. Repeated failure on that stat stays capped at 2 completions; it never escalates further.
- A missed stat also immediately deducts points from both Lifetime XP and Wallet, in addition to the 2x next-day requirement. The deduction equals the current rank's Ringan-tier point value, per missed stat, per day it is missed.

**Points, Level, Rank**

- Two separate point pools exist: **Lifetime XP** (drives Level, Rank, and per-stat totals; can decrease via the deduction above) and **Wallet** (spendable balance for Rewards; also reduced by the same deduction, and by reward purchases).
- A task's nominal points are multiplied by the current Rank's multiplier before being added to Lifetime XP, Wallet, and the relevant stat's total; the result is rounded up to the nearest whole point.
- Level is derived from Lifetime XP using a non-linear curve: the XP required to reach level N is `14 × (N − 1)²`. This is deliberately steep at higher levels so the full E-to-S arc spans roughly 1–5 years of consistent use.
- Rank (E, D, C, B, A, S) is derived from the current Level via the table below, and can move up or down as Lifetime XP changes — there is no floor once a rank has been reached.
- Advancing to the next Rank additionally requires the weakest "active" stat (a stat with at least one completion ever) to be at least 50% of the average Lifetime XP across all active stats. This prevents ranking up by grinding a single stat while ignoring the others.

| Rank | Level range | Freeze/week | Max points/task | XP multiplier |
| ---- | ----------- | ----------- | --------------- | ------------- |
| E    | 1–5         | 1           | 15              | ×0.5          |
| D    | 6–10        | 1           | 25              | ×0.7          |
| C    | 11–20       | 2           | 40              | ×0.85         |
| B    | 21–35       | 2           | 60              | ×1.0          |
| A    | 36–50       | 3           | 90              | ×1.15         |
| S    | 51+         | 3           | unlimited       | ×1.3          |

**Streaks**

- A streak counts consecutive days with at least one completion. One freeze per week (allowance per the Rank table) preserves the streak through a single missed day without a completion.

**Rewards**

- Rewards are user-defined (title + point cost) and are **repeatable purchases**, not one-time claims: each purchase deducts its cost from Wallet only, never from Lifetime XP, and is logged so the app can show how many times a reward has been bought.

**Titles**

- Purely cosmetic, unlocked at milestones (7-day streak, 30-day streak, first reward purchased, each rank-up, 100 total completions) and displayed under the Rank/Level readout on the Today screen. One title can be equipped at a time.

**Pages**

- Five pages, no nested routing, no login/auth screens: Today, Tasks, Rewards, History, Settings. See `design.md` for the full visual and per-page specification.

### 2.2 Non-Functional Requirements

- Points, streak, level, and rank logic must have zero drift across timezone and day-boundary edge cases.
- All data is stored exclusively in the user's browser via `localStorage`; nothing is transmitted to a server. Clearing site data permanently deletes all progress; there is no cross-device sync.
- The app must handle a first-run state (no data yet) and recover gracefully from missing or corrupted `localStorage` entries.
- Every point value, penalty, and rank threshold must be visible to the user before it affects them; no hidden mechanics.
- Weekly streak-freeze reset and daily quest rollover must be computed client-side on load by comparing the stored date against the current date, since there is no server-side scheduler.

### 2.3 Out of Scope (current phase)

- User accounts, authentication, or any server-side auth.
- Cross-device or cross-browser sync.
- Social features (friends, leaderboards, sharing).
- Native mobile apps.
- Randomized point values — only the rotating-task _selection_ is randomized; a task's point value is always fixed and visible before it is completed.

### 2.4 Superseded from earlier drafts

An earlier draft of this project introduced a separate "Quest tier" label (Normal/Elite/Boss) auto-derived from a task's point value, before the effort-variant system (Ringan/Sedang/Berat) existed. The two solved the same problem; the effort-variant system is what shipped in `design.md` and this document, and Quest tier is dropped rather than kept as a redundant second label.

## 3. Core Features

| Feature           | Description                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Local persistence | All data lives in browser `localStorage`; no account or server needed                                                                     |
| Task library      | Create/edit/delete tasks, assign to a stat, mark anchor or rotating, define 1–3 effort variants                                           |
| Daily Quest       | Auto-generated per stat per day; rotating tasks picked at random; anchors always included                                                 |
| Penalty system    | Missed stat requires 2x next day (capped) and deducts Lifetime XP + Wallet immediately                                                    |
| Stats             | Five fixed stats (STR, VIT, INT, DISC, SOC), each a running Lifetime XP total, shown on a radar chart                                     |
| Level & Rank      | Non-linear level curve; Rank E–S with real gates (freeze allowance, point cap, XP multiplier, balance requirement); rank can rise or fall |
| Wallet & Rewards  | Separate spendable currency; user-defined, repeatable reward purchases                                                                    |
| Titles            | Cosmetic milestone unlocks, one equipped at a time                                                                                        |
| History           | Long-range XP trend chart and a day-by-day log, with level-up/rank-up/rank-down events highlighted                                        |

## 4. User Flow

1. **Open the app** — no login. First run shows an empty state inviting the user to add their first task.
2. **Today** — see Rank, Level, equipped title, XP progress, a 5-stat radar chart, the day's Daily Quest checklist (with any active 2x penalty flagged), and a Rewards preview.
3. **Complete a task** — pick a task (and its effort variant, if any) and mark it done. Its nominal points are multiplied by the current rank multiplier, rounded up, and added to Lifetime XP, Wallet, and that stat.
4. **Miss a stat** — at day rollover, any stat with zero completions is flagged: next day it needs 2 completions, and Lifetime XP and Wallet are docked immediately by that rank's Ringan value.
5. **Level up / rank up** — crossing a level threshold updates the Level display; crossing into a new Rank (once the balance requirement is also met) unlocks that rank's freeze allowance, point cap, and multiplier — or, if Lifetime XP has fallen far enough, a rank can be lost.
6. **Manage tasks** — add, edit, or remove tasks and their effort variants from the Tasks page at any time.
7. **Spend Wallet** — buy a defined reward as many times as the balance allows; Lifetime XP is never touched by a purchase.
8. **Review history** — check the long-range XP trend and the day-by-day log to see the pattern over weeks and months, not just today.

## 5. Architecture

A fully client-side single-page app. Svelte components render the UI and read/write state through a small **engine** module — pure functions that compute level/rank/multiplier/penalties from stored state — so the mechanics are unit-testable independently of the UI.

```
┌─────────────────────────────────────────────────┐
│                  Browser (client)                 │
│                                                    │
│  ┌──────────────────────────────────────────┐    │
│  │              Svelte App                     │    │
│  │  ┌──────────────┐   ┌───────────────────┐ │    │
│  │  │ UI components│   │  Svelte stores      │ │    │
│  │  │ Today, Tasks,│◀─▶│  (tasks, completions,│ │    │
│  │  │ Rewards,     │   │  userState, rewards) │ │    │
│  │  │ History,     │   └──────────┬──────────┘ │    │
│  │  │ Settings     │              │             │    │
│  │  └──────────────┘              ▼             │    │
│  │                    ┌────────────────────┐     │    │
│  │                    │   Engine (pure fns)  │     │    │
│  │                    │  level, rank, xp,    │     │    │
│  │                    │  penalty, gate       │     │    │
│  │                    └──────────┬──────────┘     │    │
│  └───────────────────────────────┼────────────────┘    │
│                                  ▼                       │
│                     ┌─────────────────────┐              │
│                     │  localStorage         │              │
│                     └─────────────────────┘              │
└───────────────────────────────────────────────────┘
```

- Svelte writable stores hold in-memory state and persist to `localStorage` on every mutation.
- Daily rollover (evaluating yesterday's Daily Quest, applying penalties/deductions, picking today's rotating tasks) runs once per load, gated by comparing the stored last-evaluated date to today's date.
- Static bundle, deployable to any static host.

## 6. Data Model (localStorage schema)

```typescript
type Stat = "STR" | "VIT" | "INT" | "DISC" | "SOC";
type Rank = "E" | "D" | "C" | "B" | "A" | "S";
type Tier = "ringan" | "sedang" | "berat";

// key: "daily-tracker:schemaVersion" -> number

// key: "daily-tracker:tasks" -> Task[]
interface TaskVariant {
  tier: Tier;
  description: string;
  points: number; // nominal, pre-multiplier
}
interface Task {
  id: string;
  familyName: string; // e.g. "Push up routine"
  stat: Stat;
  isAnchor: boolean; // true = always in Daily Quest, never rotated
  variants: TaskVariant[]; // 1 to 3 entries
  createdAt: string; // ISO 8601
}

// key: "daily-tracker:completions" -> Completion[]
interface Completion {
  id: string;
  taskId: string;
  variantTier: Tier | null;
  completedAt: string; // ISO 8601, local time
  pointsAwarded: number; // actual points after rank multiplier, rounded up
}

// key: "daily-tracker:dailyQuestLog" -> DailyQuestDay[]
interface DailyQuestDay {
  date: string; // ISO date, local day boundary
  selectedTaskIdPerStat: Partial<Record<Stat, string>>; // today's rotating pick per stat
  requiredCompletions: Record<Stat, number>; // 1 normally, 2 if penalized
  actualCompletions: Record<Stat, number>;
  netPointsChange: number; // filled in at rollover
}

// key: "daily-tracker:rewards" -> Reward[]
interface Reward {
  id: string;
  title: string;
  cost: number; // Wallet points
  createdAt: string;
}

// key: "daily-tracker:rewardPurchases" -> RewardPurchase[]
interface RewardPurchase {
  id: string;
  rewardId: string;
  purchasedAt: string;
}

// key: "daily-tracker:userState" -> UserState
interface UserState {
  lifetimeXP: number; // drives Level/Rank; can decrease via deduction
  wallet: number; // spendable; decreases via deduction and purchases
  statXP: Record<Stat, number>; // per-stat lifetime totals; monotonic, never decreases
  currentStreak: number;
  freezeUsedThisWeek: boolean;
  lastFreezeWeekReset: string; // ISO date
  penaltyStats: Stat[]; // stats currently requiring 2x
  equippedTitle: string | null;
  unlockedTitles: string[];
  lastRolloverDate: string; // ISO date of the last day the engine evaluated
}
```

**Design note:** deductions reduce `lifetimeXP` and `wallet`, but never `statXP` — a stat's historical total only ever grows. This keeps the radar chart and the rank-up balance check honest as a record of what was actually done, while `lifetimeXP` (and therefore Level and Rank) can genuinely fall behind it after a bad stretch.

## 7. Tech Stack

| Layer              | Technology                                                                      |
| ------------------ | ------------------------------------------------------------------------------- |
| Frontend framework | Svelte (with Vite)                                                              |
| Language           | TypeScript                                                                      |
| Styling            | Tailwind CSS                                                                    |
| State management   | Svelte stores, persisted to `localStorage`                                      |
| Engine             | Plain TypeScript functions, no framework dependency, unit-testable in isolation |
| Persistence        | Browser `localStorage` (Web Storage API)                                        |
| Backend            | None for this phase — fully client-side                                         |
| Version control    | GitHub — milestone/issue/label/PR structured workflow                           |

## 8. Future Considerations

`localStorage` is a deliberate starting point. The data model above maps cleanly to a backend (e.g. Postgres via Supabase) if multi-device sync or account-based access becomes a real need later; `schemaVersion` gives any such migration a clear starting point. That migration is out of scope until it's actually needed.
