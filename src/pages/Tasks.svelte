<script lang="ts">
  import { onMount } from 'svelte';
  import { rankCap } from '../lib/tasks-page';
  import {
    TASKS_STATS,
    TASKS_TIERS,
    capHint,
    drawerDraftToTaskFormDraft,
    emptyDrawerDraft,
    emptyTasksFilter,
    filterTasks,
    overCapBanner,
    pickedTaskIds,
    taskToDrawerDraft,
    tasksSummary,
    validateDrawerDraft,
    variantXp,
    type DrawerDraft,
  } from '../lib/tasks-page';
  import { motionIsReduced } from '../lib/tween';
  import type { Task, Tier } from '../lib/types';
  import { app } from '../stores/app';

  /**
   * Tasks page (UI Revamp Issue 3).
   *
   * The markup, class names and attributes are `docs/prototype/tasks.html`'s.
   * The drawer, scrim and toast are the prototype's direct children of `<body>`,
   * so they are moved there by `portal` after mount; the rest renders inside the
   * shared `<main>`.
   *
   * Every value the page prints comes from the store or the engine: tasks and
   * picks from the app store, the cap and XP from `getRankConfig`/`pointsAwarded`.
   * The prototype's `CAP`, `MULT`, `xp()`, demo task list and `pick` flags are
   * not copied.
   */

  let query = $state('');
  let statFilter = $state<'ALL' | Task['stat']>('ALL');
  let typeFilter = $state<'ALL' | 'Anchor' | 'Rotating'>('ALL');

  let drawerOpen = $state(false);
  let editingId = $state<string | null>(null);
  let draft = $state<DrawerDraft>(emptyDrawerDraft());
  let submitted = $state(false);
  let nameInput = $state<HTMLInputElement | null>(null);
  let opener: HTMLElement | null = null;

  let confirmId = $state<string | null>(null);
  let outId = $state<string | null>(null);
  let flashId = $state<string | null>(null);

  let toastText = $state('');
  let toastVisible = $state(false);
  let drawerRendered = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const overCapCopy = 'Over cap: counts as ${CAP}';
  const tasks = $derived($app.tasks);
  const rank = app.rank;
  const cap = $derived(rankCap($rank));
  const openDay = $derived(
    $app.dailyQuestLog.find((day) => day.date === $app.userState.lastRolloverDate)
  );
  const picks = $derived(pickedTaskIds(openDay));

  const filter = $derived({ query, stat: statFilter, type: typeFilter });
  const visible = $derived(filterTasks(tasks, filter));
  const summary = $derived(tasksSummary(tasks));
  const banner = $derived(overCapBanner(tasks, cap, $rank));
  const errors = $derived(validateDrawerDraft(draft, $rank));

  /** Moves a prototype-overlay node to `<body>`, where the prototype keeps it. */
  function portal(node: HTMLElement): { destroy: () => void } {
    document.body.appendChild(node);

    return {
      destroy() {
        node.remove();
      },
    };
  }

  function tierDisplay(tier: Tier) {
    const match = TASKS_TIERS.find((entry) => entry.tier === tier);

    if (match === undefined) {
      throw new RangeError(`Unknown tier: ${tier}`);
    }

    return match;
  }

  function isMulti(task: Task): boolean {
    return task.variants.length > 1;
  }

  function singleVariant(task: Task) {
    return task.variants[0] ?? null;
  }

  function taskXp(points: number): number {
    return variantXp(points, $rank);
  }

  function previewXp(points: string): string {
    const value = Number(points);

    return Number.isFinite(value) && value > 0 ? `+${variantXp(value, $rank)} XP` : '';
  }

  function openDrawer(task: Task | null): void {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editingId = task?.id ?? null;
    draft = task === null ? emptyDrawerDraft() : taskToDrawerDraft(task);
    submitted = false;
    drawerRendered = true;
    drawerOpen = true;

    setTimeout(() => nameInput?.focus(), 150);
  }

  function closeDrawer(): void {
    drawerOpen = false;
    submitted = false;
    opener?.focus?.();
  }

  function saveTask(): void {
    submitted = true;

    if (!validateDrawerDraft(draft, $rank).valid) return;

    const wasEdit = editingId !== null;
    const id = app.saveTask(drawerDraftToTaskFormDraft(draft), editingId);

    closeDrawer();
    const reset = emptyTasksFilter();
    query = reset.query;
    statFilter = reset.stat;
    typeFilter = reset.type;
    flashId = id;
    showToast(wasEdit ? 'Task updated' : 'Task added');

    setTimeout(() => {
      document
        .querySelector(`[data-id="${id}"]`)
        ?.scrollIntoView({ block: 'center', behavior: motionIsReduced() ? 'auto' : 'smooth' });
    }, 60);

    setTimeout(() => {
      if (flashId === id) flashId = null;
    }, 1100);
  }

  function askDelete(task: Task): void {
    confirmId = task.id;
    setTimeout(() => {
      const cancel = document.querySelector('[data-cc]');

      if (cancel instanceof HTMLElement) cancel.focus();
    }, 0);
  }

  function cancelDelete(): void {
    confirmId = null;
  }

  function deleteTask(task: Task): void {
    outId = task.id;

    setTimeout(
      () => {
        app.deleteTask(task.id);
        confirmId = null;
        outId = null;
        showToast(`"${task.familyName}" deleted`);
      },
      motionIsReduced() ? 0 : 280
    );
  }

  function showToast(text: string): void {
    toastText = text;
    toastVisible = true;

    if (toastTimer !== null) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toastVisible = false;
      toastTimer = null;
    }, 6000);
  }

  onMount(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;

      if (drawerOpen) closeDrawer();

      if (confirmId !== null) confirmId = null;
    };

    window.addEventListener('keydown', onKeydown);

    return () => window.removeEventListener('keydown', onKeydown);
  });
