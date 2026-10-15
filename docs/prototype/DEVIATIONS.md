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
