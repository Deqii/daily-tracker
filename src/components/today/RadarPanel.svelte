<script lang="ts">
  import {
    RADAR_CENTER_X,
    RADAR_CENTER_Y,
    RADAR_SCALE,
    RADAR_VIEW_BOX,
    gateLabel,
    radarPoint,
    radarPolygonPoints,
    radarRings,
    radarSpokes,
    statColorToken,
    statLabel,
  } from '../../lib/today-page';
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
   */

  const statXP = app.statXP;
  const rankGate = app.rankGate;

  const RING_OPACITY = ['0.14', '0.14', '0.14', '0.35'];
  const LABEL_SCALE = 1.2;

  /**
   * The resolved colour of a stat token, read from the document root exactly as
   * `today.html` does with `getComputedStyle`. Reading the token rather than a
   * literal is what makes the light theme's own palette reach the SVG.
   */
  function resolvedToken(token: string): string {
    if (typeof document === 'undefined') return '';

    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }

  let values = $derived(STATS.map((stat) => $statXP[stat]));
  let gate = $derived($rankGate.threshold);

  /** Each axis with the value on it, so no index lookup happens in the markup. */
  let axes = $derived(STATS.map((stat, index) => ({ stat, index, value: values[index] ?? 0 })));
</script>

<section class="panel radar-wrap boot" style="--i:1" aria-label="Stat">
  <div class="row" style="width:100%">
    <h2>Stat</h2>
    <span class="sub">{gateLabel($rankGate.threshold)}</span>
  </div>
  <svg id="radar" viewBox={RADAR_VIEW_BOX} role="img" aria-label="Radar lima stat">
    {#each radarRings() as ring, index (index)}
      <polygon
        points={radarPolygonPoints(ring)}
        fill="none"
        stroke="var(--blue)"
        stroke-opacity={RING_OPACITY[index]}
      />
    {/each}
    {#each radarSpokes() as spoke, index (index)}
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
      points={radarPolygonPoints(STATS.map(() => gate))}
      fill="rgba(139,108,255,.06)"
      stroke="var(--monarch)"
      stroke-width="1.5"
      stroke-dasharray="5 4"
    />
    <polygon
      points={radarPolygonPoints(values)}
      fill="rgba(61,169,255,.22)"
      stroke="var(--cyan)"
      stroke-width="2"
      style="filter:drop-shadow(0 0 8px var(--blue))"
    />
    {#each axes as axis (axis.stat)}
      {@const point = radarPoint(axis.index, axis.value)}
      {@const label = radarPoint(axis.index, RADAR_SCALE * LABEL_SCALE)}
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
  <div class="legend"><span><s></s>Batas balance gate (50% rata-rata)</span></div>
  <div class="stats">
    {#each STATS as stat (stat)}
      <div class="stat" style={`--c: var(${statColorToken(stat)})`}>
        <small>{statLabel(stat)}</small>
        <b>{$statXP[stat as Stat]}</b>
        <div class="bar">
          <i style={`width: ${Math.min(100, ($statXP[stat] / RADAR_SCALE) * 100)}%`}></i>
        </div>
      </div>
    {/each}
  </div>
</section>
