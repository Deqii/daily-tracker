<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import {
    RADAR_CENTER_X,
    RADAR_CENTER_Y,
    RADAR_VIEW_BOX,
    gateLabel,
    radarPoint,
    radarPolygonPoints,
    radarRings,
    radarSpokes,
    statColorToken,
    statLabel,
    statScale,
  } from '../../lib/today-page';
  import { resolvedToken } from '../../lib/tokens';
  import { tween } from '../../lib/tween';
  import { app } from '../../stores/app';
  import { STATS, type Stat } from '../../lib/types';

  /**
   * The stat panel (UI Revamp Issue 2): the five-axis radar with the balance-gate
   * polygon, and the five stat chips below it.
   *
   * The prototype builds this SVG by assigning `innerHTML` from a template
   * string; the app builds the same elements, in the same order, from the same
   * geometry helpers. The threshold is the engine's
   * `ceil(sum / (2 x count))`, not a literal.
   *
   * The radar morph is the prototype's UI mechanic (line 249): on load the shape
   * grows from zero over 1100 ms after a 500 ms beat, and on a completion it
   * tweens to the new values over 600 ms. Under reduced motion both jump to the
   * end state, which is what the visual tests capture.
   */

  const statXP = app.statXP;
  const rankGate = app.rankGate;

  /** The four grid rings, brightest on the outside, as `today.html` draws them. */
  const RING_OPACITY = ['0.14', '0.14', '0.14', '0.35'];
  /** Axis labels sit at 1.2 x the outer radius. */
  const LABEL_SCALE = 1.2;
  /** The entrance morph: a beat, then 1100 ms (line 291). */
  const ENTRANCE_DELAY_MS = 500;
  const ENTRANCE_MS = 1100;
  /** A completion morph (line 249). */
  const MORPH_MS = 600;

  type StatValues = Record<Stat, number>;

  const zero: StatValues = { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 };

  /** The values currently drawn, which lag the engine's while a morph runs. */
  let display = $state<StatValues>({ ...zero });

  /** The entrance morph owns the first paint; later changes morph from it. */
  let entered = $state(false);
  let entranceTimer: ReturnType<typeof setTimeout> | null = null;

  function morphTo(target: StatValues, ms: number): void {
    const from = { ...untrack(() => display) };

    tween((progress) => {
      display = {
        STR: from.STR + (target.STR - from.STR) * progress,
        VIT: from.VIT + (target.VIT - from.VIT) * progress,
        INT: from.INT + (target.INT - from.INT) * progress,
        DISC: from.DISC + (target.DISC - from.DISC) * progress,
        SOC: from.SOC + (target.SOC - from.SOC) * progress,
      };
    }, ms);
  }

  $effect(() => {
    const target: StatValues = {
      STR: $statXP.STR,
      VIT: $statXP.VIT,
      INT: $statXP.INT,
      DISC: $statXP.DISC,
      SOC: $statXP.SOC,
    };

    if (!entered) return;

    morphTo(target, MORPH_MS);
  });

  entranceTimer = setTimeout(() => {
    entered = true;
    morphTo(
      {
        STR: $statXP.STR,
        VIT: $statXP.VIT,
        INT: $statXP.INT,
        DISC: $statXP.DISC,
        SOC: $statXP.SOC,
      },
      ENTRANCE_MS
    );
  }, ENTRANCE_DELAY_MS);

  onDestroy(() => {
    if (entranceTimer !== null) clearTimeout(entranceTimer);
  });

  let values = $derived(STATS.map((stat) => display[stat]));
  let gate = $derived($rankGate.threshold);

  /**
   * The drawing scale the prototype recomputes in `drawRadar`/`stats`: the
   * largest engine stat rounded up to the next ten, minimum twenty. Read from
   * the engine values, not from the tweened ones, exactly as `today.html` reads
   * `S.stat`.
   */
  let scale = $derived(statScale(STATS.map((stat) => $statXP[stat])));

  /**
   * The radar's own `aria-label`, as `today.html`'s `stats()` writes it: the five
   * labels with their engine values, so the chart stays readable to a screen
   * reader and updates whenever a value changes.
   */
  let radarLabel = $derived(
    `Radar chart: ${STATS.map((stat) => `${statLabel(stat)} ${$statXP[stat]}`).join(', ')}`
  );

  /** Each axis with the value drawn on it, so no index lookup happens in the markup. */
  let axes = $derived(STATS.map((stat, index) => ({ stat, index, value: values[index] ?? 0 })));
</script>

<section class="panel radar-wrap boot" style="--i:1" aria-label="Stat">
  <div class="row" style="width:100%">
    <h2>Stat</h2>
    <span class="sub">{gateLabel($rankGate.threshold)}</span>
  </div>
  <svg id="radar" viewBox={RADAR_VIEW_BOX} role="img" aria-label={radarLabel}>
    {#each radarRings(scale) as ring, index (index)}
      <polygon
        points={radarPolygonPoints(ring, scale)}
        fill="none"
        stroke="var(--blue)"
        stroke-opacity={RING_OPACITY[index]}
      />
    {/each}
    {#each radarSpokes(scale) as spoke, index (index)}
      <line
        x1={RADAR_CENTER_X}
        y1={RADAR_CENTER_Y}
        x2={spoke.x}
        y2={spoke.y}
        stroke="var(--blue)"
        stroke-opacity=".14"
      />
    {/each}
    <polygon
      points={radarPolygonPoints(
        STATS.map(() => gate),
        scale
      )}
      fill="rgba(139,108,255,.06)"
      stroke="var(--monarch)"
      stroke-width="1.5"
      stroke-dasharray="5 4"
    />
    <polygon
      points={radarPolygonPoints(values, scale)}
      fill="rgba(61,169,255,.22)"
      stroke="var(--cyan)"
      stroke-width="2"
      style="filter:drop-shadow(0 0 8px var(--blue))"
    />
    {#each axes as axis (axis.stat)}
      {@const point = radarPoint(axis.index, axis.value, scale)}
      {@const label = radarPoint(axis.index, scale * LABEL_SCALE, scale)}
      <circle cx={point.x} cy={point.y} r="4" fill={resolvedToken(statColorToken(axis.stat))} />
      <text
        x={label.x}
        y={label.y}
        text-anchor="middle"
        dominant-baseline="middle"
        fill="var(--text)"
        font-family="Chakra Petch"
        font-weight="600"
        font-size="15"
        >{statLabel(axis.stat)}
        <tspan fill={resolvedToken(statColorToken(axis.stat))}>{Math.round(axis.value)}</tspan
        ></text
      >
    {/each}
  </svg>
  <div class="legend"><span><s></s>Balance gate limit (50% of average)</span></div>
  <div class="stats">
    {#each STATS as stat (stat)}
      <div class="stat" style={`--c: var(${statColorToken(stat)})`}>
        <small>{statLabel(stat)}</small>
        <b>{$statXP[stat]}</b>
        <div class="bar">
          <i style={`width: ${Math.min(100, ($statXP[stat] / scale) * 100)}%`}></i>
        </div>
      </div>
    {/each}
  </div>
</section>
