<script lang="ts">
  import { pendingRankDownNotices } from '../../lib/reveal';
  import { app } from '../../stores/app';

  /**
   * The quiet rank-down notice (UI Revamp Issue 2). `today.html` inserts it as the
   * first child of `<main>`; dismissing it marks the event seen, and the next
   * unseen rank-down event takes its place.
   */

  const current = $derived(pendingRankDownNotices($app.milestoneEvents)[0] ?? null);

  function dismiss(id: string): void {
    app.markMilestoneSeen(id);
  }
</script>

{#if current !== null}
  <div class="notice" role="status">
    <span>Rank dropped to {current.to}</span>
    <button class="lnk" onclick={() => dismiss(current.id)}>Dismiss</button>
  </div>
{/if}
