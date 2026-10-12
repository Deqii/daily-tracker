<script lang="ts">
  import PanelFrame from '../components/PanelFrame.svelte';
  import XpTrendChart from '../components/XpTrendChart.svelte';
  import { buildXpTrend, type TrendRange } from '../lib/xp-trend';
  import { app } from '../stores/app';

  const RANGES: readonly { readonly value: TrendRange; readonly label: string }[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'all', label: 'All' },
  ];

  let range = $state<TrendRange>('7d');

  const totalXp = $derived($app.userState.lifetimeXP);
  const points = $derived(
    buildXpTrend(
      $app.dailyQuestLog,
      $app.milestoneEvents,
      $app.userState.lifetimeXP,
      $app.userState.lastRolloverDate,
      range
    )
  );
</script>

<section class="p-4">
  <h2 class="text-xl font-semibold">History</h2>

  <div class="mt-4">
    <PanelFrame class="p-4">
      <div class="flex items-center justify-between gap-4">
        <span class="text-sm text-muted">XP trend</span>
        <span class="font-mono text-sm text-muted">{totalXp} xp</span>
      </div>

      <div class="mt-2 flex items-center gap-3">
        {#each RANGES as option (option.value)}
          <button
            type="button"
            aria-pressed={range === option.value}
            class="inline-flex min-h-11 items-center text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-0 {range ===
            option.value
              ? 'font-semibold text-action-ink'
              : 'text-muted'}"
            onclick={() => (range = option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>

      <XpTrendChart {points} />
    </PanelFrame>
  </div>
</section>
