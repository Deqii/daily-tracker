<script lang="ts">
  import {
    groupTasksByStat,
    statSectionLabel,
    taskCountLabel,
    taskPointsLabel,
    taskTag,
  } from '../lib/tasks-list';
  import { app } from '../stores/app';

  const groups = $derived(groupTasksByStat($app.tasks));
  const count = $derived($app.tasks.length);
</script>

<section class="p-4">
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-baseline gap-2">
      <h2 class="text-xl font-semibold">Task library</h2>
      <span class="text-xs text-muted">{taskCountLabel(count)}</span>
    </div>
    <button
      type="button"
      class="inline-flex min-h-11 shrink-0 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
    >
      Add task
    </button>
  </div>

  {#each groups as group (group.stat)}
    <section class="mt-4">
      <h3 class="text-xs font-semibold text-muted">{statSectionLabel(group.stat)}</h3>
      <ul class="mt-1 border-t border-surface">
        {#each group.tasks as task (task.id)}
          <li class="flex items-center gap-2 border-b border-surface py-2">
            <span class="text-sm text-text">{task.familyName}</span>
            <span
              class="shrink-0 rounded-sm border border-surface px-1.5 py-0.5 text-xs text-muted"
            >
              {taskTag(task)}
            </span>
            <span class="ml-auto font-mono text-sm text-muted">{taskPointsLabel(task)}</span>
            <button
              type="button"
              aria-label={`Edit ${task.familyName}`}
              class="inline-flex shrink-0 items-center rounded-sm p-1 text-icon-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</section>
