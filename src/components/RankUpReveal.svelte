<script lang="ts">
  import { app } from '../stores/app';
  import { pendingRankUpReveals } from '../lib/reveal';
  import PanelFrame from './PanelFrame.svelte';
  import { getRankConfig } from '../engine/rank';

  const pending = $derived(pendingRankUpReveals($app.milestoneEvents));
  const current = $derived(pending[0] ?? null);
  const config = $derived(current ? getRankConfig(current.to) : null);

  let continueButton = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (current !== null) {
      continueButton?.focus();
    }
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

{#if current !== null && config !== null}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="reveal-backdrop absolute inset-0" aria-hidden="true"></div>

    <div
      class="reveal-panel relative w-full max-w-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-up-label"
      aria-describedby="rank-up-detail"
    >
      <PanelFrame class="p-6 text-center">
        <p id="rank-up-label" class="text-xs font-semibold text-muted">Rank up</p>
        <p
          class="glow-text reveal-glow mt-3 font-mono text-5xl font-semibold leading-none text-accent"
        >
          {current.to}
        </p>
        <p id="rank-up-detail" class="mt-4 text-sm text-text">Rank {current.from}</p>
        <div class="mt-6 space-y-2 text-xs text-text">
          <div class="flex items-center justify-between">
            <span class="text-muted">Freezes per week</span>
            <span class="font-mono">{config.freezesPerWeek}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted">Max points per task</span>
            <span class="font-mono"
              >{config.maxPointsPerTask === null ? 'unlimited' : config.maxPointsPerTask}</span
            >
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted">Multiplier</span>
            <span class="font-mono">×{config.xpMultiplier.toFixed(2).replace(/\.00$/, '.0')}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted">Penalty per missed stat</span>
            <span class="font-mono">{config.penalty}</span>
          </div>
        </div>
        <button
          bind:this={continueButton}
          type="button"
          onclick={dismiss}
          class="mt-6 inline-flex min-h-11 items-center rounded-sm bg-action px-4 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
        >
          Continue
        </button>
      </PanelFrame>
    </div>
  </div>
{/if}
