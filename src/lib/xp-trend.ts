import { addDays, eachDay } from './date';
import type { DailyQuestDay, LocalDate, MilestoneEvent } from './types';

/** The range the History chart (and table) can show (design §5). */
export type TrendRange = '7d' | '30d' | 'all';

/** A marker drawn on one day of the XP trend (design §5). */
export type TrendMarker = 'lost' | 'levelUp' | 'rankUp' | 'rankDown';

/** One day of the XP trend: its total XP and the milestone markers it carries. */
export interface TrendPoint {
  readonly date: LocalDate;
  readonly xp: number;
  readonly lost: boolean;
  readonly levelUp: boolean;
  readonly rankUp: boolean;
  readonly rankDown: boolean;
}

/** The chart's fixed viewBox, in user units. It scales to the container width. */
export const TREND_WIDTH = 560;
export const TREND_HEIGHT = 200;

const PADDING_TOP = 28;
const PADDING_RIGHT = 16;
const PADDING_BOTTOM = 28;
const PADDING_LEFT = 16;
const MAX_LABELS = 7;
const MARKER_OFFSET = 9;

const INNER_WIDTH = TREND_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const INNER_HEIGHT = TREND_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const RANGE_DAYS: Record<Exclude<TrendRange, 'all'>, number> = { '7d': 7, '30d': 30 };

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface TrendPointGeometry {
  readonly date: LocalDate;
  readonly xp: number;
  readonly x: number;
  readonly y: number;
}

export interface TrendMarkerGeometry {
  readonly marker: TrendMarker;
  readonly x: number;
  readonly y: number;
}

export interface TrendLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

/** Everything the SVG needs, computed as plain data (design §5, §9; decisions D14). */
export interface XpTrendGeometry {
  readonly width: number;
  readonly height: number;
  readonly path: string;
  readonly points: readonly TrendPointGeometry[];
  readonly markers: readonly TrendMarkerGeometry[];
  readonly labels: readonly TrendLabel[];
  readonly singlePoint: TrendPointGeometry | null;
  readonly ariaLabel: string;
}

/** The first day a range shows, clamped so it never starts before the log does (design §5). */
function rangeStart(range: TrendRange, earliest: LocalDate | null, openDate: LocalDate): LocalDate {
  if (range === 'all' || earliest === null) {
    return earliest ?? openDate;
  }

  const windowStart = addDays(openDate, -(RANGE_DAYS[range] - 1));

  return windowStart < earliest ? earliest : windowStart;
}

function eventsByDate(
  events: readonly MilestoneEvent[]
): Map<LocalDate, Set<MilestoneEvent['type']>> {
  const byDate = new Map<LocalDate, Set<MilestoneEvent['type']>>();

  for (const event of events) {
    const types = byDate.get(event.localDate) ?? new Set<MilestoneEvent['type']>();
    types.add(event.type);
    byDate.set(event.localDate, types);
  }

  return byDate;
}

/**
 * Builds the XP trend series for one range, oldest day first (design §5). It runs over every day
 * from the range's start to the open day inclusive. A closed day holds its end-of-day XP snapshot;
 * the open day holds the live `currentXP`; a day without an entry carries the previous value. A day
 * is `lost` when its net points change is negative, and carries the level-up/rank-change markers
 * from the milestone events dated on it. Pure: no clock, no DOM, and the inputs are not mutated.
 */
export function buildXpTrend(
  days: readonly DailyQuestDay[],
  events: readonly MilestoneEvent[],
  currentXP: number,
  openDate: LocalDate,
  range: TrendRange
): TrendPoint[] {
  const byDate = new Map<LocalDate, DailyQuestDay>();
  let earliest: LocalDate | null = null;

  for (const day of days) {
    byDate.set(day.date, day);

    if (earliest === null || day.date < earliest) {
      earliest = day.date;
    }
  }

  const start = rangeStart(range, earliest, openDate);
  const dates = eachDay(start, addDays(openDate, 1));
  const eventTypes = eventsByDate(events);
  const points: TrendPoint[] = [];
  let carried = 0;

  for (const date of dates) {
    const day = byDate.get(date);
    let xp: number;

    if (date === openDate) {
      xp = currentXP;
    } else if (day !== undefined && day.lifetimeXPEnd !== null) {
      xp = day.lifetimeXPEnd;
    } else {
      xp = carried;
    }

    carried = xp;

    const types = eventTypes.get(date);

    points.push({
      date,
      xp,
      lost: day !== undefined && day.netPointsChange < 0,
      levelUp: types?.has('levelUp') ?? false,
      rankUp: types?.has('rankUp') ?? false,
      rankDown: types?.has('rankDown') ?? false,
    });
  }

  return points;
}