</script>

<div class="head boot" style="--i:0">
  <div>
    <h1>Task library</h1>
    <p class="sub" id="summary">{summary}</p>
  </div>
  <button class="btn" id="add" onclick={() => openDrawer(null)}>
    <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="2.4"
      ><path d="M7 1v12M1 7h12" /></svg
    >Add task
  </button>
</div>
<div class="tools boot" style="--i:1">
  <input
    class="search"
    id="q"
    type="search"
    placeholder="Search tasks…"
    aria-label="Search tasks"
    bind:value={query}
  />
  <div class="fc" id="statF" role="group" aria-label="Filter by stat">
    <button
      class="f"
      data-s="ALL"
      aria-pressed={statFilter === 'ALL'}
      onclick={() => (statFilter = 'ALL')}>All stats</button
    >
    {#each TASKS_STATS as option (option.stat)}
      <button
        class="f"
        data-s={option.stat}
        aria-pressed={statFilter === option.stat}
        style={`--c:var(${option.colorVar})`}
        onclick={() => (statFilter = option.stat)}
      >
        <i></i>{option.short}
      </button>
    {/each}
  </div>
  <div class="sep"></div>
  <div class="fc" id="typeF" role="group" aria-label="Filter by type">
    {#each [['ALL', 'All types'], ['Anchor', 'Anchor'], ['Rotating', 'Rotating']] as [value, label] (value)}
      <button
        class="f"
        data-t={value}
        aria-pressed={typeFilter === value}
        onclick={() => (typeFilter = value as 'ALL' | 'Anchor' | 'Rotating')}>{label}</button
      >
    {/each}
  </div>
</div>
{#if banner !== null}
  <div class="warn boot" id="warn" style="--i:2">
    <b>{banner.label}</b><span>{banner.detail}</span>
  </div>
{/if}
<div class="groups" id="groups">
  {#each TASKS_STATS as stat, groupIndex (stat.stat)}
    {@const groupTasks = visible.filter((task) => task.stat === stat.stat)}
    {#if groupTasks.length > 0}
      <section class="panel group" style={`--c:var(${stat.colorVar});--i:${groupIndex + 3}`}>
        <header>
          <h2><i></i>{stat.label}</h2>
          <span class="sub">{groupTasks.length} task</span>
        </header>
        {#each groupTasks as task (task.id)}
          {@const multi = isMulti(task)}
          {@const variant = singleVariant(task)}
          <article
            class="task"
            class:flash={flashId === task.id}
            class:out={outId === task.id}
            data-id={task.id}
          >
            <div class="row">
              <div>
                <div class="nm">{task.familyName}</div>
                <div class="badges">
                  <span class="bd" class:a={task.isAnchor}
                    >{task.isAnchor ? 'Anchor' : 'Rotating'}</span
                  >
                  {#if picks.has(task.id) && !task.isAnchor}
                    <span class="bd t">Today’s quest</span>
                  {/if}
                  {#if !multi && variant !== null && cap !== null && variant.points > cap}
                    <span class="bd o">{overCapCopy}</span>
                  {/if}
                </div>
              </div>
              <div class="row">
                {#if !multi && variant !== null}
                  <div class="pt">
                    {variant.points} pts<small>+{taskXp(variant.points)} XP</small>
                  </div>
                {/if}
                <div class="acts">
                  <button
                    class="ib"
                    data-e={task.id}
                    aria-label={`Edit ${task.familyName}`}
                    onclick={() => openDrawer(task)}
                  >
                    <svg viewBox="0 0 16 16"><path d="M11 2l3 3-8 8H3v-3z" /></svg>
                  </button>
                  <button
                    class="ib del"
                    data-d={task.id}
                    aria-label={`Delete ${task.familyName}`}
                    onclick={() => askDelete(task)}
                  >
                    <svg viewBox="0 0 16 16"><path d="M3 4h10M6 4V2h4v2M5 4l.6 9h4.800L11 4" /></svg
                    >
                  </button>
                </div>
              </div>
            </div>
            {#if multi}
              <div class="vs">
                {#each task.variants as effort (effort.tier)}
                  {@const display = tierDisplay(effort.tier)}
                  <div
                    class="v"
                    class:over={cap !== null && effort.points > cap}
                    style={`--tc:var(${display.colorVar})`}
                  >
                    <em>{display.name}</em><span>{effort.description}</span>
                    <div class="pt">
                      {#if cap !== null && effort.points > cap}<span
                          class="bd o"
                          style="margin-right:6px">{overCapCopy}</span
                        >{/if}{effort.points} pts<small>+{taskXp(effort.points)} XP</small>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
            {#if confirmId === task.id}
              <div class="confirm" role="alertdialog" aria-label={`Delete ${task.familyName}?`}>
                <span>Delete {task.familyName}?</span>
                <span>
                  <button class="btn dng" data-cd={task.id} onclick={() => deleteTask(task)}
                    >Delete</button
                  >
                  <button class="btn ghost" data-cc="1" onclick={cancelDelete}>Cancel</button>
                </span>
              </div>
            {/if}
          </article>
        {/each}
      </section>
    {/if}
  {/each}
  {#if visible.length === 0}
    <div class="empty" style="grid-column:1/-1">
      {#if tasks.length === 0}
        <h2>No tasks yet</h2>
        <p>Add your first task to start your daily quest.</p>
        <button class="btn" data-add="1" onclick={() => openDrawer(null)}>Add task</button>
      {:else}
        No tasks match your filters.
      {/if}
    </div>
  {/if}
</div>

<!-- svelte-ignore a11y_click_events_have_key_events (tasks.html scrim; Escape closes) -->
<!-- svelte-ignore a11y_no_static_element_interactions (tasks.html scrim; Escape closes) -->
<div class="scrim" class:on={drawerOpen} id="scrim" use:portal onclick={closeDrawer}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role (tasks.html uses aside role=dialog) -->
<aside
  class="drawer"
  class:on={drawerOpen}
  id="drawer"
  role="dialog"
  aria-modal="true"
  aria-labelledby="dt"
  use:portal
>
  <div class="row">
    <h2 id="dt">{editingId === null ? 'Add task' : 'Edit task'}</h2>
    <button class="ib" id="x" aria-label="Close" onclick={closeDrawer}>
      <svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" /></svg>
    </button>
  </div>
  <label class="lab" for="fname">Task name</label>
  <input
    class="in"
    class:bad={submitted && errors.familyName}
    id="fname"
    maxlength="40"
    placeholder="Example: Push up routine"
    bind:this={nameInput}
    bind:value={draft.familyName}
  />
  <div class="err" id="eName">{submitted && errors.familyName ? 'Task name is required.' : ''}</div>
  <span class="lab">Stat</span>
  <div class="seg" id="seg" role="radiogroup" aria-label="Stat">
    {#if drawerRendered}
      {#each TASKS_STATS as option (option.stat)}
        <!-- svelte-ignore a11y_role_supports_aria_props (tasks.html sets both aria-checked and aria-pressed) -->
        <button
          class="f"
          role="radio"
          data-st={option.stat}
          aria-checked={draft.stat === option.stat}
          aria-pressed={draft.stat === option.stat}
          style={`--c:var(${option.colorVar})`}
          onclick={() => (draft.stat = option.stat)}>{option.short}</button
        >
      {/each}
    {/if}
  </div>
  <span class="lab">Type</span>
  <button
    class="tg"
    id="anchor"
    role="switch"
    aria-checked={draft.isAnchor}
    onclick={() => (draft.isAnchor = !draft.isAnchor)}
  >
    <span
      >Anchor task<span class="hint" style="display:block"
        >Always appears daily, never rotates.</span
      ></span
    ><span class="sw"></span>
  </button>
  <div class="row">
    <span class="lab">Effort variants</span><span class="hint" style="margin-top:16px"
      >{capHint($rank)}</span
    >
  </div>
  <div id="tiers">
    {#if drawerRendered}
      {#each draft.variants as tier, index (tier.tier)}
        {@const display = tierDisplay(tier.tier)}
        {@const tierErrors = errors.variants[index]}
        <div
          class="tier"
          class:off={!tier.enabled}
          style={`--tc:var(${display.colorVar})`}
          data-k={tier.tier}
        >
          <label class="h"
            ><input type="checkbox" bind:checked={tier.enabled} />{display.name}</label
          >
          <div class="tg2">
            <div>
              <input
                class="in d"
                maxlength="40"
                placeholder="What to do"
                aria-label={`Description ${display.name}`}
                disabled={!tier.enabled}
                bind:value={tier.description}
              />
            </div>
            <div>
              <input
                class="in p"
                type="number"
                min="1"
                step="1"
                aria-label={`Points ${display.name}`}
                disabled={!tier.enabled}
                value={tier.points}
                oninput={(event) => (tier.points = event.currentTarget.value)}
              />
              <div class="hint pv">{previewXp(tier.points)}</div>
            </div>
          </div>
          <div class="err">
            {#if submitted && tierErrors}
              {#if tierErrors.description}
                Describe what to do.
              {:else if tierErrors.points === 'MISSING'}
                Enter points.
              {:else if tierErrors.points === 'INVALID'}
                Enter a whole number of 1 or more.
              {:else if tierErrors.overCap !== null}
                Max {tierErrors.overCap} points at Rank {$rank}.
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <div class="err" id="eTier">
    {submitted && errors.noVariant ? 'Add at least one effort variant.' : ''}
  </div>
  <p class="hint">Satu varian saja = task single-tier, tanpa nama tier.</p>
  <div class="dfoot">
    <button class="btn" id="save" onclick={saveTask}>Save task</button>
    <button class="btn ghost" id="cancel" onclick={closeDrawer}>Cancel</button>
  </div>
</aside>
<div class="toast" class:show={toastVisible} id="toast" role="status" aria-live="polite" use:portal>
  <span id="toastTxt">{toastText}</span><button id="undo" hidden>Undo</button>
</div>
