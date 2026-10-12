<script lang="ts">
  import { app } from '../stores/app';

  const progress = app.levelProgress;
</script>

<div class="mt-2">
  <p class="text-sm text-text">
    <span class="font-mono">{$progress.xpIntoLevel}</span>
    /
    <span class="font-mono">{$progress.xpForThisLevel}</span>
    xp to Level
    <span class="font-mono">{$progress.level + 1}</span>
  </p>
  <div
    role="progressbar"
    aria-label="XP progress to the next level"
    aria-valuemin="0"
    aria-valuemax={$progress.xpForThisLevel}
    aria-valuenow={$progress.xpIntoLevel}
    class="mt-1 h-0.5 w-full rounded-sm bg-surface"
  >
    <div class="h-full rounded-sm bg-accent" style={`width: ${$progress.ratio * 100}%`}></div>
  </div>
</div>
