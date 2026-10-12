<script lang="ts">
  import { rankReferenceRows } from '../lib/rank-reference';

  const rows = rankReferenceRows();
  let expanded = $state(false);
</script>

<li class="border-b border-surface">
  <button
    type="button"
    aria-expanded={expanded}
    class="flex w-full items-center justify-between gap-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    onclick={() => (expanded = !expanded)}
  >
    <span class="text-sm text-text">Rank reference</span>
    <svg
      class="shrink-0 text-icon-muted transition-transform motion-reduce:transition-none {expanded
        ? 'rotate-90'
        : ''}"
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
      <path d="M6 4l4 4-4 4" />
    </svg>
  </button>
  {#if expanded}
    <div class="overflow-x-auto pb-3">
      <table class="w-full border-collapse text-left">
        <caption class="sr-only">Rank reference</caption>
        <thead>
          <tr class="text-xs text-muted">
            <th scope="col" class="py-1 pr-3 font-medium">Rank</th>
            <th scope="col" class="py-1 pr-3 font-medium">Level range</th>
            <th scope="col" class="py-1 pr-3 font-medium">Freezes per week</th>
            <th scope="col" class="py-1 pr-3 font-medium">Max points per task</th>
            <th scope="col" class="py-1 pr-3 font-medium">Multiplier</th>
            <th scope="col" class="py-1 font-medium">Penalty per missed stat</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.rank)}
            <tr class="border-t border-surface">
              <th scope="row" class="py-1 pr-3 font-mono text-xs font-normal text-text">
                {row.rank}
              </th>
              <td class="py-1 pr-3 font-mono text-xs text-muted">{row.levelRange}</td>
              <td class="py-1 pr-3 font-mono text-xs text-muted">{row.freezesPerWeek}</td>
              <td class="py-1 pr-3 font-mono text-xs text-muted">{row.maxPointsPerTask}</td>
              <td class="py-1 pr-3 font-mono text-xs text-muted">{row.multiplier}</td>
              <td class="py-1 font-mono text-xs text-muted">{row.penalty}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</li>
