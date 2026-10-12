import { statLabel } from './today-lines';
import type { Stat } from './types';
import { STATS } from './types';

/** The radar chart's fixed viewBox, in user units. It scales to the container width. */
export const RADAR_WIDTH = 280;
export const RADAR_HEIGHT = 240;

const CENTER_X = RADAR_WIDTH / 2;
const CENTER_Y = RADAR_HEIGHT / 2;
const RADAR_RADIUS = 80;
const LABEL_GAP = 18;
const GRID_RINGS = 4;

/** One stat and its value, as plotted on the radar chart. */
export interface RadarDatum {
  readonly stat: Stat;
  readonly value: number;
}

export interface RadarPoint {
  readonly x: number;
  readonly y: number;
}

/** One labeled axis: the outer vertex, the value vertex, and the label placement. */
export interface RadarAxis {
  readonly stat: Stat;
  readonly label: string;
  readonly value: number;
  readonly vertex: RadarPoint;
  readonly valuePoint: RadarPoint;
  readonly labelPoint: RadarPoint;
  readonly anchor: 'start' | 'middle' | 'end';
}

/** Everything the SVG needs, computed as plain data (design §5, §9; decisions D14). */
export interface RadarGeometry {
  readonly width: number;
  readonly height: number;
  readonly center: RadarPoint;
  readonly radius: number;
  readonly scale: number;
  readonly axes: readonly RadarAxis[];
  readonly rings: readonly (readonly RadarPoint[])[];
  readonly spokes: readonly (readonly [RadarPoint, RadarPoint])[];
  readonly shape: readonly RadarPoint[];
  readonly ariaLabel: string;
}

/** The five stat values in the fixed order STR, VIT, INT, DISC, SOC. */
export function radarValues(statXP: Readonly<Record<Stat, number>>): RadarDatum[] {
  return STATS.map((stat) => ({ stat, value: statXP[stat] }));
}

/**
 * The outer ring: the largest value rounded up to the next multiple of 10, with a minimum of 20
 * (design §5; decisions D20). `20` stays `20`, `21` becomes `30`.
 */
export function radarScale(values: readonly RadarDatum[]): number {
  let max = 0;

  for (const datum of values) {
    if (datum.value > max) {
      max = datum.value;
    }
  }

  return Math.max(20, Math.ceil(max / 10) * 10);
}

/** The `aria-label` that lists the five values (design §9). */
export function radarAriaLabel(values: readonly RadarDatum[]): string {
  const parts = values.map((datum) => `${statLabel(datum.stat)} ${datum.value}`);

  return `Stat values: ${parts.join(', ')}`;
}

function axisAngle(index: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / STATS.length;
}

function pointAt(index: number, ratio: number, radius: number): RadarPoint {
  const angle = axisAngle(index);

  return {
    x: CENTER_X + radius * ratio * Math.cos(angle),
    y: CENTER_Y + radius * ratio * Math.sin(angle),
  };
}

function labelAnchor(index: number): RadarAxis['anchor'] {
  const horizontal = Math.cos(axisAngle(index));

  if (horizontal > 0.01) {
    return 'start';
  }

  if (horizontal < -0.01) {
    return 'end';
  }

  return 'middle';
}

/**
 * Builds the radar chart geometry from the five stat values. The values are placed in the fixed
 * stat order, and every vertex ratio is clamped to `[0, 1]` so a value above the scale cannot
 * escape the outer ring. Pure: no DOM, no clock.
 */
export function radarGeometry(statXP: Readonly<Record<Stat, number>>): RadarGeometry {
  const values = radarValues(statXP);
  const scale = radarScale(values);
  const center: RadarPoint = { x: CENTER_X, y: CENTER_Y };

  const rings = Array.from({ length: GRID_RINGS }, (_, ringIndex) =>
    STATS.map((_, index) => pointAt(index, (ringIndex + 1) / GRID_RINGS, RADAR_RADIUS))
  );

  const spokes = STATS.map((_, index): [RadarPoint, RadarPoint] => [
    center,
    pointAt(index, 1, RADAR_RADIUS),
  ]);

  const axes = values.map((datum, index): RadarAxis => {
    const ratio = Math.min(Math.max(datum.value / scale, 0), 1);

    return {
      stat: datum.stat,
      label: statLabel(datum.stat),
      value: datum.value,
      vertex: pointAt(index, 1, RADAR_RADIUS),
      valuePoint: pointAt(index, ratio, RADAR_RADIUS),
      labelPoint: pointAt(index, (RADAR_RADIUS + LABEL_GAP) / RADAR_RADIUS, RADAR_RADIUS),
      anchor: labelAnchor(index),
    };
  });

  return {
    width: RADAR_WIDTH,
    height: RADAR_HEIGHT,
    center,
    radius: RADAR_RADIUS,
    scale,
    axes,
    rings,
    spokes,
    shape: axes.map((axis) => axis.valuePoint),
    ariaLabel: radarAriaLabel(values),
  };
}
