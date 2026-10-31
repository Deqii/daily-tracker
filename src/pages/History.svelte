<script lang="ts">
  import { getRankConfig } from '../engine/rank';
  import { xpForLevel } from '../engine/level';
  import {
    HISTORY_HEIGHT,
    HISTORY_PADDING_BOTTOM,
    HISTORY_PADDING_LEFT,
    HISTORY_PADDING_RIGHT,
    HISTORY_PADDING_TOP,
    HISTORY_RANGES,
    HISTORY_WIDTH,
    buildHistoryDays,
    calendarOffset,
    chartAriaLabel,
    chartLabelIndices,
    chartScale,
    chartThresholdY,
    chartX,
    chartY,
    formatRangeLabel,
    formatShortDate,
    formatTooltipDate,
    historyLogRows,
    historySummary,
    historyView,
    statLabel,
    type HistoryEventKind,
    type HistoryRange,
  } from '../lib/history-page';
  import { app } from '../stores/app';

  /**
   * History page (UI Revamp Issue 5).
   *
   * Markup, class names, copy and ARIA are `docs/prototype/history.html`'s. The
   * prototype's demo simulation is not copied: every day, event and XP value is
   * read from the store through `buildHistoryDays`, and the summary, chart math
   * and log ordering come from `src/lib/history-page.ts` (unit-tested).
   *
   * UI mechanics that are copied: the chart cursor/tooltip, arrow-key and Home
   * / End navigation, range paging (`All` shows 60 days at a time), and the
   * click/keyboard cross-highlight between chart, event list, calendar and log.
   */

  const streak = app.streak;
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

  const RANGE_LABEL: Record<HistoryRange, string> = {
    7: '7 days',
    30: '30 days',
    all: 'All',
  };

  const EVENT_COLOR: Record<HistoryEventKind, string> = {
    rankUp: '--blue',
    rankDown: '--danger',
    levelUp: '--cyan',
    milestone: '--monarch',
  };

  const EVENT_GLYPH: Record<HistoryEventKind, string> = {
    rankUp: '▲',
    rankDown: '▼',
    levelUp: '◆',
    milestone: '★',
  };

  let range = $state<HistoryRange>(7);
  let shown = $state(60);
  let selectedDate = $state<string | null>(null);
  let cursorIndex = $state<number | null>(null);
  let tipOn = $state(false);

  const today = $derived($app.userState.lastRolloverDate);
  const days = $derived(
    buildHistoryDays(
      $app.dailyQuestLog,
      $app.milestoneEvents,
      $app.userState.lifetimeXP,
      today
    )
  );
  const viewDays = $derived(historyView(days, range, shown));
  const summary = $derived(historySummary(viewDays, $streak));
  const rows = $derived(historyLogRows(viewDays));
  const first = $derived(viewDays[0]);
  const events = $derived([...viewDays].flatMap((day) => day.events).reverse());

  const scale = $derived(chartScale(viewDays.map((day) => day.xp)));
  const rankD = getRankConfig('D');
  const threshold = xpForLevel(rankD.minLevel);
  const thresholdY = $derived(chartThresholdY(threshold, scale));
  const labelIndices = $derived(chartLabelIndices(viewDays.length));
  const linePoints = $derived(
    viewDays.map((day, index) => `${chartX(index, viewDays.length)},${chartY(day.xp, scale)}`)
  );
  const areaPoints = $derived(
    viewDays.length === 0
      ? ''
      : `${HISTORY_PADDING_LEFT},${chartY(scale.lo, scale)} ${linePoints.join(' ')} ${chartX(
          viewDays.length - 1,
          viewDays.length
        )},${chartY(scale.lo, scale)}`
  );
  const activeIndex = $derived(
    cursorIndex !== null && viewDays[cursorIndex] !== undefined
      ? cursorIndex
      : Math.max(0, viewDays.findIndex((day) => day.date === selectedDate))
  );
  const activeDay = $derived(viewDays[activeIndex]);

  /**
   * `history.html` starts with the last visible day selected (its own
   * `sel=D.length-1`), so the log row and calendar cell are highlighted before
   * any interaction. The effect re-selects the last day after a range change
   * puts the previous selection out of view.
   */
  $effect(() => {
    if (!viewDays.some((day) => day.date === selectedDate)) {
      selectedDate = viewDays[viewDays.length - 1]?.date ?? null;
    }
  });

  function eventColor(kind: HistoryEventKind): string {
    return `var(${EVENT_COLOR[kind]})`;
  }

  function eventGlyph(kind: HistoryEventKind): string {
    return EVENT_GLYPH[kind];
  }

  function selectDay(date: string): void {
    const index = viewDays.findIndex((day) => day.date === date);

    if (index < 0) return;

    cursorIndex = index;
    selectedDate = date;
    tipOn = true;
  }

  function pick(date: string): void {
    selectDay(date);

    const row = document.querySelector(`tr.d[data-date="${date}"]`);

    if (row instanceof HTMLElement) {
      row.scrollIntoView({ block: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' });
    }
  }

  function motionReduced(): boolean {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.motion === 'off'
    );
  }

  function setRange(next: HistoryRange): void {
    range = next;
    cursorIndex = null;
    tipOn = false;

    const nextView = historyView(days, next, shown);

    selectedDate = nextView[nextView.length - 1]?.date ?? null;
  }

  function showMore(): void {
    shown += 60;
    cursorIndex = null;
    tipOn = false;
  }

  function pointerMove(event: PointerEvent): void {
    const chart = event.currentTarget;

    if (!(chart instanceof SVGElement) || viewDays.length === 0) return;

    const rect = chart.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * HISTORY_WIDTH;
    const index = Math.round(
      ((x - HISTORY_PADDING_LEFT) /
        (HISTORY_WIDTH - HISTORY_PADDING_LEFT - HISTORY_PADDING_RIGHT)) *
        (viewDays.length - 1)
    );

    const day = viewDays[Math.max(0, Math.min(viewDays.length - 1, index))];

    if (day === undefined) return;

    cursorIndex = Math.max(0, Math.min(viewDays.length - 1, index));
    selectedDate = day.date;
    tipOn = true;
  }

  function pointerLeave(): void {
    tipOn = false;
  }

  function keyDown(event: KeyboardEvent): void {
    const delta =
      event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowRight'
          ? 1
          : event.key === 'Home'
            ? -99
            : event.key === 'End'
              ? 99
              : 0;

    if (delta === 0 || viewDays.length === 0) return;

    event.preventDefault();

    const base = activeIndex;
    const next = Math.max(0, Math.min(viewDays.length - 1, base + delta));
    const day = viewDays[next];

    if (day === undefined) return;

    cursorIndex = next;
    selectedDate = day.date;
    tipOn = true;
  }

  function focusChart(): void {
    const day = viewDays[activeIndex];

    if (day !== undefined) {
      cursorIndex = activeIndex;
      selectedDate = day.date;
      tipOn = true;
    }
  }

  function rowKey(event: KeyboardEvent, date: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    pick(date);
  }

  function tooltipLeft(): string {
    return `${(chartX(activeIndex, viewDays.length) / HISTORY_WIDTH) * 100}%`;
  }

  function tooltipTop(): string {
    const day = activeDay;

    return `${((day === undefined ? 0 : chartY(day.xp, scale)) / HISTORY_HEIGHT) * 100}%`;
  }
</script>

<div class="head boot" style="--i:0">
  <div><h1>History</h1><p class="sub" id="rangeTxt">{formatRangeLabel(viewDays)}</p></div>
  <div style="display:flex;gap:6px" role="group" aria-label="Time range" id="ranges">
    {#each HISTORY_RANGES as option (option)}
      <button
        class="f"
        data-r={option}
        aria-pressed={range === option}
        onclick={() => setRange(option)}>{RANGE_LABEL[option]}</button
      >
    {/each}
  </div>
</div>
<div class="sum" id="sum">
  <div class="panel boot" style="--i:1">
    <small>Lifetime XP</small>
    <b>{summary.lifetimeXP.toLocaleString('en-GB')}</b>
    <em
      ><span class={summary.delta >= 0 ? 'up' : 'dn'}
        >{summary.delta >= 0 ? '+' : ''}{summary.delta}</span
      >
      in {summary.dayCount} days</em
    >
  </div>
  <div class="panel boot" style="--i:2">
    <small>Current streak</small>
    <b>{summary.streak} days</b>
    <em>Consecutive days with a completion</em>
  </div>
  <div class="panel boot" style="--i:3">
    <small>Perfect days</small>
    <b>{summary.perfectDays} / {summary.dayCount}</b>
    <em>All stats completed</em>
  </div>
  <div class="panel boot" style="--i:4">
    <small>Most often missed</small>
    <b
      >{summary.mostMissedCount === 0 || summary.mostMissed === null
        ? '—'
        : statLabel(summary.mostMissed)}</b
    >
    <em
      >{summary.mostMissedCount === 0
        ? 'None'
        : `${summary.mostMissedCount} times in ${summary.dayCount} days`}</em
    >
  </div>
</div>
<div class="g1">
  <section class="panel boot" style="--i:3" aria-label="XP trend">
    <div class="row">
      <h2>XP trend</h2><span class="sub" id="chartHint">Hover or use the arrow keys.</span>
    </div>
    <div class="cw" id="cw">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (history.html chart is a focusable img) -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions (history.html chart cursor) -->
      <svg
        id="chart"
        viewBox={`0 0 ${HISTORY_WIDTH} ${HISTORY_HEIGHT}`}
        tabindex="0"
        role="img"
        aria-label={chartAriaLabel(viewDays)}
        onpointermove={pointerMove}
        onpointerleave={pointerLeave}
        onkeydown={keyDown}
        onfocus={focusChart}
      >
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--blue)" stop-opacity=".45" />
            <stop offset="1" stop-color="var(--blue)" stop-opacity="0" />
          </linearGradient>
        </defs>
        {#each scale.ticks as tick (tick)}
          <line
            x1={HISTORY_PADDING_LEFT}
            x2={HISTORY_WIDTH - HISTORY_PADDING_RIGHT}
            y1={chartY(tick, scale)}
            y2={chartY(tick, scale)}
            stroke="var(--blue)"
            stroke-opacity=".12"
            stroke-dasharray="2 5"
          />
          <text
            x={HISTORY_PADDING_LEFT - 8}
            y={chartY(tick, scale) + 4}
            text-anchor="end"
            fill="var(--muted)"
            font-size="12"
            font-family="JetBrains Mono">{tick}</text
          >
        {/each}
        {#if thresholdY !== null}
          <line
            x1={HISTORY_PADDING_LEFT}
            x2={HISTORY_WIDTH - HISTORY_PADDING_RIGHT}
            y1={thresholdY}
            y2={thresholdY}
            stroke="var(--monarch)"
            stroke-width="1.4"
            stroke-dasharray="6 5"
          />
          <text
            x={HISTORY_WIDTH - HISTORY_PADDING_RIGHT - 4}
            y={thresholdY - 6}
            text-anchor="end"
            fill="var(--monarch-soft)"
            font-size="12">Level {rankD.minLevel} · Rank D</text
          >
        {/if}
        {#each labelIndices as index (index)}
          <text
            x={chartX(index, viewDays.length)}
            y={HISTORY_HEIGHT - 8}
            text-anchor="middle"
            fill="var(--muted)"
            font-size="12">{formatShortDate(viewDays[index]?.date ?? '')}</text
          >
        {/each}
        <polygon class="ar" points={areaPoints} fill="url(#ag)" />
        <polyline class="ln" pathLength="1" points={linePoints.join(' ')} />
        {#each viewDays as day, index (day.date)}
          {#each day.events as event (event.id)}
            {@const cx = chartX(index, viewDays.length)}
            {@const cy = chartY(day.xp, scale)}
            {#if event.kind === 'rankUp' || event.kind === 'rankDown'}
              {@const up = event.kind === 'rankUp'}
              <g class="mk" style={`--d:${index}`}>
                <circle
                  {cx}
                  {cy}
                  r="7"
                  fill="var(--bg)"
                  stroke={eventColor(event.kind)}
                  stroke-width="2.2"
                />
                <path
                  d={`M${cx - 4} ${cy + (up ? -15 : 15)} L${cx} ${cy + (up ? -21 : 21)} L${cx + 4} ${cy + (up ? -15 : 15)}`}
                  fill="none"
                  stroke={eventColor(event.kind)}
                  stroke-width="2"
                />
              </g>
            {:else}
              <rect
                class="mk"
                style={`--d:${index}`}
                x={cx - 5}
                y={cy - 5}
                width="10"
                height="10"
                transform={`rotate(45 ${cx} ${cy})`}
                fill="var(--bg)"
                stroke={eventColor(event.kind)}
                stroke-width="2"
              />
            {/if}
          {/each}
        {/each}
        <g id="cur" style={tipOn ? '' : 'display:none'}>
          <line
            id="cl"
            x1={chartX(activeIndex, viewDays.length)}
            x2={chartX(activeIndex, viewDays.length)}
            y1={HISTORY_PADDING_TOP}
            y2={HISTORY_HEIGHT - HISTORY_PADDING_BOTTOM}
            stroke="var(--cyan)"
            stroke-opacity=".55"
            stroke-dasharray="3 4"
          />
          <circle
            id="cc"
            cx={chartX(activeIndex, viewDays.length)}
            cy={activeDay === undefined ? 0 : chartY(activeDay.xp, scale)}
            r="5"
            fill="var(--cyan)"
            style="filter:drop-shadow(0 0 8px var(--blue))"
          />
        </g>
      </svg>
      <div
        class="tip"
        class:on={tipOn}
        id="tip"
        aria-hidden="true"
        style={tipOn ? `left:${tooltipLeft()};top:${tooltipTop()}` : ''}
      >
        {#if tipOn && activeDay !== undefined}
          <b>{formatTooltipDate(activeDay.date)}</b>
          <div><span>Lifetime XP</span><span>{activeDay.xp}</span></div>
          <div>
            <span>Net points</span><span class={activeDay.netPoints >= 0 ? 'up' : 'dn'}
              >{activeDay.netPoints >= 0 ? '+' : ''}{activeDay.netPoints}</span
            >
          </div>
          <div><span>Stats completed</span><span>{activeDay.completedStats}/5</span></div>
          {#if activeDay.freezeUsed}<div><span>Freeze used</span><span></span></div>{/if}
          {#if activeDay.open}<div><span>Day still open</span><span></span></div>{/if}
          {#each activeDay.events as event (event.id)}
            <div style={`color:${eventColor(event.kind)}`}
              ><span>{eventGlyph(event.kind)} {event.title}</span><span></span></div
            >
          {/each}
        {/if}
      </div>
    </div>
    <div class="leg">
      <span><i style="background:var(--blue);border-radius:50%"></i>Rank up</span>
      <span><i style="background:var(--danger);border-radius:50%"></i>Rank down</span>
      <span><i style="background:var(--cyan);transform:rotate(45deg) scale(.8)"></i>Level up</span>
      <span
        ><i style="background:var(--monarch);transform:rotate(45deg) scale(.8)"></i>Milestone</span
      >
      <span><i style="border-top:2px dashed var(--monarch);height:0;width:16px"></i
        >Rank D threshold</span
      >
    </div>
  </section>
  <section class="panel boot" style="--i:4" aria-label="Key events">
    <h2>Key events</h2>
    <ul class="evs" id="evs">
      {#if events.length === 0}
        <li class="sub">No events in this range.</li>
      {:else}
        {#each events as event (event.id)}
          <li>
            <button
              class={`ev ${event.kind === 'rankUp' || event.kind === 'rankDown' ? 'big' : ''}`}
              style={`--ec:${eventColor(event.kind)}`}
              data-i={event.date}
              onclick={() => pick(event.date)}
            >
              <span class="g">{eventGlyph(event.kind)}</span><span
                ><b>{event.title}</b><small
                  >{formatTooltipDate(event.date)} · {event.subtitle}</small
                ></span
              >
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  </section>
</div>
<div class="g2">
  <section class="panel boot" style="--i:5" aria-label="Calendar">
    <div class="row"><h2>Calendar</h2><span class="sub">Red = many missed stats</span></div>
    <div class="cal" id="cal">
      {#each WEEKDAYS as weekday (weekday)}
        <span>{weekday}</span>
      {/each}
      {#each Array.from({ length: first === undefined ? 0 : calendarOffset(first.date) }) as _, i (i)}
        <i></i>
      {/each}
      {#each viewDays as day (day.date)}
        <button
          data-i={day.date}
          data-l={day.completedStats >= 5
            ? 3
            : day.completedStats === 4
              ? 2
              : day.completedStats === 3
                ? 1
                : 'x'}
          class:sel={selectedDate === day.date}
          aria-label={`${formatShortDate(day.date)}: ${day.completedStats} of 5 stats completed${day.freezeUsed ? ', freeze used' : ''}`}
          onclick={() => pick(day.date)}
        >
          {Number(day.date.slice(8, 10))}
        </button>
      {/each}
    </div>
  </section>
  <section class="panel boot" style="--i:6" aria-label="Daily log">
    <h2>Daily log</h2>
    <div class="lw">
      <table id="log">
        <thead>
          <tr>
            <th>Date</th><th>Str</th><th>Vit</th><th>Int</th><th>Disc</th><th>Soc</th><th
              >Net points</th
            >
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.type === 'event' ? row.event.id : `day-${row.day.date}`)}
            {#if row.type === 'event'}
              <tr class="e" style={`--ec:${eventColor(row.event.kind)}`}>
                <td colspan="6">{eventGlyph(row.event.kind)} {row.event.title}</td><td></td>
              </tr>
            {:else}
              <tr
                class="d"
                class:sel={selectedDate === row.day.date}
                tabindex="0"
                data-date={row.day.date}
                onclick={() => pick(row.day.date)}
                onkeydown={(event) => rowKey(event, row.day.date)}
              >
                <td
                  >{formatShortDate(row.day.date) + (row.day.freezeUsed ? ' ' : '')}{#if row.day.freezeUsed}<span class="frz"
                      >Freeze used</span
                    >{/if}</td
                >
                {#each row.day.stats as completed, index (index)}
                  <td>
                    {#if completed}
                      <svg viewBox="0 0 14 14"><path d="M2 7.500l3.200 3L12 3.500" /></svg>
                    {:else if row.day.open}
                      <span class="pend" aria-label="pending"></span>
                    {:else}
                      <span class="no" aria-label="missed">—</span>
                    {/if}
                  </td>
                {/each}
                <td class={`net ${row.day.netPoints >= 0 ? 'up' : 'dn'}`}
                  >{row.day.netPoints >= 0 ? '+' : ''}{row.day.netPoints}</td
                >
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    <div id="moreWrap" style="margin-top:12px">
      {#if range === 'all' && days.length > shown}
        <button class="f" id="more" onclick={showMore}>Show more</button>
      {/if}
    </div>
  </section>
</div>
