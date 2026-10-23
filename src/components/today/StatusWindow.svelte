<script lang="ts">
  import { freezesRemainingText, hasCompletionToday } from '../../lib/today-page';
  import { rankUpBlockedLine } from '../../lib/today-lines';
  import { app } from '../../stores/app';

  /**
   * The status window (UI Revamp Issue 2).
   *
   * Emits `today.html`'s first `<main>` section verbatim: same tags, order,
   * classes, ARIA and copy. Every value is read from the store, which reads the
   * engine; nothing here recomputes a rule.
   */

  const rank = app.rank;
  const level = app.level;
  const progress = app.levelProgress;
  const equippedTitle = app.equippedTitle;
  const streak = app.streak;
  const freezesLeft = app.freezesLeft;
  const rankGate = app.rankGate;

  /** The pips are seven wide and light up from the left; today carries the flag (DEVIATIONS note 4). */
  const PIP_COUNT = 7;

  let lit = $derived(Math.min($streak, PIP_COUNT));

  /**
   * `displayStreak` counts today once it holds a completion, and the last lit
   * pip is today only then. A streak that ends yesterday lights no pip as today.
   */
  let todayIsLit = $derived(
    hasCompletionToday(
      $app.dailyQuestLog.find((day) => day.date === $app.userState.lastRolloverDate)
    )
  );

  let blockedText = $derived(
    $rankGate.blocked && $rankGate.weakest !== null && $rankGate.current !== null
      ? rankUpBlockedLine($rankGate.weakest, $rankGate.threshold, $rankGate.current)
          .map((segment) => segment.text)
          .join('')
      : null
  );

  function pipClass(index: number): string {
    if (index >= lit) return '';
    if (todayIsLit && index === lit - 1) return 'on today';

    return 'on';
  }
</script>

<section class="panel status boot" style="--i:0" aria-label="Status">
  <div class="emblem">
    <svg viewBox="0 0 150 150" aria-hidden="true"
      ><polygon
        points="75,4 140,40 140,110 75,146 10,110 10,40"
        fill="none"
        stroke="var(--accent)"
        stroke-opacity=".6"
        stroke-width="1.5"
      /><polygon
        points="75,16 128,46 128,104 75,134 22,104 22,46"
        fill="none"
        stroke="var(--accent)"
        stroke-opacity=".25"
        stroke-dasharray="4 6"
      /></svg
    >
    <div class="rank">{$rank}</div>
  </div>
  <div class="lv"><span class="sub">Level</span><b>{$level}</b></div>
  {#if $equippedTitle !== null}
    <div class="title">{$equippedTitle}</div>
  {/if}
  <div>
    <div class="row sub" style="margin-bottom:6px">
      <span>{$progress.xpIntoLevel} / {$progress.xpForThisLevel} XP</span><span
        >to Level {$progress.level + 1}</span
      >
    </div>
    <div class="xpbar"><i style="width: {$progress.ratio * 100}%"></i></div>
  </div>
  <div>
    <div class="row sub" style="margin-bottom:6px">
      <span>Streak</span><span class="shield"
        ><svg
          width="14"
          height="16"
          viewBox="0 0 14 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          ><path d="M7 1l5.5 2v5c0 3.5-2.4 6-5.5 7C3.9 14 1.5 11.500 1.500 8V3z" /></svg
        ><span id="frz">{freezesRemainingText($freezesLeft)}</span></span
      >
    </div>
    <div class="pips" aria-label={`Streak ${$streak} days`}>
      {#each Array.from({ length: PIP_COUNT }, (_, index) => index) as index (index)}
        <i class={pipClass(index)}></i>
      {/each}
    </div>
  </div>
  {#if blockedText !== null}
    <div class="blocked">{blockedText}</div>
  {/if}
</section>
