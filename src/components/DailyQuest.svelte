<script lang="ts">
  import {
    questCounterLabel,
    questPointsLabel,
    questRowState,
    tierLabel,
  } from '../lib/today-lines';
  import type { Tier } from '../lib/types';
  import { app, type QuestRow } from '../stores/app';

  const questRows = app.questRows;

  const TIER_MARKER_CLASS: Record<Tier, string> = {
    easy: 'bg-tier-easy',
    medium: 'bg-tier-medium',
    hard: 'bg-tier-hard',
  };

  let expandedTaskId = $state<string | null>(null);
  let satisfied = $derived($questRows.filter((group) => group.completed >= group.required).length);

  function statusLabel(row: QuestRow): string {
    return row.options.length > 1
      ? `Choose effort for ${row.task.familyName}`
      : `Complete ${row.task.familyName}`;
  }

  function activateStatus(row: QuestRow): void {
    if (row.options.length > 1) {
      expandedTaskId = expandedTaskId === row.task.id ? null : row.task.id;
      return;
    }

    app.completeTask(row.task.id, null);
  }

  function chooseTier(taskId: string, tier: Tier): void {
    app.completeTask(taskId, tier);
    expandedTaskId = null;
  }
</script>

{#if $questRows.length > 0}
  <section class="mt-4">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="text-xs font-semibold text-muted">Daily quest</h2>
      <span class="font-mono text-xs text-muted">{satisfied}/{$questRows.length}</span>
    </div>
    <ul class="mt-1 border-t border-surface">
      {#each $questRows as group (group.stat)}
        {#each group.rows as row (row.task.id)}
          {@const state = questRowState(group.completed, group.required)}
          {@const isExpanded = state !== 'done' && expandedTaskId === row.task.id}
          <li class="border-b border-surface py-2">
            <div class="flex items-center gap-2">
              {#if state === 'done'}
                <span class="shrink-0 text-action-ink" aria-hidden="true">
                  <svg
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    focusable="false"
                  >
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                </span>
              {:else}
                <button
                  type="button"
                  aria-label={statusLabel(row)}
                  aria-expanded={row.options.length > 1 ? isExpanded : undefined}
                  class="inline-flex shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onclick={() => activateStatus(row)}
                >
                  {#if state === 'penalty'}
                    <svg
                      class="text-danger"
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
                      <path d="M8 2.5L13.5 12h-11z" />
                      <path d="M8 6.5v2.5" />
                      <path d="M8 10.75h0.01" />
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
                </button>
              {/if}
              <span class="text-sm text-text">{row.task.familyName}</span>
              <span
                class="ml-auto font-mono text-sm {state === 'penalty'
                  ? 'text-danger'
                  : 'text-muted'}"
              >
                {state === 'penalty'
                  ? questCounterLabel(group.completed, group.required)
                  : questPointsLabel(row.points.min, row.points.max)}
              </span>
            </div>
            {#if isExpanded}
              <ul class="mt-1 ml-6">
                {#each row.options as option (option.tier)}
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 rounded-sm py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onclick={() => chooseTier(row.task.id, option.tier)}
                    >
                      <span
                        class="h-2 w-2 shrink-0 rounded-[1px] {TIER_MARKER_CLASS[option.tier]}"
                        aria-hidden="true"
                      ></span>
                      <span class="text-sm text-text">{tierLabel(option.tier)}</span>
                      <span class="text-xs text-muted">{option.description}</span>
                      <span class="ml-auto font-mono text-sm text-muted">
                        {questPointsLabel(option.points, option.points)}
                      </span>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      {/each}
    </ul>
  </section>
{/if}
