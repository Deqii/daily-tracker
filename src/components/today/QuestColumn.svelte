<script lang="ts">
  import { tick } from 'svelte';
  import { statColorToken, statLabel, systemMessage } from '../../lib/today-page';
  import { questCounterLabel, questPointsLabel, tierLabel } from '../../lib/today-lines';
  import { resolvedToken } from '../../lib/tokens';
  import { FX_MS, motionIsReduced } from '../../lib/tween';
  import { millisecondsUntilNextMidnight, app } from '../../stores/app';
  import { showToast } from '../../stores/toast';
  import { STATS, type Stat, type Tier } from '../../lib/types';

  /**
   * The quest column (UI Revamp Issue 2): the typing system message, the penalty
   * zone with its countdown to local midnight, and the quest rows.
   *
   * Which stats are penalised, how many completions each needs and how many it
   * has are the engine's (`DailyQuestDay`); `app.questRows` and `app.penaltyStats`
   * expose them. The copy is `today.html`'s, as are the mechanics: the message
   * types at one character per 18 ms (line 273), the countdown ticks every second
   * to local midnight (line 277), a completion floats `+N XP` inside an expanding
   * ring at the click position for 1100 ms (line 256) and raises a toast naming
   * the row (line 261).
   *
   * A rotating row with several effort variants is a tier picker: the row expands,
   * Escape closes it and returns focus, and choosing a tier completes the task at
   * that variant through `app.completeTask(taskId, tier)`. The prototype's demo
   * `apply()` is not copied; the engine owns the award.
   */

  const questRows = app.questRows;
  const penaltyStats = app.penaltyStats;

  /** One character per tick, as the prototype's typing loop. */
  const TYPE_MS = 18;
  const COUNTDOWN_MS = 1000;

  /** One quest row, flattened out of the per-stat groups in the fixed stat order. */
  interface Row {
    readonly index: number;
    readonly taskId: string;
    readonly name: string;
    readonly stat: Stat;
    readonly required: number;
    readonly completed: number;
    readonly pointsMin: number;
    readonly pointsMax: number;
    readonly awarded: number | null;
    readonly options: readonly {
      readonly tier: Tier;
      readonly description: string;
      readonly points: number;
    }[];
  }

  let rows = $derived(
    $questRows
      .flatMap((group) =>
        group.rows.map((row) => {
          let awarded: number | null = null;

          if (row.options.length > 1 && group.completed >= group.required) {
            for (const completion of $app.completions) {
              if (
                completion.localDate === $app.userState.lastRolloverDate &&
                completion.taskId === row.task.id
              ) {
                awarded = completion.pointsAwarded;
              }
            }
          }

          return {
            index: 0,
            taskId: row.task.id,
            name: row.task.familyName,
            stat: group.stat,
            required: group.required,
            completed: group.completed,
            pointsMin: row.points.min,
            pointsMax: row.points.max,
            awarded,
            options: row.options,
          };
        })
      )
      .map((row, index) => ({ ...row, index }))
  );

  let satisfied = $derived($questRows.filter((group) => group.completed >= group.required).length);

  /** The expanded tier picker, by row index, or `null` when every picker is closed. */
  let openTier = $state<number | null>(null);

  /**
   * A penalty zone stays up while any penalised stat is short of its second
   * completion. `penaltyStats` is the engine's list of stats the day requires two
   * completions of; the counts are the open day's.
   */
  let penalised = $derived(
    $penaltyStats.filter((stat) => {
      const group = $questRows.find((entry) => entry.stat === stat);

      return group !== undefined && group.completed < group.required;
    })
  );

  let cleared = $derived(penalised.length === 0);

  /** The stat the banner names: the first one the engine flagged, met or not. */
  let penaltyStatLabel = $derived(statLabel($penaltyStats[0] ?? 'SOC'));

  let message = $derived(
    rows.length === 0
      ? 'Complete at least 1 task in every stat today.'
      : systemMessage(satisfied, cleared)
  );

  /* ------------------------------------------------- typing system message */

  let typed = $state('');

  $effect(() => {
    const text = message;

    if (motionIsReduced()) {
      typed = text;

      return;
    }

    typed = '';
    let shown = 0;

    const timer = setInterval(() => {
      shown += 1;
      typed = text.slice(0, shown);

      if (shown >= text.length) clearInterval(timer);
    }, TYPE_MS);

    return () => clearInterval(timer);
  });

  /* ------------------------------------------------------- countdown to midnight */

  const pad = (value: number): string => String(value).padStart(2, '0');

  /**
   * `millisecondsUntilNextMidnight` is the store's own value, the one that arms
   * the rollover, so the target is the device's next local midnight and not a
   * fixed hour.
   */
  function untilMidnight(): string {
    const seconds = Math.max(0, Math.floor(millisecondsUntilNextMidnight(new Date()) / 1000));

    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(
      seconds % 60
    )}`;
  }

  let countdown = $state(untilMidnight());

  $effect(() => {
    const timer = setInterval(() => {
      countdown = untilMidnight();
    }, COUNTDOWN_MS);

    return () => clearInterval(timer);
  });

  /* ----------------------------------------------------------- a completion */

  /**
   * The prototype's `fx(e, k, pts)` (line 256): an expanding ring and a floating
   * `+N XP`, both positioned from the click. A keyboard activation reports no
   * coordinates, so the prototype falls back to the row's own box, and so does
   * this. Both elements are removed from the DOM after 1100 ms.
   */
  function burst(event: MouseEvent, stat: Stat, points: number): void {
    const row = event.currentTarget;

    const box =
      row instanceof Element
        ? row.getBoundingClientRect()
        : { left: event.clientX, top: event.clientY };

    const x = event.clientX || box.left + 30;
    const y = event.clientY || box.top;
    const color = resolvedToken(statColorToken(stat));

    const ring = document.createElement('div');
    const floating = document.createElement('div');

    ring.className = 'ring';
    ring.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
    floating.className = 'float';
    floating.textContent = `+${points} XP`;
    floating.style.cssText = `left:${x + 14}px;top:${y - 12}px`;

    document.body.append(ring, floating);
    setTimeout(() => {
      ring.remove();
      floating.remove();
    }, FX_MS);
  }

  /**
   * Completing a row is `app.completeTask` and nothing else: the engine owns the
   * points, the cap, the level and the rank (PRD §7.7). A chosen tier is passed
   * as the variant; a single-variant row passes `null`, as the prototype does.
   * A row already at its requirement does nothing.
   */
  function complete(row: Row, done: boolean, event: MouseEvent, tier: Tier | null): void {
    if (done) return;

    const result = app.completeTask(row.taskId, tier);

    if (!result.ok) return;

    openTier = null;
    burst(event, row.stat, result.value.completion.pointsAwarded);
    showToast(`${row.name} completed`);
  }

  function activate(row: Row, done: boolean, event: MouseEvent): void {
    if (done) return;

    if (row.options.length > 1) {
      openTier = openTier === row.index ? null : row.index;

      return;
    }

    complete(row, done, event, null);
  }

  async function chooseTier(row: Row, tier: Tier, event: MouseEvent): Promise<void> {
    complete(row, false, event, tier);
    await tick();
  }

  async function onKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key !== 'Escape' || openTier === null) return;

    const index = openTier;
    openTier = null;
    await tick();
    document.querySelector<HTMLElement>(`.qrow[data-i="${index}"]`)?.focus();
  }

  /** The tier -> corner-colour token letter the prototype uses (`'rsb'`). */
  function tierColorKey(tier: Tier): string {
    if (tier === 'easy') return 'r';
    if (tier === 'medium') return 's';

    return 'b';
  }
</script>

<svelte:window onkeydown={onKeydown} />

<section class="quest boot" style="--i:2" aria-label="Daily quest">
  <div class="sys panel" style="padding:12px 14px">
    <small>System message</small>
    <p><span>{typed}</span><span class="caret"></span></p>
  </div>
  {#if rows.length > 0}
    <div class="penalty" class:clear={cleared}>
      <div>
        <strong>{cleared ? 'Penalty cleared' : 'Penalty active'}</strong>
        <div class="sub">
          {cleared
            ? `${penaltyStatLabel} has 2 completions.`
            : `${penaltyStatLabel} needs 2 completions today.`}
        </div>
      </div>
      <div class="timer">
        <span style={cleared ? 'color: var(--ok)' : undefined}>{countdown}</span>
        <small>until rollover</small>
      </div>
    </div>
  {/if}
  <div class="row">
    <h2>Daily quest</h2>
    <span class="sub">{rows.length === 0 ? '' : `${satisfied}/${STATS.length}`}</span>
  </div>
  {#if rows.length === 0}
    <div class="empty">
      <h2>No tasks yet</h2>
      <p>Add your first task to start your daily quest.</p>
      <a class="btn" href="#/tasks">Add task</a>
    </div>
  {:else}
    <div style="display:flex;flex-direction:column;gap:8px">
      {#each rows as row (row.taskId)}
        {@const done = row.completed >= row.required}
        {#if row.options.length > 1}
          <div class="qgroup">
            <button
              class="qrow"
              class:done
              style={`--c: var(${statColorToken(row.stat)})`}
              data-i={row.index}
              role={done ? 'checkbox' : undefined}
              aria-checked={done ? 'true' : undefined}
              aria-expanded={done ? undefined : openTier === row.index}
              aria-controls={done ? undefined : `tiers-${row.index}`}
              onclick={(event) => activate(row, done, event)}
            >
              <span class="box"
                ><svg viewBox="0 0 14 14"><path d="M2 7.5l3.2 3L12 3.500" /></svg></span
              >
              <span class="nm">{row.name}<small>{statLabel(row.stat)}</small></span>
              <span class="pts"
                >{done
                  ? `+${row.awarded ?? row.pointsMax}`
                  : questPointsLabel(row.pointsMin, row.pointsMax)}</span
              >
              {#if !done}
                <span class="chev" aria-hidden="true"></span>
              {/if}
            </button>
            {#if !done && openTier === row.index}
              <div
                class="tiers"
                id={`tiers-${row.index}`}
                role="group"
                aria-label={`Choose effort for ${row.name}`}
                style={`--c: var(${statColorToken(row.stat)})`}
              >
                {#each row.options as option (option.tier)}
                  <button
                    class="tier"
                    data-i={row.index}
                    data-t={option.tier}
                    style={`--tc: var(--tier-${tierColorKey(option.tier)})`}
                    onclick={(event) => chooseTier(row, option.tier, event)}
                  >
                    <span>{tierLabel(option.tier)}</span><small>{option.description}</small><b
                      >+{option.points}</b
                    >
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <button
            class="qrow"
            class:done
            style={`--c: var(${statColorToken(row.stat)})`}
            data-i={row.index}
            role="checkbox"
            aria-checked={done}
            onclick={(event) => complete(row, done, event, null)}
          >
            <span class="box"
              ><svg viewBox="0 0 14 14"><path d="M2 7.5l3.2 3L12 3.500" /></svg></span
            >
            <span class="nm">{row.name}<small>{statLabel(row.stat)}</small></span>
            {#if row.required > 1}
              <span class="need">{questCounterLabel(row.completed, row.required)}</span>
            {/if}
            <span class="pts">+{row.pointsMin}</span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</section>
