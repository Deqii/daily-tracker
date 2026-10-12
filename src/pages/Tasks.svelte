<script lang="ts">
  import SingleTierTaskRow from '../components/SingleTierTaskRow.svelte';
  import TaskFamilyRow from '../components/TaskFamilyRow.svelte';
  import {
    groupTasksByStat,
    hasEffortVariants,
    statSectionLabel,
    taskCountLabel,
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
          {#if hasEffortVariants(task)}
            <TaskFamilyRow {task} />
          {:else}
            <SingleTierTaskRow {task} />
          {/if}
        {/each}
      </ul>
    </section>
  {/each}
</section>
