# Deviations from prototype

Allowed differences between `docs/prototype/*.html` and the app. Per the UI
Fidelity Contract, any difference not listed here is a bug.

| #   | Page | Element / rule | Prototype | App | Reason | PRD reference | Approved by |
| --- | ---- | -------------- | --------- | --- | ------ | ------------- | ----------- |

No deviations are currently approved. Deviations 1 and 2 were withdrawn on
2026-10-17; see "Withdrawn deviations" below.

## Withdrawn deviations

| #   | Page    | What it was                                                                              | Why it was withdrawn                                                                                            |
| --- | ------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Today   | Streak chip and week pips differed between the prototype (Streak 5) and the engine state | The prototype's heat strip was corrected so that it agrees with Streak 5 under the PRD rule. See note 1 and Q6. |
| 2   | Rewards | "Total dibelanjakan" was 1.180 in the prototype and 2.370 in the app                     | The prototype's purchase log now holds all fifteen purchases, so both sides show 2.370. See Q7.                 |

## Notes

1. **Today, streak versus heat strip (resolved 2026-10-17).** The original
   strip (`3 2 3 1 x 3 3 2 3 3 x 2 3 1`) could not agree with Streak 5. Under
   PRD §2.1 a day counts toward the streak when it has at least one completion,
   and the displayed streak is the closed days plus today when today already has
   a completion. Streak 5 therefore means four closed days plus today, preceded
   by a day with no completions. `today.html` now uses
   `3 2 3 1 x 3 3 2 x 3 2 2 3 1`: the two red cells are days with no completions
   (nine and five days ago), and the last five days contain no red cell. With the
   fixed test clock (Thursday 2026-10-15), both red days fall in the previous
   week: the first consumes that week's single Rank E freeze and the second finds
   none left, so the streak resets. The current week's freeze is unused, which
   matches "Freeze 1 tersisa". The `today` fixture must seed the same fourteen
   days.
2. **Prototype-local scales.** `today.html` uses `MAX = 30` for the radar,
   `settings.html` uses `MAXV = 20` for the gate bars, and `history.html` uses
   `350` for the Rank D threshold line. These are drawing scales, not rules; the
   app reads the rank table (`src/engine/rank.ts`) and `ceil(sum / (2 x count))`
   from the engine.
3. **Prototype-only affordances.** The "Demo: buka title berikutnya" button in
   `settings.html` is marked as prototype-only and must not ship. Issue 6 covers
   it.
4. **Streak pips (decided 2026-10-18).** The Today pips are not weekdays. Pips on
   = `min(displayStreak, 7)`, and the last lit pip is today (flagged when today
   has a completion). The label reads "Streak"; the old "Streak minggu ini"
   wording was dropped because with the fixed test clock (Thursday 2026-10-15) a
   weekday reading gives 4 pips, not 5. Issue 2 implements this in the Today
   component; no engine API is needed.

## Audit decisions (2026-10-19)

Source: audit of the five prototypes against `design.md` (read in full) and D20.
`design.md` is the old visual brief, so the prototypes win for anything visual;
these decisions cover behaviour and copy.

1. **UI language: English.** All interface copy follows `design.md` §7 and the
   original screens. User content (task and reward names, title names such as
   "Konsisten 7 hari") stays as the user wrote it. The earlier Indonesian copy in
   the prototypes was an unrequested translation and is withdrawn. Locale
   formatting: dates `en-GB`, numbers `en-US`.
2. **Mobile navigation (design.md §8).** Up to 1023px the top bar is two rows:
   wordmark and chips, then the five nav items equally wide, at least 44px tall.
   The nav is never hidden. At 380px and below the Rank chip is hidden on every
   page.
3. **Deleting a task or reward (design.md §7; resolves Q4).** Inline confirmation
   row "Delete {name}?" with Delete and Cancel. No undo toast. Escape cancels.
   Purchase history keeps its snapshots when a reward is deleted.
4. **Purchases (resolves Q1).** No undo after a purchase.
5. **Empty states.** "No tasks yet" and "No rewards yet" with the §7 copy and an
   add button.
6. **Validation and import copy** follows §7 ("Describe what to do.", "Enter
   points.", "Max {cap} points at Rank {rank}.", "Over cap: counts as {cap}", the
   three import failure reasons).
7. **Redesign additions beyond design.md** (approved by the redesign request, not
   deviations): summary cards, calendar, events and purchase-history panels,
   wallet panel, toolbar filters, stat group panels, rotating emblem, particles
   and scan sweep, animated brackets.
