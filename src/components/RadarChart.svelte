<script lang="ts">
  import { radarGeometry, type RadarPoint } from '../lib/radar';
  import { app } from '../stores/app';

  const statXP = app.statXP;
  const geometry = $derived(radarGeometry($statXP));

  function polygonPoints(polygon: readonly RadarPoint[]): string {
    return polygon.map((point) => `${point.x},${point.y}`).join(' ');
  }
</script>

<svg
  role="img"
  aria-label={geometry.ariaLabel}
  viewBox={`0 0 ${geometry.width} ${geometry.height}`}
  class="mt-4 w-full"
  style="min-width: 240px"
>
  <g fill="none" stroke="var(--surface)" stroke-width="1">
    {#each geometry.rings as ring, index (index)}
      <polygon points={polygonPoints(ring)} />
    {/each}
    {#each geometry.spokes as spoke, index (index)}
      <line x1={spoke[0].x} y1={spoke[0].y} x2={spoke[1].x} y2={spoke[1].y} />
    {/each}
  </g>

  <polygon
    points={polygonPoints(geometry.shape)}
    fill="var(--accent)"
    fill-opacity="0.2"
    stroke="var(--accent)"
    stroke-width="1"
  />

  {#each geometry.axes as axis (axis.stat)}
    <text
      x={axis.labelPoint.x}
      y={axis.labelPoint.y}
      text-anchor={axis.anchor}
      dominant-baseline="middle"
      class="font-sans"
      font-size="12"
      fill="var(--text-muted)"
    >
      {axis.label}<tspan class="font-mono" dx="4" fill="var(--text)">{axis.value}</tspan>
    </text>
  {/each}
</svg>
