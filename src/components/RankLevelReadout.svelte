<script lang="ts">
  import { app } from '../stores/app';

  const rank = app.rank;
  const level = app.level;
</script>

<div class="flex items-end justify-between gap-4">
  <div class="flex flex-col gap-1">
    <span class="text-xs text-muted">Rank</span>
    <span class="glow-text font-mono text-5xl font-semibold leading-none text-accent">{$rank}</span>
  </div>
  <div class="flex flex-col items-end gap-1">
    <span class="text-xs text-muted">Level</span>
    <span class="glow-text font-mono text-5xl font-semibold leading-none text-accent">
      {$level}
    </span>
  </div>
</div>
