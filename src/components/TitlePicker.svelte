<script lang="ts">
  import { TITLES } from '../engine/titles';
  import { titleUnlockCondition } from '../lib/title-condition';
  import { app } from '../stores/app';

  const catalogIds = new Set<string>(TITLES.map((title) => title.id));

  let expanded = $state(false);

  const equipped = $derived($app.userState.equippedTitle);
  const selectedId = $derived(equipped !== null && catalogIds.has(equipped) ? equipped : null);
  const unlockedIds = $derived(new Set($app.userState.unlockedTitles));
</script>

<li class="border-b border-surface">
  <button
    type="button"
    aria-expanded={expanded}
    class="flex w-full items-center justify-between gap-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    onclick={() => (expanded = !expanded)}
  >
    <span class="text-sm text-text">Title</span>
    <svg
      class="shrink-0 text-icon-muted transition-transform motion-reduce:transition-none {expanded
        ? 'rotate-90'
        : ''}"
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
      <path d="M6 4l4 4-4 4" />
    </svg>
  </button>
  {#if expanded}
    <fieldset class="pb-3">
      <legend class="sr-only">Title</legend>
      <div class="flex flex-col gap-1">
        <label class="flex cursor-pointer items-start gap-2 py-1">
          <input
            type="radio"
            name="title"
            class="mt-0.5 h-4 w-4 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            checked={selectedId === null}
            onchange={() => app.equipTitle(null)}
          />
          <span class="text-sm text-text">No title</span>
        </label>
        {#each TITLES as title (title.id)}
          {@const unlocked = unlockedIds.has(title.id)}
          <label
            class="flex items-start gap-2 py-1 {unlocked ? 'cursor-pointer' : 'cursor-not-allowed'}"
          >
            <input
              type="radio"
              name="title"
              value={title.id}
              class="mt-0.5 h-4 w-4 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              checked={selectedId === title.id}
              disabled={!unlocked}
              onchange={() => app.equipTitle(title.id)}
            />
            <span class="flex flex-col">
              <span class="text-sm {unlocked ? 'text-text' : 'text-muted'}">{title.name}</span>
              {#if !unlocked}
                <span class="text-xs text-muted">{titleUnlockCondition(title.id)}</span>
              {/if}
            </span>
          </label>
        {/each}
      </div>
    </fieldset>
  {/if}
</li>
