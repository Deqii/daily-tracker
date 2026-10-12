<script lang="ts">
  import { freezesLine, rankUpBlockedLine } from '../lib/today-lines';
  import { app } from '../stores/app';

  const freezesLeft = app.freezesLeft;
  const rankGate = app.rankGate;
</script>

<p class="mt-2 text-sm text-muted">{freezesLine($freezesLeft)}</p>
{#if $rankGate.blocked && $rankGate.weakest !== null && $rankGate.current !== null}
  <p class="mt-1 text-sm text-muted">
    {#each rankUpBlockedLine($rankGate.weakest, $rankGate.threshold, $rankGate.current) as segment, index (index)}<span
        class={segment.mono ? 'font-mono' : ''}>{segment.text}</span
      >{/each}
  </p>
{/if}