8. **Coin placement.** The coin icon follows the number in the Rewards section
   (requested after design.md); design.md §3 places it before.

## Audit items (batch 2, 2026-10-20)

The prototypes now define the items that were deferred on 2026-10-19. They are
the source of truth for the app work in the follow-up issue. Ticked items are
defined in the prototypes; "app" means the values and rules come from the engine
or store, never from the prototype's demo logic.

- [x] Today: inline tier picker on rotating rows with variants (a range such as
      +3 to +8); freeze line variants (2 freezes / 1 freeze / No freezes left this
      week); the "Rank-up blocked: raise {stat} to {n} xp (now {m})" line; title chip
      omitted when no title is equipped; empty state when no tasks exist. App work
      pending.
- [x] History: range buttons 7 days / 30 days / All with Show more; the "Freeze
      used" label; a pending circle for the open day. App work pending.
- [x] Rank accent via `data-rank` on `<html>` (brackets, rank chip, rank letter,
      level number, XP bar, radar). App work pending.
- [x] Overlays and notices: level up, rank up, rank down notice, storage failure
      banner, recovery notice. They live in `today.html` as shared shell markup, not
      in a sixth prototype file, because all five pages can show overlays and
      notices. The overlay markup is emoji-free; the level-up and rank-up overlays
      share the `ov-fade`, `ov-in` and `ov-pulse` keyframes.
- [x] Responsive details of design.md §8: 16px inputs and 44px controls on small
      screens, 16px brackets below 640px, radar minimum 240px. App work pending.

## Prototype states

The prototypes expose deterministic states through a `state` query parameter so
the visual harness can render one state without copying demo logic:

- `today.html?state=`: `tiers`, `freeze2`, `freeze0`, `blocked`, `notitle`,
  `empty`, `levelup`, `rankup`, `rankdown`, `storage`, `recovery`.
- `history.html?state=`: `long` (150 days), `open` (the last day is the open day,
  3/5).

These states are fixtures, not rules. The app must reproduce them by seeding its
own state and flags (engine state, store flags, milestone events), never by
hardcoding the prototype's `STATE`, demo `award()`, `lvOf()`, `gate()` or
`scaleMax()` functions. Dumping `state` variants through the fixture scripts is
the only supported way to obtain their values.

## Mechanical renames

Added 2026-10-18 (Issue 2, Today page). `@keyframes` names are global CSS, and the
five prototypes are five standalone documents that reuse the same names for
different animations. The app has one global stylesheet, so a page's own
keyframes carry a page prefix. The bodies of the animations and every other
declaration are the prototype's, unchanged, and `npm run check:ui-css` compares
them by the prototype's name.

| Old name   | New name         | Page  |
| ---------- | ---------------- | ----- |
| `spin`     | `today-spin`     | Today |
| `shine`    | `today-shine`    | Today |
| `blink`    | `today-blink`    | Today |
| `pen`      | `today-pen`      | Today |
| `pulse`    | `today-pulse`    | Today |
| `fl`       | `today-fl`       | Today |
| `rg`       | `today-rg`       | Today |
| `tiers-in` | `today-tiers-in` | Today |
| `flash`    | `tasks-flash`    | Tasks |
| `out`      | `tasks-out`      | Tasks |
| `flash`    | `rewards-flash`  | Rewards |
| `out`      | `rewards-out`    | Rewards |
| `pop`      | `rewards-pop`    | Rewards |
| `cn`       | `rewards-cn`     | Rewards |
| `fl`       | `rewards-fl`     | Rewards |
| `shake`    | `rewards-shake`  | Rewards |
| `draw`     | `history-draw`   | History |
| `fade`     | `history-fade`   | History |
| `mk`       | `history-mk`     | History |

The shared keyframes `brk-in`, `brk-breathe`, `boot` and `scan` are identical in
all five prototypes and are NOT renamed; they live in the shared shell CSS. The
overlay keyframes `ov-fade`, `ov-in` and `ov-pulse` are also shared by the shell
and keep their prototype names.

This is also the only textual difference from the prototype anywhere else on the
page. Today-specific rules are wrapped in `@scope (body[data-page="today"])` and
`document.body.dataset.page` carries the current route; `@scope` changes where a
rule applies and not what it says.

## Test scaffolding

Added 2026-10-31 (Issue 4, Rewards page).

