<script lang="ts">
  import { tick } from 'svelte';
  import { getRankConfig } from '../engine/rank';
  import { app } from '../stores/app';

  /**
   * Level-up and rank-up overlays (UI Revamp Issue 2).
   *
   * `today.html`'s `open()` inserts one overlay at the end of `<body>` and focuses
   * Continue; Escape closes it and focus returns to where it was. The app may
   * have both kinds of event pending, so they share one queue: the oldest unseen
   * level-up or rank-up event is shown first, and marking it seen reveals the
   * next. A rank-down event is a notice on Today, not an overlay.
   */

  const current = $derived(
    $app.milestoneEvents.find(
      (event) => !event.seen && (event.type === 'levelUp' || event.type === 'rankUp')
    ) ?? null
  );
  const level = $derived(current?.type === 'levelUp' ? current : null);
  const rank = $derived(current?.type === 'rankUp' ? current : null);
  const config = $derived(rank === null ? null : getRankConfig(rank.to));

  let continueButton = $state<HTMLButtonElement | null>(null);
  let observedId: string | null = null;
  let returnFocus: HTMLElement | null = null;

  $effect(() => {
    const id = current?.id ?? null;

    if (id === observedId) return;

    if (observedId === null && id !== null) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    if (id !== null) {
      void tick().then(() => continueButton?.focus());
    } else {
      returnFocus?.focus();
      returnFocus = null;
    }

    observedId = id;
  });

  function dismiss(): void {
    if (current !== null) {
      app.markMilestoneSeen(current.id);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      dismiss();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if current !== null}
  <div class="ov" role="dialog" aria-modal="true" aria-labelledby="ovl">
    <div class="panel ovp">
      {#if level !== null}
        <small id="ovl">Level up</small>
        <div class="big">{level.to}</div>
        <p>Level {level.from} to {level.to}</p>
      {:else if rank !== null && config !== null}
        <small id="ovl">Rank up</small>
        <div class="big">{rank.to}</div>
        <p>Rank {rank.to}</p>
        <dl>
          <dt>Freezes per week</dt>
          <dd>{config.freezesPerWeek}</dd>
          <dt>Max points per task</dt>
          <dd>{config.maxPointsPerTask === null ? 'unlimited' : config.maxPointsPerTask}</dd>
          <dt>Multiplier</dt>
          <dd>×{config.xpMultiplier.toFixed(2).replace(/0$/, '')}</dd>
          <dt>Penalty per missed stat</dt>
          <dd>−{config.penalty}</dd>
        </dl>
      {/if}
      <button class="obtn" id="ovc" bind:this={continueButton} onclick={dismiss}>Continue</button>
    </div>
  </div>
{/if}
