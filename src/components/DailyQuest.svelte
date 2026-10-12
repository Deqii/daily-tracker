<script lang="ts">
  import { questCounterLabel, questPointsLabel, questRowState } from '../lib/today-lines';
  import { app } from '../stores/app';

  const questRows = app.questRows;

  let satisfied = $derived($questRows.filter((group) => group.completed >= group.required).length);
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
          <li class="flex items-center gap-2 border-b border-surface py-2">
            {#if state === 'done'}
              <svg
                class="shrink-0 text-action-ink"
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
            {:else if state === 'penalty'}
              <svg
                class="shrink-0 text-danger"
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
                class="shrink-0 text-icon-muted"
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
            <span class="text-sm text-text">{row.task.familyName}</span>
            <span
              class="ml-auto font-mono text-sm {state === 'penalty' ? 'text-danger' : 'text-muted'}"
            >
              {state === 'penalty'
                ? questCounterLabel(group.completed, group.required)
                : questPointsLabel(row.points.min, row.points.max)}
            </span>
          </li>
        {/each}
      {/each}
    </ul>
  </section>
{/if}