- **Average income.** `rewards.html` hardcodes `AVG = 13`. The app derives the
  number from the engine's daily records (`src/lib/rewards-page.ts`,
  `averageDailyIncome`): the mean `netPointsChange` over the last fourteen
  calendar days ending today, rounded. The `rewards` fixture seeds thirteen
  closed days at +13 each and today's open day at +9, which averages to exactly
  13, so the page shows the prototype's `+13 / day` and countdowns without
  copying the constant. This is fixture scaffolding for the visual diff, not a
  game rule; the PRD defines no average-income formula.

## Test scaffolding

Added 2026-10-31 (Issue 5, History page).

- **Closed versus open last day.** `history.html`'s default state ends on a
  closed day; only `?state=open` marks the last rendered day open. The
  `history` fixture therefore replays the 30-day snapshot with its last day
  closed, and the `open` state replays `history-open-snapshot.json` with the last
  day open and 3/5 stats. This is fixture state, not a rule: the real store's
  current day is open according to PRD �7.
- **Title events.** The prototype appends `New title: ...` rows to its history
  log. The engine records level-up and rank changes but has no title-unlock
  event, so the fixture seeds the two title rows from
  `history-snapshot.json` as stored `titleUnlock` milestone events
  (`src/lib/types.ts`, `src/lib/storage-validate.ts`). The History page reads
  them from `milestoneEvents` like every other event; no title rule is copied
  from the prototype. Q16 asks whether the engine should emit this event in
  production.

## Open questions

From the "Likely entries" list in `docs/UI-REVAMP.md`. Q2 and Q5 are resolved; the rest are not decided;
each needs an answer before the page named ships.

