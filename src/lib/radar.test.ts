import { describe, expect, it } from 'vitest';
import {
  RADAR_HEIGHT,
  RADAR_WIDTH,
  radarAriaLabel,
  radarGeometry,
  radarScale,
  radarValues,
  type RadarDatum,
} from './radar';
import { STATS } from './types';

const SAMPLE = { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 };
const EMPTY = { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 };

function datum(stat: RadarDatum['stat'], value: number): RadarDatum {
  return { stat, value };
}

describe('radarValues', () => {
  it('returns the five stats in the fixed order with their values', () => {
    expect(radarValues(SAMPLE)).toEqual([
      { stat: 'STR', value: 16 },
      { stat: 'VIT', value: 12 },
      { stat: 'INT', value: 20 },
      { stat: 'DISC', value: 10 },
      { stat: 'SOC', value: 7 },
    ]);
  });
});

describe('radarScale', () => {
  it('rounds the largest value up to the next multiple of 10', () => {
    expect(radarScale([datum('STR', 16), datum('INT', 21)])).toBe(30);
    expect(radarScale([datum('STR', 25)])).toBe(30);
    expect(radarScale([datum('STR', 31)])).toBe(40);
  });

  it('keeps a value that is already a multiple of 10', () => {
    expect(radarScale([datum('STR', 20)])).toBe(20);
    expect(radarScale([datum('STR', 30)])).toBe(30);
  });

  it('uses a minimum of 20, including for zero and empty input', () => {
    expect(radarScale([])).toBe(20);
    expect(radarScale([datum('STR', 0), datum('VIT', 7)])).toBe(20);
    expect(radarScale([datum('STR', 10)])).toBe(20);
  });
});

describe('radarAriaLabel', () => {
  it('lists the five stat values in order (design §9)', () => {
    expect(radarAriaLabel(radarValues(SAMPLE))).toBe(
      'Stat values: Str 16, Vit 12, Int 20, Disc 10, Soc 7'
    );
  });
});

describe('radarGeometry', () => {
  it('builds one axis per stat, in order, with copy labels', () => {
    const geometry = radarGeometry(SAMPLE);

    expect(geometry.axes.map((axis) => axis.stat)).toEqual([...STATS]);
    expect(geometry.axes.map((axis) => axis.label)).toEqual(['Str', 'Vit', 'Int', 'Disc', 'Soc']);
    expect(geometry.axes.map((axis) => axis.value)).toEqual([16, 12, 20, 10, 7]);
  });

  it('places the first axis at the top and anchors labels by side', () => {
    const geometry = radarGeometry(SAMPLE);

    expect(geometry.center).toEqual({ x: RADAR_WIDTH / 2, y: RADAR_HEIGHT / 2 });
    expect(geometry.axes[0]?.vertex.x).toBeCloseTo(RADAR_WIDTH / 2, 6);
    expect(geometry.axes[0]?.vertex.y).toBeCloseTo(RADAR_HEIGHT / 2 - 80, 6);
    expect(geometry.axes.map((axis) => axis.anchor)).toEqual([
      'middle',
      'start',
      'start',
      'end',
      'end',
    ]);
  });

  it('scales the sample and puts value vertices at their ratio of the outer ring', () => {
    const geometry = radarGeometry(SAMPLE);

    expect(geometry.scale).toBe(20);
    expect(geometry.axes[0]?.valuePoint.y).toBeCloseTo(RADAR_HEIGHT / 2 - 80 * (16 / 20), 6);
    expect(geometry.axes[2]?.valuePoint.x).toBeCloseTo(geometry.axes[2]?.vertex.x ?? NaN, 6);
    expect(geometry.axes[2]?.valuePoint.y).toBeCloseTo(geometry.axes[2]?.vertex.y ?? NaN, 6);
  });

  it('clamps a negative value to the center', () => {
    const geometry = radarGeometry({ ...SAMPLE, INT: -5 });

    expect(geometry.axes[2]?.valuePoint).toEqual(geometry.center);
  });

  it('renders the ring grid, the spokes and the value shape', () => {
    const geometry = radarGeometry(SAMPLE);

    expect(geometry.rings).toHaveLength(4);
    expect(geometry.rings.every((ring) => ring.length === STATS.length)).toBe(true);
    expect(geometry.spokes).toHaveLength(STATS.length);
    expect(geometry.spokes[0]?.[0]).toEqual(geometry.center);
    expect(geometry.spokes[0]?.[1]).toEqual(geometry.axes[0]?.vertex);
    expect(geometry.shape).toHaveLength(STATS.length);
    expect(geometry.shape[0]).toEqual(geometry.axes[0]?.valuePoint);
  });

  it('exposes the viewBox size and the accessible label', () => {
    const geometry = radarGeometry(SAMPLE);

    expect(geometry.width).toBe(RADAR_WIDTH);
    expect(geometry.height).toBe(RADAR_HEIGHT);
    expect(geometry.ariaLabel).toBe(radarAriaLabel(radarValues(SAMPLE)));
  });

  it('uses the minimum scale when all values are zero', () => {
    const geometry = radarGeometry(EMPTY);

    expect(geometry.scale).toBe(20);
    expect(
      geometry.shape.every(
        (point) => point.x === geometry.center.x && point.y === geometry.center.y
      )
    ).toBe(true);
  });
});
