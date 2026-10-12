<script lang="ts">
  import {
    isDayRow,
    logDayCount,
    netPointsLabel,
    visibleLogRows,
    type LogRow,
    type StatStatus,
  } from '../lib/daily-log';
  import { statLabel } from '../lib/today-lines';
  import { STATS } from '../lib/types';
  import type { MilestoneEvent } from '../lib/types';
  import type { TrendRange } from '../lib/xp-trend';

  const PAGE_SIZE = 60;
  const HEADERS = ['Date', ...STATS.map(statLabel), 'Net points'];

  interface Props {
    rows: readonly LogRow[];
    range: TrendRange;
  }

  let { rows, range }: Props = $props();
  let shownDays = $state(PAGE_SIZE);

  const limit = $derived(range === 'all' ? shownDays : Number.POSITIVE_INFINITY);
  const visible = $derived(visibleLogRows(rows, limit));
  const hasMore = $derived(range === 'all' && logDayCount(rows) > shownDays);

  function statusLabel(stat: StatStatus, statIndex: number): string {
    return `${statLabel(STATS[statIndex] ?? 'STR')} ${stat}`;
  }

  function netClass(net: number): string {
    if (net > 0) {
      return 'text-action-ink';
    }

    if (net < 0) {
      return 'text-danger';
    }

    return 'text-muted';
  }

  function milestoneClass(type: MilestoneEvent['type']): string {
    return type === 'rankDown' ? 'text-danger' : 'text-accent glow-text';
  }
</script>

<div class="mt-6 overflow-x-auto">
  <table class="w-full min-w-[480px]">
    <thead>
      <tr class="border-b border-surface text-left">
        {#each HEADERS as header, index (index)}
          <th scope="col" class="pb-1 pr-3 font-normal text-muted">{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each visible as row, index (index)}
        {#if isDayRow(row)}
          <tr class="border-b border-surface align-top">
            <td class="py-1 pr-3 font-mono text-sm text-muted">
              <span>{row.dateLabel}</span>
              {#if row.freezeUsed}
                <span class="ml-2 font-sans">Freeze used</span>
              {/if}
            </td>
            {#each row.statuses as status, statIndex (statIndex)}
              <td class="py-1 pr-3">
                <span class="sr-only">{statusLabel(status, statIndex)}</span>
                {#if status === 'completed'}
                  <svg
                    class="text-action-ink"
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
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                {:else if status === 'missed'}
                  <svg
                    class="text-danger"
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M4 8h8" />
                  </svg>
                {:else}
                  <svg
                    class="text-icon-muted"
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="8" cy="8" r="6" />
                  </svg>
                {/if}
              </td>
            {/each}
            <td class="py-1 font-mono text-sm {netClass(row.netPoints)}">
              {netPointsLabel(row.netPoints)}
            </td>
          </tr>
        {:else}
          <tr class="border-b border-surface">
            <td colspan="7" class="py-1 text-sm {milestoneClass(row.type)}">{row.text}</td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>

  {#if hasMore}
    <button
      type="button"
      class="mt-1 inline-flex min-h-11 items-center text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-0"
      onclick={() => (shownDays += PAGE_SIZE)}
    >
      <span class="text-muted">Show more</span>
    </button>
  {/if}
</div>
