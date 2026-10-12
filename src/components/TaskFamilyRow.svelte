<script lang="ts">
  import { getRankConfig } from '../engine/rank';
  import { taskTag, variantPointsLabel, overCapLabel } from '../lib/tasks-list';
  import { tierLabel } from '../lib/today-lines';
  import type { Task, Tier } from '../lib/types';
  import { app } from '../stores/app';
  import DeleteConfirm from './DeleteConfirm.svelte';

  interface Props {
    task: Task;
    onedit?: (task: Task) => void;
  }

  let { task, onedit }: Props = $props();

  const rank = app.rank;

  let confirming = $state(false);

  const TIER_MARKER_CLASS: Record<Tier, string> = {
    easy: 'bg-tier-easy',
    medium: 'bg-tier-medium',
    hard: 'bg-tier-hard',
  };

  const maxPointsPerTask = $derived(getRankConfig($rank).maxPointsPerTask);
</script>

{#if confirming}
  <DeleteConfirm
    name={task.familyName}
    onconfirm={() => app.deleteTask(task.id)}
    oncancel={() => (confirming = false)}
  />
{:else}
  <li class="border-b border-surface py-2">
    <div class="flex items-center gap-2">
      <span class="text-sm text-text">{task.familyName}</span>
      <span class="shrink-0 rounded-sm border border-surface px-1.5 py-0.5 text-xs text-muted">
        {taskTag(task)}
      </span>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Edit ${task.familyName}`}
          class="inline-flex shrink-0 items-center rounded-sm p-1 text-icon-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onclick={() => onedit?.(task)}
        >
          <svg
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
            <path d="M11.5 2.5l2 2-7.5 7.5-2.5.5.5-2.5z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={`Delete ${task.familyName}`}
          class="inline-flex shrink-0 items-center rounded-sm p-1 text-icon-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onclick={() => (confirming = true)}
        >
          <svg
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
            <path d="M3 4.5h10" />
            <path d="M6.5 4.5V3h3v1.5" />
            <path d="M4.5 4.5l.5 8h6l.5-8" />
          </svg>
        </button>
      </div>
    </div>
    <ul class="mt-1 ml-6">
      {#each task.variants as variant (variant.tier)}
        {@const capLabel = overCapLabel(variant.points, maxPointsPerTask)}
        <li class="flex items-center gap-2 py-1">
          <span
            class="h-2 w-2 shrink-0 rounded-[1px] {TIER_MARKER_CLASS[variant.tier]}"
            aria-hidden="true"
          ></span>
          <span class="text-sm text-text">{tierLabel(variant.tier)}</span>
          <span class="text-xs text-muted">{variant.description}</span>
          <span class="ml-auto font-mono text-sm text-muted">
            {variantPointsLabel(variant.points)}
          </span>
          {#if capLabel !== null}
            <span class="shrink-0 text-xs text-danger">{capLabel}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </li>
{/if}
