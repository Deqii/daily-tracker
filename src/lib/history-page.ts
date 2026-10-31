import { level } from '../engine/level';
import type { DailyQuestDay, LocalDate, MilestoneEvent, Stat } from './types';
import { STATS } from './types';

/** The ranges the History page can show. `all` pages through the whole log. */
export type HistoryRange = 7 | 30 | 'all';

export const HISTORY_RANGES: readonly HistoryRange[] = [7, 30, 'all'];

/** The kind of marker an event gets on the chart and in the event list. */
export type HistoryEventKind = 'rankUp' | 'rankDown' | 'levelUp' | 'milestone';

export interface HistoryEvent {
  readonly id: string;
  readonly kind: HistoryEventKind;
  readonly date: LocalDate;
  readonly title: string;
  readonly subtitle: string;
}

export interface HistoryDay {
  readonly date: LocalDate;
  readonly xp: number;
  readonly netPoints: number;
  readonly stats: readonly boolean[];
  readonly completedStats: number;
  readonly freezeUsed: boolean;
  readonly open: boolean;
  readonly events: readonly HistoryEvent[];
}

export type HistoryLogRow =
  | { readonly type: 'event'; readonly event: HistoryEvent }
  | { readonly type: 'day'; readonly day: HistoryDay };

export interface HistorySummary {
  readonly lifetimeXP: number;
  readonly delta: number;
  readonly streak: number;
  readonly perfectDays: number;
  readonly dayCount: number;
  readonly mostMissed: Stat | null;
  readonly mostMissedCount: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parts(date: LocalDate): DateParts | null {
  const match = DATE_PATTERN.exec(date);

  if (match === null) return null;

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/**
 * Formats a local day with the browser's en-GB short month, exactly as the
 * prototype's `toLocaleDateString('en-GB', ...)` does. Chromium writes
 * September as `Sept`, not `Sep`, so a hardcoded month table would drift from
 * the prototype and change every label's width. The date is built in UTC and
 * formatted with `timeZone: 'UTC'` so a local timezone cannot move the day.
 */
function formatDate(date: LocalDate, options: Intl.DateTimeFormatOptions): string {
  const value = parts(date);

  if (value === null) return date;

  return new Date(Date.UTC(value.year, value.month - 1, value.day)).toLocaleDateString('en-GB', {
    ...options,
    timeZone: 'UTC',
  });
}

/** The en-GB short date used on the x axis and the log, e.g. `15 Oct`. */
export function formatShortDate(date: LocalDate): string {
  return formatDate(date, { day: 'numeric', month: 'short' });
}

/** The en-GB full date used in the range label and calendar labels, e.g. `15 Oct 2026`. */
export function formatFullDate(date: LocalDate): string {
  return formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The en-GB tooltip date, e.g. `Thu 15 Oct`. */
export function formatTooltipDate(date: LocalDate): string {
  return formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The prototype's stat label: `STR` -> `Str`, `DISC` -> `Disc`. */
export function statLabel(stat: Stat): string {
  return `${stat.charAt(0)}${stat.slice(1).toLowerCase()}`;
}

/** The Monday-first offset of the first calendar cell (Monday = 0, Sunday = 6). */
export function calendarOffset(date: LocalDate): number {
  const value = parts(date);

  if (value === null) return 0;

  return (new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay() + 6) % 7;
}

/** `9 Oct – 15 Oct 2026`, as the prototype writes the range under the heading. */
export function formatRangeLabel(view: readonly HistoryDay[]): string {
  const first = view[0];
  const last = view[view.length - 1];

  if (first === undefined || last === undefined) return '';

  return `${formatShortDate(first.date)} – ${formatFullDate(last.date)}`;
}

function eventKind(type: MilestoneEvent['type']): HistoryEventKind {
  switch (type) {
    case 'rankUp':
      return 'rankUp';
    case 'rankDown':
      return 'rankDown';
    case 'levelUp':
      return 'levelUp';
    case 'titleUnlock':
      return 'milestone';
  }
}

function eventTitle(event: MilestoneEvent): string {
  switch (event.type) {
    case 'levelUp':
      return `Level up: ${event.from} to ${event.to}`;
    case 'rankUp':
      return `Rank up: ${event.from} to ${event.to}`;
    case 'rankDown':
      return `Rank down: ${event.from} to ${event.to}`;
    case 'titleUnlock':
      return `New title: ${event.name}`;
  }
}

function eventSubtitle(event: MilestoneEvent, dayLevel: number, dayXp: number): string {
  switch (event.type) {
    case 'levelUp':
      return `${dayXp} XP`;
    case 'rankUp':
    case 'rankDown':
      return `Level ${dayLevel} · ${dayXp} XP`;
    case 'titleUnlock':
      return event.detail;
  }
}

/**
 * Replays the stored end-of-day snapshots as the History page's day series. The
 * open day uses the live Lifetime XP and carries no end snapshot; every earlier
 * day keeps its stored `lifetimeXPEnd`. Events are attached to the day they are
 * dated on, in the order the engine logged them. Pure: no clock, no DOM, and the
 * input is not mutated.
 */
export function buildHistoryDays(
  days: readonly DailyQuestDay[],
  events: readonly MilestoneEvent[],
  currentXP: number,
  openDate: LocalDate
): HistoryDay[] {
  const ordered = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map<LocalDate, MilestoneEvent[]>();

  for (const event of events) {
    const list = byDate.get(event.localDate) ?? [];
    list.push(event);
    byDate.set(event.localDate, list);
  }

  let carried = 0;

  return ordered.map((day) => {
    let xp: number;

    if (day.date === openDate) {
      xp = currentXP;
    } else if (day.lifetimeXPEnd !== null) {
      xp = day.lifetimeXPEnd;
    } else {
      xp = carried;
    }

    carried = xp;

    const stats = STATS.map((stat) => day.actualCompletions[stat] > 0);
    const dayLevel = day.levelEnd ?? level(xp);

    return {
      date: day.date,
      xp,
      netPoints: day.netPointsChange,
      stats,
      completedStats: stats.filter(Boolean).length,
      freezeUsed: day.freezeUsed,
      open: !day.closed,
      events: (byDate.get(day.date) ?? []).map((event) => ({
        id: event.id,
        kind: eventKind(event.type),
        date: event.localDate,
        title: eventTitle(event),
        subtitle: eventSubtitle(event, dayLevel, xp),
      })),
    };
  });
}

/** The last `range` days, or the last `shown` days for `all` (the prototype's paging). */
export function historyView(
  days: readonly HistoryDay[],
  range: HistoryRange,
  shown: number
): HistoryDay[] {
  return range === 'all' ? days.slice(-shown) : days.slice(-range);
}

/** The four summary cards, from the visible days and the store's display streak. */
export function historySummary(view: readonly HistoryDay[], streak: number): HistorySummary {
  const first = view[0];
  const last = view[view.length - 1];
  const lifetimeXP = last?.xp ?? 0;
  const delta = first === undefined || last === undefined ? 0 : last.xp - (first.xp - first.netPoints);
  const perfectDays = view.filter((day) => day.completedStats === 5).length;

  let mostMissed: Stat | null = null;
  let mostMissedCount = 0;

  for (const [index, stat] of STATS.entries()) {
    const count = view.filter((day) => day.stats[index] !== true).length;

    if (count > mostMissedCount) {
      mostMissed = stat;
      mostMissedCount = count;
    }
  }

  return {
    lifetimeXP,
    delta,
    streak,
    perfectDays,
    dayCount: view.length,
    mostMissed,
    mostMissedCount,
  };
}

/** The daily log, newest first, with each day's event rows above its day row. */
export function historyLogRows(view: readonly HistoryDay[]): HistoryLogRow[] {
  const rows: HistoryLogRow[] = [];

  for (const day of [...view].reverse()) {
    for (const event of day.events) {
      rows.push({ type: 'event', event });
    }

    rows.push({ type: 'day', day });
  }

  return rows;
}

/* ----------------------------------------------------------------- chart math */

export const HISTORY_WIDTH = 820;
export const HISTORY_HEIGHT = 300;
export const HISTORY_PADDING_LEFT = 46;
export const HISTORY_PADDING_RIGHT = 14;
export const HISTORY_PADDING_TOP = 22;
export const HISTORY_PADDING_BOTTOM = 30;

export interface ChartScale {
  readonly step: number;
  readonly lo: number;
  readonly hi: number;
  readonly ticks: readonly number[];
}

/** The prototype's step (at least 25 XP, four intervals) and its rounded floor. */
export function chartScale(values: readonly number[]): ChartScale {
  if (values.length === 0) return { step: 25, lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100] };

  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const step = Math.max(25, Math.ceil((mx - mn + 40) / 4 / 25) * 25);
  const lo = Math.floor((mn - 10) / step) * step;
  let hi = lo + step * 4;

  while (hi < mx + 8) hi += step;

  const ticks: number[] = [];

  for (let tick = lo; tick <= hi; tick += step) ticks.push(tick);

  return { step, lo, hi, ticks };
}

/** Horizontal position of one point in the fixed 820 x 300 viewBox. */
export function chartX(index: number, count: number): number {
  if (count <= 1) return HISTORY_PADDING_LEFT;

  return (
    HISTORY_PADDING_LEFT +
    (index * (HISTORY_WIDTH - HISTORY_PADDING_LEFT - HISTORY_PADDING_RIGHT)) / (count - 1)
  );
}

/** Vertical position of an XP value in the fixed viewBox. */
export function chartY(value: number, scale: ChartScale): number {
  return (
    HISTORY_PADDING_TOP +
    (1 - (value - scale.lo) / (scale.hi - scale.lo)) *
      (HISTORY_HEIGHT - HISTORY_PADDING_TOP - HISTORY_PADDING_BOTTOM)
  );
}

/** The y of the Rank D threshold line, or `null` when it falls outside the scale. */
export function chartThresholdY(threshold: number, scale: ChartScale): number | null {
  return threshold > scale.lo && threshold < scale.hi ? chartY(threshold, scale) : null;
}

/** The point indices that carry an x-axis label, following the prototype's stride. */
export function chartLabelIndices(count: number): number[] {
  if (count <= 0) return [];

  const every = count > 16 ? Math.ceil(count / 8) : count > 8 ? 2 : 1;
  const indices: number[] = [];

  for (let index = 0; index < count; index++) {
    if (index % every === 0 || index === count - 1) indices.push(index);
  }

  return indices;
}

/** The chart's accessible summary of the visible range. */
export function chartAriaLabel(view: readonly HistoryDay[]): string {
  const first = view[0];
  const last = view[view.length - 1];

  if (first === undefined || last === undefined) {
    return 'Lifetime XP chart, no days';
  }

  const eventCount = view.reduce((sum, day) => sum + day.events.length, 0);

  return `Lifetime XP chart, ${view.length} days: from ${first.xp - first.netPoints} to ${last.xp} XP, ${eventCount} key events`;
}
