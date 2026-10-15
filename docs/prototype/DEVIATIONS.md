# Deviations from prototype

Allowed differences between `docs/prototype/*.html` and the app. Per the UI
Fidelity Contract, any difference not listed here is a bug.

| #   | Page    | Element / rule            | Prototype                                          | App                                                  | Reason                                                                                                                     | PRD reference | Approved by |
| --- | ------- | ------------------------- | -------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- |
| 1   | Today   | Streak chip and week pips | Streak 5, pips 5 on / 2 off                        | Streak derived from the engine over the 14 heat days | The prototype's heat strip and its streak chip are independent demo data that cannot both come from one state. See note 1. | §2.1 Streaks  |             |
| 2   | Rewards | "Total dibelanjakan"      | 1.180, the sum of the five rows the demo log shows | 2.370, the sum of all purchases                      | The prototype's `L` is a truncated demo list; the app logs every purchase as the PRD requires.                             | §2.1 Rewards  |             |

## Notes

1. **Today, streak versus heat strip.** `today.html` paints fourteen heat cells
   with levels `3 2 3 1 x 3 3 2 3 3 x 2 3 1` and separately shows Streak 5. Under
   the PRD a day counts toward the streak when it has at least one completion,
   so any non-`x` heat cell forces the streak to at least 12. No single
   `UserState` produces both. The `today` fixture seeds the engine-true state
   (twelve counting days), which moves the chip and two pips. Decide before
   Issue 2 whether the heat strip should instead be derived from something that
   does not extend the streak, or whether the streak chip is the thing that
   changes.
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

Two more found while building the harness:

| #   | Page    | Question                                                                                                            | Recommendation                                                                        |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Q6  | Today   | The heat strip and the streak chip cannot both match the prototype from one state (note 1).                         | Re-derive the heat strip from end-of-day satisfaction, accept the streak chip moving. |
| Q7  | Rewards | "Total dibelanjakan" sums the prototype's truncated five-row log; the app sums all fifteen purchases (deviation 2). | Keep the PRD-correct total. The log panel scrolls, so layout is unaffected.           |

## Harness note

The issue asks for the Playwright Docker image to be pinned. This repo is
checked out on Windows, so a Docker pin is not usable locally. Instead
`@playwright/test` is pinned to an exact version (1.64.1),
`npx playwright install chromium` resolves a single Chromium build
(156.0.8078.4, chromium-headless-shell v1248), and that build is recorded in
`tests/visual/README.md`. CI should use the same pinned Playwright on a fixed
Ubuntu image. Text rasterisation is not bit-identical across operating systems,
so a CI baseline must be generated on the image the job runs.
