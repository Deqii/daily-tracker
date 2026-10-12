<script lang="ts">
  import CoinIcon from '../components/CoinIcon.svelte';
  import { buildRewardList, purchaseCountLabel, rewardCountLabel } from '../lib/rewards-list';
  import { app } from '../stores/app';

  const rows = $derived(buildRewardList($app.rewards, $app.rewardPurchases, $app.userState.wallet));
  const count = $derived($app.rewards.length);
</script>

<section class="p-4">
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-baseline gap-2">
      <h2 class="text-xl font-semibold">Rewards</h2>
      <span class="text-xs text-muted">{rewardCountLabel(count)}</span>
    </div>
    <button
      type="button"
      class="inline-flex min-h-11 shrink-0 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
    >
      Add reward
    </button>
  </div>

  {#if rows.length === 0}
    <div class="mt-6">
      <p class="text-sm font-semibold">No rewards yet.</p>
      <p class="mt-1 text-sm text-muted">Add a reward to spend your wallet on.</p>
      <button
        type="button"
        class="mt-3 inline-flex min-h-11 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
      >
        Add reward
      </button>
    </div>
  {:else}
    <ul class="mt-4 border-t border-surface">
      {#each rows as row (row.reward.id)}
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
          <span class="text-xs text-muted">{purchaseCountLabel(row.purchaseCount)}</span>
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
            >
              Buy
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
