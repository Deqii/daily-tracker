import { describe, expect, it } from 'vitest';
import { addDays } from './date';
import {
  HEAT_DAYS,
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_RADIUS,
  RADAR_SCALE,
  RADAR_VIEW_BOX,
  freezesRemainingText,
  gateLabel,
  hasCompletionToday,
  heatCells,
  heatLevel,
  heatTitle,
  radarAngle,
  radarPoint,
  radarPolygonPoints,
  radarRings,
  radarSpokes,
  rewardProgressPercent,
  rewardShortfall,
  satisfiedCount,
  satisfiedStats,
  statColorToken,
  systemMessage,
} from './today-page';
import type { DailyQuestDay, Stat } from './types';
import { STATS } from './types';

/**
 * The Today page's presentation layer (UI Revamp Issue 2).
 *
 * Every case here is a number the page shows: how bright a heat cell is, where a
 * radar vertex lands, which system message applies, what the teaser says. The
 * rules themselves are the engine's and are tested there; this file only pins the
 * mapping, which is what silently rots when a doc changes.
 */

const NONE = (): Record<Stat, number> => ({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

function day(
  date: string,
  satisfied: Partial<Record<Stat, number>>,
  required: Partial<Record<Stat, number>> = { STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 1 }
): DailyQuestDay {
  const actual = NONE();

  for (const stat of Object.keys(satisfied) as Stat[]) {
    actual[stat] = satisfied[stat] ?? 0;
  }

  const requiredCounts = NONE();

  for (const stat of STATS) {
    requiredCounts[stat] = required[stat] ?? 0;
  }

  return {
    date,
    selectedTaskIdPerStat: {},
    requiredCompletions: requiredCounts,
    actualCompletions: actual,
    netPointsChange: 0,
    freezeUsed: false,
    closed: true,
    lifetimeXPEnd: null,
    levelEnd: null,
    rankEnd: null,
  };
}

/** Fourteen consecutive days ending at (and including) the open day. */
function window14(endDate: string, satisfiedFor: (daysAgo: number) => number): DailyQuestDay[] {
  return Array.from({ length: HEAT_DAYS }, (_, index) => {
    const daysAgo = HEAT_DAYS - 1 - index;
    const actual = NONE();

    for (const stat of STATS.slice(0, satisfiedFor(daysAgo))) {
      actual[stat] = 1;
    }

    return day(addDays(endDate, -daysAgo), actual, {
      STR: 1,
      VIT: 1,
      INT: 1,
      DISC: 1,
      SOC: 1,
    });
  });
}

describe('heat strip', () => {
  it('maps satisfied stats to the prototype four levels', () => {
    expect(heatLevel(5)).toBe(3);
    expect(heatLevel(4)).toBe(2);
    expect(heatLevel(3)).toBe(1);
    expect(heatLevel(2)).toBe('x');
    expect(heatLevel(0)).toBe('x');
  });

  it('counts only the stats the day actually required', () => {
    const full = day('2026-10-15', { STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 1 });

    expect(satisfiedCount(full)).toBe(5);
    expect(satisfiedStats(full)).toEqual([...STATS]);

    // Two required stats, one of them needing two completions and one short.
    const penalised = day('2026-10-15', { STR: 1, SOC: 1 }, { STR: 1, SOC: 2 });

    expect(satisfiedCount(penalised)).toBe(1);

    const met = day('2026-10-15', { STR: 1, SOC: 2 }, { STR: 1, SOC: 2 });

    expect(satisfiedCount(met)).toBe(2);
  });

  it('labels the newest cell "Today" and counts the rest back from it', () => {
    expect(heatTitle(13, 14)).toBe('Today');
    expect(heatTitle(12, 14)).toBe('1 days ago');
    expect(heatTitle(0, 14)).toBe('13 days ago');
    expect(heatTitle(0, 1)).toBe('Today');
  });

  it('reads the fourteen days up to the open day, oldest first', () => {
    const days = window14('2026-10-15', () => 5);
    const cells = heatCells(days, '2026-10-15');

    expect(cells).toHaveLength(HEAT_DAYS);
    expect(cells[0]?.date).toBe('2026-10-02');
    expect(cells[HEAT_DAYS - 1]?.date).toBe('2026-10-15');
    expect(cells.map((cell) => cell.daysAgo)).toEqual(
      Array.from({ length: HEAT_DAYS }, (_, index) => HEAT_DAYS - 1 - index)
    );
    expect(cells[HEAT_DAYS - 1]?.title).toBe('Today');
    expect(cells[0]?.level).toBe(3);
  });

  it('stops at the open day when the log holds days after it', () => {
    const days = [...window14('2026-10-15', () => 5), day('2026-10-16', {})];
    const cells = heatCells(days, '2026-10-15');

    expect(cells).toHaveLength(HEAT_DAYS);
    expect(cells[HEAT_DAYS - 1]?.date).toBe('2026-10-15');
  });

  it('yields fewer cells rather than inventing days it does not have', () => {
    const cells = heatCells([day('2026-10-14', {}), day('2026-10-15', {})], '2026-10-15');

    expect(cells.map((cell) => cell.date)).toEqual(['2026-10-14', '2026-10-15']);
  });

  it('paints a day with fewer than three satisfied stats as the red cell', () => {
    const days = window14('2026-10-15', (daysAgo) => (daysAgo === 5 ? 0 : 4));
    const cells = heatCells(days, '2026-10-15');

    expect(cells.find((cell) => cell.daysAgo === 5)?.level).toBe('x');
    expect(cells.filter((cell) => cell.level === 'x')).toHaveLength(1);
  });
});

describe('the open day', () => {
  it('reports whether it holds a completion, which is what the streak counts', () => {
    expect(hasCompletionToday(day('2026-10-15', {}))).toBe(false);
    expect(hasCompletionToday(day('2026-10-15', { SOC: 2 }))).toBe(true);
    expect(hasCompletionToday(undefined)).toBe(false);
  });
});

describe('copy', () => {
  it('names the freezes left', () => {
    expect(freezesRemainingText(1)).toBe('1 freeze left this week');
    expect(freezesRemainingText(0)).toBe('No freezes left this week');
    expect(freezesRemainingText(2)).toBe('2 freezes left this week');
  });

  it('picks the system message from the engine state, not from a flag', () => {
    expect(systemMessage(5, false)).toBe('All stats completed. Daily quest done.');
    expect(systemMessage(4, true)).toBe('Penalty cleared. Finish the remaining stats.');
    expect(systemMessage(3, false)).toBe('Complete at least 1 task in every stat today.');

    // Every stat done wins over a cleared penalty zone.
    expect(systemMessage(5, true)).toBe('All stats completed. Daily quest done.');
  });
});

describe('radar geometry', () => {
  it('keeps the prototype viewBox, centre and radius', () => {
    expect(RADAR_VIEW_BOX).toBe('-60 -30 440 380');
    expect([RADAR_CENTER_X, RADAR_CENTER_Y]).toEqual([160, 160]);
    expect(RADAR_RADIUS).toBe(118);
  });

  it('starts the first axis straight up and turns clockwise', () => {
    expect(radarAngle(0)).toBeCloseTo(-Math.PI / 2, 10);
    expect(radarAngle(1)).toBeCloseTo(-Math.PI / 2 + (2 * Math.PI) / 5, 10);
  });

  it('places a value on the radius, scaled by MAX', () => {
    expect(radarPoint(0, 0)).toEqual({ x: RADAR_CENTER_X, y: RADAR_CENTER_Y });

    const top = radarPoint(0, RADAR_SCALE);

    expect(top.x).toBeCloseTo(RADAR_CENTER_X, 6);
    expect(top.y).toBeCloseTo(RADAR_CENTER_Y - RADAR_RADIUS, 6);

    const half = radarPoint(0, RADAR_SCALE / 2);

    expect(half.y).toBeCloseTo(RADAR_CENTER_Y - RADAR_RADIUS / 2, 6);
  });

  it('draws four rings at a quarter, a half, three quarters and full scale', () => {
    const rings = radarRings();

    expect(rings).toHaveLength(4);
    expect(rings[0]?.[0]).toBe(RADAR_SCALE * 0.25);
    expect(rings[3]).toEqual(Array.from({ length: STATS.length }, () => RADAR_SCALE));
  });

  it('draws five spokes on the outer ring', () => {
    const spokes = radarSpokes();

    expect(spokes).toHaveLength(STATS.length);
    spokes.forEach((spoke, index) => {
      expect(spoke.x).toBeCloseTo(radarPoint(index, RADAR_SCALE).x, 6);
      expect(spoke.y).toBeCloseTo(radarPoint(index, RADAR_SCALE).y, 6);
    });
  });

  it('joins a polygon in the fixed stat order', () => {
    const points = radarPolygonPoints([0, 0, 0, 0, RADAR_SCALE]);

    expect(points.split(' ')).toHaveLength(STATS.length);
    expect(points.endsWith(`${radarPoint(4, RADAR_SCALE).x},${radarPoint(4, RADAR_SCALE).y}`)).toBe(
      true
    );
  });

  it('labels the gate threshold', () => {
    expect(gateLabel(7)).toBe('Gate threshold: 7 XP');
    expect(gateLabel(0)).toBe('Gate threshold: 0 XP');
  });

  it('maps a stat to its own colour token', () => {
    expect(STATS.map(statColorToken)).toEqual([
      '--stat-str',
      '--stat-vit',
      '--stat-int',
      '--stat-disc',
      '--stat-soc',
    ]);
  });
});

describe('rewards teaser', () => {
  it('reads the wallet as a percentage of the price, capped by nothing', () => {
    expect(rewardProgressPercent(65, 60)).toBeCloseTo(108.33, 2);
    expect(rewardProgressPercent(0, 800)).toBe(0);
    expect(rewardProgressPercent(5, 800)).toBeCloseTo(0.625, 6);
  });

  it('never reports a negative shortfall', () => {
    expect(rewardShortfall(65, 60)).toBe(0);
    expect(rewardShortfall(5, 800)).toBe(795);
  });
});
