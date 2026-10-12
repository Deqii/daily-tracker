<script lang="ts">
  import SingleTierTaskRow from '../components/SingleTierTaskRow.svelte';
  import TaskFamilyRow from '../components/TaskFamilyRow.svelte';
  import TaskForm from '../components/TaskForm.svelte';
  import {
    groupTasksByStat,
    hasEffortVariants,
    statSectionLabel,
    taskCountLabel,
  } from '../lib/tasks-list';
  import type { Task } from '../lib/types';
  import { app } from '../stores/app';

  const groups = $derived(groupTasksByStat($app.tasks));
  const count = $derived($app.tasks.length);

  let editing = $state<Task | null>(null);
  let formOpen = $state(false);

  const layoutClass = $derived(formOpen ? 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-6' : '');

  function openAdd(): void {
    editing = null;
    formOpen = true;
  }

  function openEdit(task: Task): void {
    editing = task;
    formOpen = true;
  }

  function closeForm(): void {
    formOpen = false;
    editing = null;
  }
</script>

<section class="p-4 {layoutClass}">
  <div>
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-baseline gap-2">
        <h2 class="text-xl font-semibold">Task library</h2>
        <span class="text-xs text-muted">{taskCountLabel(count)}</span>
      </div>
      <button
        type="button"
        class="inline-flex min-h-11 shrink-0 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
        onclick={openAdd}
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
              <TaskFamilyRow {task} onedit={openEdit} />
            {:else}
              <SingleTierTaskRow {task} onedit={openEdit} />
            {/if}
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  {#if formOpen}
    <aside class="mt-6 lg:mt-0">
      {#key editing?.id ?? 'new'}
        <TaskForm task={editing} onsave={closeForm} oncancel={closeForm} />
      {/key}
    </aside>
  {/if}
</section>