/** A day as the x-axis copy `21 Sep` (design §5). */
export function shortDateLabel(date: LocalDate): string {
  const match = LOCAL_DATE_PATTERN.exec(date);

  if (match === null) {
    return date;
  }

  const month = Number(match[2]);
  const day = Number(match[3]);

  return `${day} ${MONTHS[month - 1] ?? ''}`.trim();
}

/** The `aria-label` that lists every point (design §9). */
export function xpTrendAriaLabel(points: readonly TrendPoint[]): string {
  if (points.length === 0) {
    return 'XP trend: no data';
  }

  const parts = points.map((point) => `${shortDateLabel(point.date)} ${point.xp} xp`);

  return `XP trend: ${parts.join(', ')}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The `d` of a small up/down triangle marker centered at `x, y` (design §5). */
export function trianglePath(x: number, y: number, direction: 'up' | 'down'): string {
  const halfWidth = 4;
  const halfHeight = 3;
  const tip = direction === 'up' ? y - halfHeight : y + halfHeight;
  const base = direction === 'up' ? y + halfHeight : y - halfHeight;

  return `M${round(x - halfWidth)},${round(base)} L${round(x)},${round(tip)} L${round(
    x + halfWidth
  )},${round(base)} Z`;
}

function labelIndices(count: number): number[] {
  if (count <= MAX_LABELS) {
    return Array.from({ length: count }, (_, index) => index);
  }

  const step = (count - 1) / (MAX_LABELS - 1);
  const indices = new Set<number>();

  for (let tick = 0; tick < MAX_LABELS; tick++) {
    indices.add(Math.round(tick * step));
  }

  return [...indices].sort((a, b) => a - b);
}

/**
 * Builds the thin line geometry from the trend points: the polyline, the marker positions, the x
 * labels, and the accessible label (design §5, §9). The line scales to the data range; when every
 * value is equal it runs flat through the middle. A rank up takes the one upward marker for its
 * day, ahead of a level up, so the two never overlap. Pure: no DOM, no clock.
 */
export function xpTrendGeometry(points: readonly TrendPoint[]): XpTrendGeometry {
  const count = points.length;
  const values = points.map((point) => point.xp);
  const lo = count > 0 ? Math.min(...values) : 0;
  const hi = count > 0 ? Math.max(...values) : 0;

  const placed: TrendPointGeometry[] = points.map((point, index) => {
    const x =
      count <= 1
        ? PADDING_LEFT + INNER_WIDTH / 2
        : PADDING_LEFT + (index / (count - 1)) * INNER_WIDTH;
    const y =
      hi === lo
        ? PADDING_TOP + INNER_HEIGHT / 2
        : PADDING_TOP + (1 - (point.xp - lo) / (hi - lo)) * INNER_HEIGHT;

    return { date: point.date, xp: point.xp, x, y };
  });

  const path = placed
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)},${round(point.y)}`)
    .join(' ');

  const markers: TrendMarkerGeometry[] = [];

  for (let index = 0; index < count; index++) {
    const point = points[index];
    const position = placed[index];

    if (point === undefined || position === undefined) {
      continue;
    }

    if (point.lost) {
      markers.push({ marker: 'lost', x: position.x, y: position.y });
    }

    if (point.rankUp) {
      markers.push({ marker: 'rankUp', x: position.x, y: position.y - MARKER_OFFSET });
    } else if (point.levelUp) {
      markers.push({ marker: 'levelUp', x: position.x, y: position.y - MARKER_OFFSET });
    }

    if (point.rankDown) {
      markers.push({ marker: 'rankDown', x: position.x, y: position.y + MARKER_OFFSET });
    }
  }

  const labels: TrendLabel[] = labelIndices(count).map((index) => {
    const point = placed[index];
    const anchor: TrendLabel['anchor'] =
      count <= 1 ? 'middle' : index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle';

    return {
      text: shortDateLabel(point?.date ?? ''),
      x: point?.x ?? PADDING_LEFT,
      y: TREND_HEIGHT - 8,
      anchor,
    };
  });

  return {
    width: TREND_WIDTH,
    height: TREND_HEIGHT,
    path,
    points: placed,
    markers,
    labels,
    singlePoint: count === 1 ? (placed[0] ?? null) : null,
    ariaLabel: xpTrendAriaLabel(points),
  };
}
