<script lang="ts">
  import { statColorToken, statLabel, systemMessage } from '../../lib/today-page';
  import { resolvedToken } from '../../lib/tokens';
  import { FX_MS, motionIsReduced } from '../../lib/tween';
  import { millisecondsUntilNextMidnight, app } from '../../stores/app';
  import { showToast } from '../../stores/toast';
  import { STATS, type Stat } from '../../lib/types';

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
    readonly points: number;
  }

  let rows = $derived(
    $questRows
      .flatMap((group) =>
        group.rows.map((row) => ({
          index: 0,
          taskId: row.task.id,
          name: row.task.familyName,
          stat: group.stat,
          required: group.required,
          completed: group.completed,
          points: row.points.min,
        }))
      )
      .map((row, index) => ({ ...row, index }))
  );

  let satisfied = $derived($questRows.filter((group) => group.completed >= group.required).length);

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

  let message = $derived(systemMessage(satisfied, cleared));

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
      row instanceof Element ? row.getBoundingClientRect() : { left: event.clientX, top: event.clientY };

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
   * points, the cap, the level and the rank (PRD §7.7). Everything that follows -
   * the radar morph, the counter, the banner, the toast - is driven by the new
   * state. A row already at its requirement does nothing, as in the prototype's
   * click handler.
   */
  function complete(row: Row, done: boolean, event: MouseEvent): void {
    if (done) return;

    const result = app.completeTask(row.taskId, null);

    if (!result.ok) return;

    burst(event, row.stat, result.value.completion.pointsAwarded);
    showToast(`${row.name} selesai`);
  }
</script>

<section class="quest boot" style="--i:2" aria-label="Daily quest">
  <div class="sys panel" style="padding:12px 14px">
    <small>Pesan sistem</small>
    <p><span>{typed}</span><span class="caret"></span></p>
  </div>
  <div class="penalty" class:clear={cleared}>
    <div>
      <strong>{cleared ? 'Penalty dibersihkan' : 'Penalty zone aktif'}</strong>
      <div class="sub">
        {cleared
          ? `${penaltyStatLabel} memenuhi 2 penyelesaian.`
          : `${penaltyStatLabel} butuh 2 penyelesaian hari ini.`}
      </div>
    </div>
    <div class="timer">
      <span style={cleared ? 'color: var(--ok)' : undefined}>{countdown}</span>
      <small>sampai rollover</small>
    </div>
  </div>
  <div class="row">
    <h2>Daily quest</h2>
    <span class="sub">{satisfied}/{STATS.length} stat terpenuhi</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px">
    {#each rows as row (row.index)}
      {@const done = row.completed >= row.required}
      <button
        class="qrow"
        class:done
        style={`--c: var(${statColorToken(row.stat)})`}
        data-i={row.index}
        role="checkbox"
        aria-checked={done}
        onclick={(event) => complete(row, done, event)}
      >
        <span class="box"
          ><svg viewBox="0 0 14 14"><path d="M2 7.5l3.2 3L12 3.500" /></svg></span
        >
        <span class="nm">{row.name}<small>{statLabel(row.stat)}</small></span>
        {#if row.required > 1}
          <span class="need">{row.completed}/{row.required}</span>
        {/if}
        <span class="pts">+{row.points}</span>
      </button>
    {/each}
  </div>
</section>
