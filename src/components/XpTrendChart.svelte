<script lang="ts">
  import {
    trianglePath,
    xpTrendGeometry,
    type TrendMarker,
    type TrendPoint,
  } from '../lib/xp-trend';

  interface Props {
    points: readonly TrendPoint[];
  }

  let { points }: Props = $props();

  const geometry = $derived(xpTrendGeometry(points));

  function markerFill(marker: TrendMarker): string {
    switch (marker) {
      case 'levelUp':
        return 'var(--action-ink)';
      case 'rankUp':
        return 'var(--accent)';
      case 'rankDown':
        return 'var(--danger)';
      case 'lost':
        return 'var(--danger)';
    }
  }
</script>

<svg
  role="img"
  aria-label={geometry.ariaLabel}
  viewBox={`0 0 ${geometry.width} ${geometry.height}`}
  class="mt-3 w-full"
>
  <path
    d={geometry.path}
    fill="none"
    stroke="var(--accent)"
    stroke-width="1"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  {#if geometry.singlePoint !== null}
    <circle cx={geometry.singlePoint.x} cy={geometry.singlePoint.y} r="2" fill="var(--accent)" />
  {/if}

  {#each geometry.markers as marker, index (index)}
    {#if marker.marker === 'lost'}
      <circle cx={marker.x} cy={marker.y} r="2.5" fill="var(--danger)" />
    {:else}
      <path
        d={trianglePath(marker.x, marker.y, marker.marker === 'rankDown' ? 'down' : 'up')}
        fill={markerFill(marker.marker)}
      />
    {/if}
  {/each}

  {#each geometry.labels as label, index (index)}
    <text
      x={label.x}
      y={label.y}
      text-anchor={label.anchor}
      class="font-mono"
      font-size="10"
      fill="var(--text-muted)"
    >
      {label.text}
    </text>
  {/each}
</svg>
