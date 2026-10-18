<script lang="ts">
  import { statLabel, systemMessage } from '../../lib/today-page';
  import { millisecondsUntilNextMidnight, app } from '../../stores/app';
  import { STATS, type Stat } from '../../lib/types';

  /**
   * The quest column (UI Revamp Issue 2): the typing system message, the penalty
   * zone with its countdown to local midnight, and the quest rows.
   *
   * Which stats are penalised, how many completions each needs and how many it
   * has are the engine's (`DailyQuestDay`); `app.questRows` and `app.penaltyStats`
   * expose them. The copy is `today.html`'s.
   */

  const questRows = app.questRows;
  const penaltyStats = app.penaltyStats;

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

  const pad = (value: number): string => String(value).padStart(2, '0');

  /**
   * The countdown to local midnight, from the store's own
   * `millisecondsUntilNextMidnight` (the same value that arms the rollover), so
   * the target is the device's next local midnight and not a fixed hour.
   */
  let countdown = $derived.by(() => {
    const seconds = Math.max(0, Math.floor(millisecondsUntilNextMidnight(new Date()) / 1000));

    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(
      seconds % 60
    )}`;
  });

  function complete(row: Row, done: boolean): void {
    if (done) return;

    app.completeTask(row.taskId, null);
  }
</script>

<section class="quest boot" style="--i:2" aria-label="Daily quest">
  <div class="sys panel" style="padding:12px 14px">
    <small>Pesan sistem</small>
    <p><span>{message}</span><span class="caret"></span></p>
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
        type="button"
        class="qrow"
        class:done
        style={`--c: var(--stat-${row.stat.toLowerCase()})`}
        data-i={row.index}
        role="checkbox"
        aria-checked={done}
        onclick={() => complete(row, done)}
      >
        <span class="box"><svg viewBox="0 0 14 14"><path d="M2 7.5l3.2 3L12 3.500" /></svg></span>
        <span class="nm">{row.name}<small>{statLabel(row.stat)}</small></span>
        {#if row.required > 1}
          <span class="need">{row.completed}/{row.required}</span>
        {/if}
        <span class="pts">+{row.points}</span>
      </button>
    {/each}
  </div>
</section>
