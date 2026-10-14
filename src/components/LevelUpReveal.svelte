<script lang="ts">
  import { app } from '../stores/app';
  import { pendingLevelUpReveals } from '../lib/reveal';
  import PanelFrame from './PanelFrame.svelte';

  const pending = $derived(pendingLevelUpReveals($app.milestoneEvents));
  const current = $derived(pending[0] ?? null);

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

{#if current !== null}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="reveal-backdrop absolute inset-0" aria-hidden="true"></div>

    <div
      class="reveal-panel relative w-full max-w-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-label"
      aria-describedby="level-up-detail"
    >
      <PanelFrame class="p-6 text-center">
        <p id="level-up-label" class="text-xs font-semibold text-muted">Level up</p>
        <p
          class="glow-text reveal-level mt-3 font-mono text-5xl font-semibold leading-none text-accent"
        >
          {current.to}
        </p>
        <p id="level-up-detail" class="mt-4 text-sm text-text">
          Level {current.from} to {current.to}
        </p>
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

<style>
  .reveal-backdrop {
    background-color: color-mix(in srgb, var(--bg) 80%, transparent);
    animation: reveal-fade 200ms ease-out both;
  }

  .reveal-panel {
    animation: reveal-panel-in 400ms ease-out both;
  }

  .reveal-level {
    animation: reveal-glow-pulse 400ms ease-out;
  }

  @keyframes reveal-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes reveal-panel-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes reveal-glow-pulse {
    0%,
    100% {
      text-shadow: 0 0 var(--glow-px)
        color-mix(in srgb, var(--accent) var(--glow-alpha), transparent);
    }
    50% {
      text-shadow: 0 0 calc(var(--glow-px) * 1.8)
        color-mix(in srgb, var(--accent) 90%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal-panel {
      animation: reveal-fade 200ms ease-out both;
    }

    .reveal-level {
      animation: none;
    }
  }
</style>
