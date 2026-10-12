import { describe, expect, it } from 'vitest';
import type { DailyQuestDay, MilestoneEvent, Stat } from './types';
import {
  TREND_HEIGHT,
  TREND_WIDTH,
  buildXpTrend,
  shortDateLabel,
  trianglePath,
  xpTrendAriaLabel,
  xpTrendGeometry,
  type TrendPoint,
} from './xp-trend';

const OPEN_DATE = '2026-09-27';

const zeroCounts = (): Record<Stat, number> => ({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

function day(date: string, lifetimeXPEnd: number | null, netPointsChange = 0): DailyQuestDay {
  return {
    date,
    selectedTaskIdPerStat: {},
    requiredCompletions: zeroCounts(),
    actualCompletions: zeroCounts(),
    netPointsChange,
    freezeUsed: false,
    closed: lifetimeXPEnd !== null,
    lifetimeXPEnd,
    levelEnd: null,
    rankEnd: null,
  };
}

function levelUp(date: string): MilestoneEvent {
  return { id: `l-${date}`, type: 'levelUp', localDate: date, from: 1, to: 2, seen: false };
}

function rankEvent(date: string, type: 'rankUp' | 'rankDown'): MilestoneEvent {
  return { id: `r-${date}`, type, localDate: date, from: 'E', to: 'D', seen: false };
}

/** The seven-day sample from design §5: 45, 20, 35, 34, 49, 56, 65. */
function sampleDays(): DailyQuestDay[] {
  return [
    day('2026-09-21', 45),
    day('2026-09-22', 20, -25),
    day('2026-09-23', 35),
    day('2026-09-24', 34, -1),
    day('2026-09-25', 49),
    day('2026-09-26', 56),
    day('2026-09-27', null, 9),
  ];
}

function samplePoints(): TrendPoint[] {
  return buildXpTrend(sampleDays(), [levelUp('2026-09-26')], 65, OPEN_DATE, '7d');
}

function xpSeries(points: readonly TrendPoint[]): number[] {
  return points.map((point) => point.xp);
}

describe('buildXpTrend', () => {
  it('builds the last seven days up to the open day, oldest first', () => {
    const points = samplePoints();

    expect(points.map((point) => point.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    expect(xpSeries(points)).toEqual([45, 20, 35, 34, 49, 56, 65]);
  });

  it('uses the end-of-day snapshot for closed days and the live XP for the open day', () => {
    const points = buildXpTrend(
      [day('2026-09-26', 56), day('2026-09-27', null)],
      [],
      65,
      OPEN_DATE,
      '7d'
    );

    expect(points.at(-2)?.xp).toBe(56);
    expect(points.at(-1)?.xp).toBe(65);
  });

  it('marks a day that lost points and leaves the others unmarked', () => {
    const points = samplePoints();
    const lost = points.filter((point) => point.lost).map((point) => point.date);

    expect(lost).toEqual(['2026-09-22', '2026-09-24']);
  });

  it('carries the previous value across a day with no log entry', () => {
    const points = buildXpTrend(
      [day('2026-09-25', 10), day('2026-09-27', null)],
      [],
      15,
      OPEN_DATE,
      '7d'
    );

    expect(points.map((point) => [point.date, point.xp])).toEqual([
      ['2026-09-25', 10],
      ['2026-09-26', 10],
      ['2026-09-27', 15],
    ]);
  });

  it('clamps the window so it never starts before the earliest log entry', () => {
    const points = buildXpTrend(
      [day('2026-09-25', 10), day('2026-09-27', null)],
      [],
      12,
      OPEN_DATE,
      '7d'
    );

    expect(points.map((point) => point.date)).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
  });

  it('windows thirty days for the 30d range', () => {
    const points = buildXpTrend([day('2026-08-01', 1)], [], 5, OPEN_DATE, '30d');

    expect(points).toHaveLength(30);
    expect(points[0]?.date).toBe('2026-08-29');
    expect(points.at(-1)?.date).toBe(OPEN_DATE);
  });

  it('starts at the earliest log entry for the all range', () => {
    const points = buildXpTrend(
      [day('2026-09-20', 1), day('2026-09-27', null)],
      [],
      5,
      OPEN_DATE,
      'all'
    );

    expect(points[0]?.date).toBe('2026-09-20');
    expect(points).toHaveLength(8);
  });

  it('returns the single open day when there is no log yet', () => {
    const points = buildXpTrend([], [], 0, OPEN_DATE, '7d');

    expect(points).toEqual([
      {
        date: OPEN_DATE,
        xp: 0,
        lost: false,
        levelUp: false,
        rankUp: false,
        rankDown: false,
      },
    ]);
  });

  it('maps the milestone events dated on a day onto its markers', () => {
    const points = buildXpTrend(
      sampleDays(),
      [
        levelUp('2026-09-23'),
        rankEvent('2026-09-23', 'rankUp'),
        rankEvent('2026-09-24', 'rankDown'),
      ],
      65,
      OPEN_DATE,
      '7d'
    );

    const byDate = new Map(points.map((point) => [point.date, point]));
    expect(byDate.get('2026-09-23')?.levelUp).toBe(true);
    expect(byDate.get('2026-09-23')?.rankUp).toBe(true);
    expect(byDate.get('2026-09-24')?.rankDown).toBe(true);
    expect(byDate.get('2026-09-22')?.levelUp).toBe(false);
  });
});

describe('shortDateLabel', () => {
  it('formats a local day as day and short month', () => {
    expect(shortDateLabel('2026-09-21')).toBe('21 Sep');
    expect(shortDateLabel('2026-01-03')).toBe('3 Jan');
    expect(shortDateLabel('2026-12-31')).toBe('31 Dec');
  });

  it('returns the input unchanged when it is not a local day', () => {
    expect(shortDateLabel('nope')).toBe('nope');
  });
});

describe('xpTrendAriaLabel', () => {
  it('lists every point as date and XP (design §9)', () => {
    expect(xpTrendAriaLabel(samplePoints())).toBe(
      'XP trend: 21 Sep 45 xp, 22 Sep 20 xp, 23 Sep 35 xp, 24 Sep 34 xp, 25 Sep 49 xp, ' +
        '26 Sep 56 xp, 27 Sep 65 xp'
    );
  });

  it('handles an empty series', () => {
    expect(xpTrendAriaLabel([])).toBe('XP trend: no data');
  });
});

describe('xpTrendGeometry', () => {
  it('places the points evenly across the width, oldest at the left', () => {
    const geometry = xpTrendGeometry(samplePoints());

    expect(geometry.points).toHaveLength(7);
    expect(geometry.points[0]?.x).toBeCloseTo(16, 6);
    expect(geometry.points.at(-1)?.x).toBeCloseTo(TREND_WIDTH - 16, 6);
    expect(geometry.points[3]?.x).toBeCloseTo(280, 6);
  });

  it('puts the maximum at the top and the minimum at the bottom of the plot', () => {
    const geometry = xpTrendGeometry(samplePoints());
    const byXp = new Map(geometry.points.map((point) => [point.xp, point.y]));

    expect(byXp.get(65)).toBeCloseTo(28, 6);
    expect(byXp.get(20)).toBeCloseTo(TREND_HEIGHT - 28, 6);
  });

  it('builds a polyline with one vertex per point', () => {
    const geometry = xpTrendGeometry(samplePoints());

    expect(geometry.path.startsWith('M')).toBe(true);
    expect(geometry.path.split(' L')).toHaveLength(7);
  });

  it('draws a lost marker on the losing day at its data point', () => {
    const geometry = xpTrendGeometry(samplePoints());
    const lost = geometry.markers.filter((marker) => marker.marker === 'lost');
    const day22 = geometry.points.find((point) => point.date === '2026-09-22');

    expect(lost).toHaveLength(2);
    expect(lost[0]).toEqual({ marker: 'lost', x: day22?.x, y: day22?.y });
  });

  it('draws an up marker above the point and a rank-down marker below it', () => {
    const points = buildXpTrend(
      sampleDays(),
      [levelUp('2026-09-26'), rankEvent('2026-09-25', 'rankDown')],
      65,
      OPEN_DATE,
      '7d'
    );
    const geometry = xpTrendGeometry(points);
    const day25 = geometry.points.find((point) => point.date === '2026-09-25');
    const day26 = geometry.points.find((point) => point.date === '2026-09-26');
    const up = geometry.markers.find((marker) => marker.marker === 'levelUp');
    const down = geometry.markers.find((marker) => marker.marker === 'rankDown');

    expect(up?.x).toBeCloseTo(day26?.x ?? NaN, 6);
    expect(up?.y).toBeCloseTo((day26?.y ?? 0) - 9, 6);
    expect(down?.y).toBeCloseTo((day25?.y ?? 0) + 9, 6);
  });

  it('prefers the rank-up marker over the level-up marker on the same day', () => {
    const points = buildXpTrend(
      sampleDays(),
      [levelUp('2026-09-23'), rankEvent('2026-09-23', 'rankUp')],
      65,
      OPEN_DATE,
      '7d'
    );
    const geometry = xpTrendGeometry(points);
    const ups = geometry.markers.filter(
      (marker) => marker.marker === 'levelUp' || marker.marker === 'rankUp'
    );

    expect(ups).toHaveLength(1);
    expect(ups[0]?.marker).toBe('rankUp');
  });

  it('labels at most seven days, anchored at the edges', () => {
    const seven = xpTrendGeometry(samplePoints());

    expect(seven.labels).toHaveLength(7);
    expect(seven.labels[0]?.text).toBe('21 Sep');
    expect(seven.labels[0]?.anchor).toBe('start');
    expect(seven.labels.at(-1)?.anchor).toBe('end');

    const wide = buildXpTrend([day('2026-08-01', 1)], [], 5, OPEN_DATE, '30d');
    expect(xpTrendGeometry(wide).labels).toHaveLength(7);
  });

  it('runs flat through the middle when every value is equal', () => {
    const geometry = xpTrendGeometry([
      { date: '2026-09-26', xp: 5, lost: false, levelUp: false, rankUp: false, rankDown: false },
      { date: '2026-09-27', xp: 5, lost: false, levelUp: false, rankUp: false, rankDown: false },
    ]);

    expect(geometry.points.every((point) => point.y === 28 + (TREND_HEIGHT - 56) / 2)).toBe(true);
  });

  it('centers and exposes a lone point', () => {
    const geometry = xpTrendGeometry(buildXpTrend([], [], 12, OPEN_DATE, '7d'));

    expect(geometry.singlePoint?.x).toBeCloseTo(280, 6);
    expect(geometry.labels).toHaveLength(1);
    expect(geometry.labels[0]?.anchor).toBe('middle');
    expect(geometry.ariaLabel).toBe('XP trend: 27 Sep 12 xp');
  });

  it('exposes the viewBox size', () => {
    const geometry = xpTrendGeometry([]);

    expect(geometry.width).toBe(TREND_WIDTH);
    expect(geometry.height).toBe(TREND_HEIGHT);
    expect(geometry.path).toBe('');
    expect(geometry.singlePoint).toBeNull();
  });
});

describe('trianglePath', () => {
  it('builds an upward triangle centered on the point', () => {
    expect(trianglePath(100, 50, 'up')).toBe('M96,53 L100,47 L104,53 Z');
  });

  it('builds a downward triangle centered on the point', () => {
    expect(trianglePath(100, 50, 'down')).toBe('M96,47 L100,53 L104,47 Z');
  });
});
