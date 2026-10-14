<script lang="ts">
  import { app } from '../stores/app';
  import { pendingRankDownNotices } from '../lib/reveal';

  const pending = $derived(pendingRankDownNotices($app.milestoneEvents));
  const current = $derived(pending[0] ?? null);
</script>

{#if current !== null}
  <div class="rounded-sm border border-danger px-3 py-2">
    <p class="text-sm text-text">Rank dropped to {current.to}</p>
    <button
      type="button"
      class="mt-1 text-xs text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onclick={() => {
        app.markMilestoneSeen(current.id);
      }}
    >
      Dismiss
    </button>
  </div>
{/if}