| #   | Page     | Question                                                                                                                                                                                                                                                                                | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Rewards  | The prototype offers an undo toast after a purchase that refunds it. The PRD defines no refund.                                                                                                                                                                                         | Resolved 2026-10-19: no undo after a purchase; delete asks an inline confirmation (Audit decisions 3 and 4).                                                                                                                                                                                                                                                                                                                                                                                                               |
| Q2  | Settings | The animation and sound switches are not in the PRD.                                                                                                                                                                                                                                    | Resolved 2026-10-18: keep both as local preferences. They read `daily-tracker:motion`, are not part of Export, and every prototype page now honours `data-motion="off"`.                                                                                                                                                                                                                                                                                                                                                   |
| Q3  | Settings | The "Demo: buka title berikutnya" button is prototype-only.                                                                                                                                                                                                                             | Do not ship it. Already recorded as note 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Q4  | Tasks    | The prototype deletes immediately with an undo toast; the PRD says delete. An archive option is unspecified.                                                                                                                                                                            | Resolved 2026-10-19: inline confirmation row, no undo toast, no archiving (Audit decision 3).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Q5  | Settings | Only `settings.html` defines light-theme tokens. Whether the other four pages must support light in this milestone is undecided.                                                                                                                                                        | Resolved 2026-10-18: support light globally. All five prototypes now carry the identical `:root` and `[data-theme=light]` token blocks, no hardcoded dark colours remain outside them, and each page applies the stored theme before first paint.                                                                                                                                                                                                                                                                          |
| Q6  | Today    | The heat strip and the streak chip could not both match the prototype from one state.                                                                                                                                                                                                   | Resolved by correcting the prototype. See the resolved table below.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Q7  | Rewards  | "Total dibelanjakan" summed a truncated five-row log; the app sums all fifteen purchases.                                                                                                                                                                                               | Resolved by correcting the prototype. `rewards.html` now logs all fifteen purchases.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Q8  | Today    | The prototype's rewards teaser lists **every** reward; `selectRewardPreview` (design §5, decisions D20) lists at most **two**.                                                                                                                                                          | Open. Under the `today` fixture the prototype shows three rows (Main game 2 jam, Kopi susu santai, Nonton bioskop) and `selectRewardPreview` would show two (the dearest affordable and the dearest locked). Issue 2 followed the prototype, because the Fidelity Contract makes it the source of truth for anything visual and the teaser is visual. Decide whether D20 or the prototype wins before the Rewards page ships; if D20 wins, the teaser needs a third row removed and this page's fidelity diff will change. |
| Q9  | Today    | The completion toast offers "Batalkan" (undo). The engine cannot revert a completion: `engine/complete-task.ts` only adds one, and the PRD defines no reversal, no XP clawback and no stat reversal.                                                                                    | Open. Issue 2 renders the toast and its button exactly as the prototype does and leaves the button inert, which is the smallest possible difference; adding a reversal would be new game behaviour and is not an agent's call. Decide whether the PRD needs an undo-completion rule. If it does not, the button should be dropped from both sides; if it does, the engine needs `uncompleteTask` before the button can work.                                                                                               |
| Q10 | Today    | The prototype's `freeze2` state shows two freezes available while the header is Rank E. The engine gives Rank E one freeze per week, so a faithful fixture at Rank E cannot produce "2 freezes left this week"; the engine can only show two at a rank whose config allows two.         | Open. The prototype state is demo data. Decide whether the app's `freeze2` fixture should use a higher rank (changing the accent and rank chip from the prototype) or whether the prototype should show the two-freeze state at that higher rank. Until then the app can verify the two-freeze copy from the engine at a rank that allows it, but cannot reproduce the prototype's Rank E pixels for this state.                                                                                                           |
| Q11 | Today    | The prototype's rank-down notice is created from a `state` query and dismissed locally; it has no persistent source. The engine emits a `rankDown` milestone event, but the prototype does not specify whether dismissal marks the event seen or only hides the notice for the session. | Open. Recommended: treat the notice like the level-up and rank-up overlays - show unseen rank-down events oldest first on Today, and mark the event seen on Dismiss. The alternative is a session-only hide, which would show the notice again after a reload.                                                                                                                                                                                                                                                             |
| Q12 | All      | The storage-failure and recovery banners contain an "Export data" button, and the recovery banner has "Dismiss". Export/import is not implemented until the Settings issue, so the prototype gives the button no handler.                                                               | Open. Recommended: render the buttons with the prototype copy and keep "Export data" inert until the Settings export ships (the same smallest-difference approach as Q9). Decide whether an inert button is acceptable or the button should be hidden until export exists.                                                                                                                                                                                                                                                 |
| Q13 | Tasks    | `tasks.html` still carries one Indonesian sentence in the drawer ("Satu varian saja = task single-tier, tanpa nama tier."), while Audit decision 1 says all interface copy is English and the earlier Indonesian copy is withdrawn. The prototype was not updated with the audit batch. | Open. Issue 3 keeps the sentence verbatim because the Fidelity Contract makes the prototype the source of truth for copy and the pixel diff would otherwise fail on the drawer. Decide whether the prototype should be corrected to English (recommended wording: "One variant only = a single-tier task, with no tier name.") or the audit decision relaxed for this line. |
| Q14 | Tasks    | The over-cap badge in `tasks.html` renders the literal text "Over cap: counts as ${CAP}". The template uses a single-quoted string inside the render template, so `${CAP}` is never interpolated; the banner and the drawer error in the same file do interpolate correctly. | Open. Issue 3 matches the prototype verbatim (literal `${CAP}`) because the computed-style diff measures the badge width and the pixel diff would fail otherwise. Decide whether to correct the prototype to "Over cap: counts as 15" and regenerate the tasks fidelity expectations afterwards. |
| Q15 | Tasks    | Audit decision 3 / Q4 say the delete flow has no undo toast, but `tasks.html` still renders `<button id="undo" hidden>Undo</button>` inside the toast and CSS `.toast button { all: unset; }` overrides the `hidden` attribute, so the button is visible (and inert) after a deletion. | Open. Issue 3 matches the prototype (the button is visible and inert) because the computed-style and pixel diffs would otherwise fail. Decide whether the prototype should drop the button or add a rule that honours `[hidden]`, then regenerate the tasks interaction artefacts. |
| Q16 | History  | `history.html` shows title-unlock rows as milestone events, but the engine's `MilestoneEvent` union only emitted level-up and rank changes before Issue 5. | Open. Issue 5 added a `titleUnlock` variant to the stored event type and seeded it in the fixture so the page can render the prototype's rows; the engine still does not emit it at runtime. Decide whether title unlocks should become engine events (and then appear on Today's overlays too) or whether History should derive milestones only from existing events. |

Q8 and Q9 were found while building the Today page (Issue 2, 2026-10-18). Q10-Q12
were found while auditing batch 2 (2026-10-20); Q10-Q12 remain open.
Q13-Q15 were found while building the Tasks page (Issue 3, 2026-10-23) and
remain open. Q16 was found while building the History page (Issue 5, 2026-10-31)
and remains open.

Two more were found while building the harness. Both are resolved:

| #   | Page    | Question                                                                                  | Resolution (2026-10-17)                                                                                                                                                                                                            |
| --- | ------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q6  | Today   | The heat strip and the streak chip could not both match the prototype from one state.     | Resolved by correcting the prototype, not by accepting a deviation (this replaces the earlier recommendation). `today.html` now agrees with Streak 5; see note 1. The app seeds the same strip and the chip stays 5.               |
| Q7  | Rewards | "Total dibelanjakan" summed a truncated five-row log; the app sums all fifteen purchases. | Resolved by correcting the prototype. `rewards.html` now logs all fifteen purchases (Main game 2 jam x4, Kopi susu santai x8, Jajan favorit x1, Nonton bioskop x2), so the total is 2.370 and agrees with the counts on the cards. |

Remaining caveat for Q7 (demo data only, not a UI deviation): 2.370 coins spent
is far above the lifetime XP shown on Today (65). It comes from the purchase
counts in the original screenshots.

## Prototype revision log

| Date       | Files                        | Change                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-17 | all five                     | Mobile header unified (viewport <= 700px): compact logo (16px) and chips (padding 3x8, 12px text), no horizontal overflow. At <= 380px the Rank chip is hidden on every page. The Today-only rule that hid the Rank chip at <= 700px was removed.                                                                                                                  |
| 2026-10-17 | `today.html`, `rewards.html` | Q6 and Q7 data corrections (see note 1, Q6, Q7).                                                                                                                                                                                                                                                                                                                   |
| 2026-10-18 | all five                     | Light theme made global (Q5): identical token blocks on every page, hardcoded dark colours replaced by tokens, SVG colours via `var(--...)`, theme and motion init script. `daily-tracker:motion` honoured on every page (Q2). `today.html`: last heat-strip cell tooltip now reads "Hari ini".                                                                    |
| 2026-10-18 | all five                     | Shared rules normalised across prototypes (body transition, one `.coin`, one `.panel` rule with default padding 22 and component overrides, one bracket selector list, combined nav hover rule, `.scan` via `--scan`); `color-scheme` added to the token blocks; Today pips label renamed "Streak" and pips defined (note 4).                                      |
| 2026-10-19 | all five                     | Audit batch 1: English copy, two-row mobile navigation up to 1023px, inline delete confirmation (tasks, rewards), no purchase undo, empty states, validation and import copy, radar aria-label with the five values.                                                                                                                                               |
| 2026-10-20 | all five                     | Audit batch 2: rank accent via `data-rank` (token block, bracket/accent rules, Rank chip); level-up/rank-up overlays and rank-down, storage, recovery notices; Today tier picker, freeze variants, rank-up-blocked line, title omission and empty state; History ranges/labels; responsive 640px brackets and 44px controls; `state` query states for the harness. |

Fixtures derived from these values (the `today` heat strip and the `rewards`
purchase log) were regenerated from the corrected prototypes in PR #158
(`npm run test:visual:fixtures`); `npm run check:fixtures` now fails if a
snapshot no longer matches a fresh dump.

## Harness note

The issue asks for the Playwright Docker image to be pinned. This repo is
checked out on Windows, so a Docker pin is not usable locally. Instead
`@playwright/test` is pinned to an exact version (1.64.1),
`npx playwright install chromium` resolves a single Chromium build
(156.0.8078.4, chromium-headless-shell v1248), and that build is recorded in
`tests/visual/README.md`. CI should use the same pinned Playwright on a fixed
Ubuntu image. There are no stored baselines. The prototype and the app are
rendered in the same run on the same machine and compared against each other, so
cross-OS rasterisation differences cancel out.

What makes the reported ratios trustworthy:

- `tests/visual/selftest.spec.ts` renders each prototype twice, in two separate
  browser contexts, and requires the two renders to be identical - once over the
  whole page and once over the `header` region. A reported ratio that two
  identical loads of the reference disagree on would be unfalsifiable.
- `tests/visual/shell.spec.ts` diffs the `header` element alone, so the shell can
  be shown to match before the rest of a page is rebuilt.
- Full-page captures scroll and stitch instead of using `fullPage: true`: the
  prototypes paint `position: fixed` background layers and `backdrop-filter`
  panels, and beyond-viewport capture rasters those differently between two
  loads of the same page.
- `#demo`, the prototype-only "Demo: buka title berikutnya" button in
  `settings.html`, is hidden on both sides (note 3). It is a prototype affordance,
  not UI, so it must never be diffed.
