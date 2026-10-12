<script lang="ts">
  import { app } from '../stores/app';
  import CoinIcon from './CoinIcon.svelte';

  const rewardPreview = app.rewardPreview;

  function buy(rewardId: string): void {
    app.purchaseReward(rewardId);
  }
</script>

{#if $rewardPreview.length > 0}
  <section class="mt-4">
    <h2 class="text-xs font-semibold text-muted">Rewards</h2>
    <ul class="mt-1 border-t border-surface">
      {#each $rewardPreview as row (row.reward.id)}
        <li class="flex items-center gap-2 border-b border-surface py-2">
          {#if row.locked}
            <svg
              class="shrink-0 text-icon-muted"
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="3.5" y="7" width="9" height="6" rx="1" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
            </svg>
          {/if}
          <span class="text-sm text-text">{row.reward.title}</span>
          <span
            class="ml-auto inline-flex items-center gap-1 font-mono text-sm {row.locked
              ? 'text-muted'
              : 'text-action-ink'}"
          >
            <CoinIcon />
            {row.locked ? `${$app.userState.wallet} / ${row.reward.cost}` : row.reward.cost}
          </span>
          {#if !row.locked}
            <button
              type="button"
              class="inline-flex min-h-11 shrink-0 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
              onclick={() => buy(row.reward.id)}
            >
              Buy
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}
