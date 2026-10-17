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

## Open questions

From the "Likely entries" list in `docs/UI-REVAMP.md`. None of these are decided;
each needs an answer before the page named ships.

| #   | Page     | Question                                                                                                                         | Recommendation                                                                                                                            |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Rewards  | The prototype offers an undo toast after a purchase that refunds it. The PRD defines no refund.                                  | Drop the purchase undo. Delete-with-undo is not a refund and stays.                                                                       |
| Q2  | Settings | The animation and sound switches are not in the PRD.                                                                             | Keep both as local preferences. They read `daily-tracker:motion` and are not part of Export.                                              |
| Q3  | Settings | The "Demo: buka title berikutnya" button is prototype-only.                                                                      | Do not ship it. Already recorded as note 3.                                                                                               |
| Q4  | Tasks    | The prototype deletes immediately with an undo toast; the PRD says delete. An archive option is unspecified.                     | Keep delete + undo. Do not add archiving; it would change the data model.                                                                 |
| Q5  | Settings | Only `settings.html` defines light-theme tokens. Whether the other four pages must support light in this milestone is undecided. | Support it globally. The tokens live in `:root` / `[data-theme=light]`, so every page follows for free; only the settings demo proves it. |

Two more were found while building the harness. Both are resolved:

| #   | Page    | Question                                                                                  | Resolution (2026-10-17)                                                                                                                                                                                                            |
| --- | ------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q6  | Today   | The heat strip and the streak chip could not both match the prototype from one state.     | Resolved by correcting the prototype, not by accepting a deviation (this replaces the earlier recommendation). `today.html` now agrees with Streak 5; see note 1. The app seeds the same strip and the chip stays 5.               |
| Q7  | Rewards | "Total dibelanjakan" summed a truncated five-row log; the app sums all fifteen purchases. | Resolved by correcting the prototype. `rewards.html` now logs all fifteen purchases (Main game 2 jam x4, Kopi susu santai x8, Jajan favorit x1, Nonton bioskop x2), so the total is 2.370 and agrees with the counts on the cards. |

Remaining caveat for Q7 (demo data only, not a UI deviation): 2.370 coins spent
is far above the lifetime XP shown on Today (65). It comes from the purchase
counts in the original screenshots.

## Prototype revision log

| Date       | Files                        | Change                                                                                                                                                                                                                                            |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-17 | all five                     | Mobile header unified (viewport <= 700px): compact logo (16px) and chips (padding 3x8, 12px text), no horizontal overflow. At <= 380px the Rank chip is hidden on every page. The Today-only rule that hid the Rank chip at <= 700px was removed. |
| 2026-10-17 | `today.html`, `rewards.html` | Q6 and Q7 data corrections (see note 1, Q6, Q7).                                                                                                                                                                                                  |

Fixtures derived from these values (the `today` heat strip and the `rewards`
purchase log) must be regenerated before Issue 2 and Issue 4 are diffed.

## Harness note

The issue asks for the Playwright Docker image to be pinned. This repo is
checked out on Windows, so a Docker pin is not usable locally. Instead
`@playwright/test` is pinned to an exact version (1.64.1),
`npx playwright install chromium` resolves a single Chromium build
(156.0.8078.4, chromium-headless-shell v1248), and that build is recorded in
`tests/visual/README.md`. CI should use the same pinned Playwright on a fixed
Ubuntu image. Text rasterisation is not bit-identical across operating systems,
so a CI baseline must be generated on the image the job runs.
