<script lang="ts">
  import { penaltyNotificationLine } from '../lib/today-lines';
  import { app } from '../stores/app';

  const penaltyStats = app.penaltyStats;
</script>

<div class="mt-2">
  <div class="rounded-sm border border-surface px-3 py-2">
    <p class="text-xs font-semibold text-muted">System message</p>
    <p class="mt-0.5 text-sm text-text">Complete at least 1 task in every stat today.</p>
  </div>
  {#each $penaltyStats as stat (stat)}
    <div class="mt-2 rounded-sm border border-danger px-3 py-2">
      <p class="text-sm text-text">
        {#each penaltyNotificationLine(stat) as segment, index (index)}<span
            class={segment.mono ? 'font-mono' : ''}>{segment.text}</span
          >{/each}
      </p>
    </div>
  {/each}
</div>
