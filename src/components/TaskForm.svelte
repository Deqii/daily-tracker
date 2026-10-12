<script lang="ts">
  import { statLabel, tierLabel } from '../lib/today-lines';
  import {
    emptyTaskFormDraft,
    taskToFormDraft,
    validateTaskForm,
    type TaskFormDraft,
  } from '../lib/task-form';
  import type { Task, Tier } from '../lib/types';
  import { STATS } from '../lib/types';
  import { app } from '../stores/app';
  import PanelFrame from './PanelFrame.svelte';

  interface Props {
    task?: Task | null;
    onsave: () => void;
    oncancel: () => void;
  }

  let { task = null, onsave, oncancel }: Props = $props();

  const TIER_MARKER_CLASS: Record<Tier, string> = {
    easy: 'bg-tier-easy',
    medium: 'bg-tier-medium',
    hard: 'bg-tier-hard',
  };

  const FIELD_CLASS =
    'mt-1 block w-full rounded-sm border border-surface bg-bg px-2 py-1.5 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-sm';

  const rank = app.rank;

  // svelte-ignore state_referenced_locally
  let draft = $state<TaskFormDraft>(task === null ? emptyTaskFormDraft() : taskToFormDraft(task));
  let submitted = $state(false);
  const errors = $derived(validateTaskForm(draft, $rank));

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    submitted = true;

    if (!errors.valid) {
      return;
    }

    app.saveTask(draft, task?.id ?? null);
    onsave();
  }
</script>

<PanelFrame class="p-4">
  <h2 class="text-sm font-semibold text-text">{task === null ? 'Add task' : 'Edit task'}</h2>
  <form class="mt-3" onsubmit={submit} novalidate>
    <label class="block">
      <span class="text-xs text-muted">Task name</span>
      <input type="text" bind:value={draft.familyName} class={FIELD_CLASS} />
    </label>
    {#if submitted && errors.familyName}
      <p class="mt-1 text-xs text-danger">Task name is required.</p>
    {/if}

    <label class="mt-3 block">
      <span class="text-xs text-muted">Stat</span>
      <select bind:value={draft.stat} class={FIELD_CLASS}>
        {#each STATS as stat (stat)}
          <option value={stat}>{statLabel(stat)}</option>
        {/each}
      </select>
    </label>

    <div class="mt-3">
      <button
        type="button"
        role="switch"
        aria-checked={draft.isAnchor}
        class="inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onclick={() => (draft.isAnchor = !draft.isAnchor)}
      >
        <span
          class="block h-5 w-9 rounded-sm transition-colors motion-reduce:transition-none {draft.isAnchor
            ? 'bg-action'
            : 'bg-surface'}"
        >
          <span
            class="block h-4 w-4 rounded-[1px] bg-text transition-transform motion-reduce:transition-none {draft.isAnchor
              ? 'translate-x-[18px]'
              : 'translate-x-0.5'}"
          ></span>
        </span>
        <span class="text-sm text-text">Anchor task</span>
      </button>
      <p class="mt-1 text-xs text-muted">Always appears daily, never rotates.</p>
    </div>

    <p class="mt-4 text-xs font-semibold text-muted">Effort variants</p>
    <p class="text-xs text-muted">Up to 3 tiers</p>
    {#if submitted && errors.noVariant}
      <p class="mt-1 text-xs text-danger">Add at least one effort variant.</p>
    {/if}

    {#each draft.variants as variant, index (variant.tier)}
      {@const variantErrors = errors.variants[index]}
      <div class="mt-2 rounded-sm border border-surface p-3">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-[1px] {TIER_MARKER_CLASS[variant.tier]}" aria-hidden="true"
          ></span>
          <span class="text-sm text-text">{tierLabel(variant.tier)}</span>
        </div>
        <label class="mt-2 block">
          <span class="text-xs text-muted">What to do</span>
          <input type="text" bind:value={variant.description} class={FIELD_CLASS} />
        </label>
        {#if submitted && variantErrors?.description}
          <p class="mt-1 text-xs text-danger">Describe what to do.</p>
        {/if}
        <label class="mt-2 block">
          <span class="text-xs text-muted">Points</span>
          <input type="text" inputmode="numeric" bind:value={variant.points} class={FIELD_CLASS} />
        </label>
        {#if submitted && variantErrors?.points === 'MISSING'}
          <p class="mt-1 text-xs text-danger">Enter points.</p>
        {/if}
        {#if submitted && variantErrors?.points === 'INVALID'}
          <p class="mt-1 text-xs text-danger">Enter a whole number of 1 or more.</p>
        {/if}
        {#if submitted && variantErrors && variantErrors.overCap !== null}
          <p class="mt-1 text-xs text-danger">
            Max {variantErrors.overCap} points at Rank {$rank}.
          </p>
        {/if}
      </div>
    {/each}

    <div class="mt-4 flex items-center gap-4">
      <button
        type="submit"
        class="inline-flex min-h-11 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
      >
        Save task
      </button>
      <button
        type="button"
        class="text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onclick={oncancel}
      >
        Cancel
      </button>
    </div>
  </form>
</PanelFrame>
