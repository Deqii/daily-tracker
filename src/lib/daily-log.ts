import { addDays } from './date';
import type { DailyQuestDay, LocalDate, MilestoneEvent, Stat } from './types';
import { STATS } from './types';
import { shortDateLabel, type TrendRange } from './xp-trend';

/** The per-day per-stat state behind the log icons (design §5): completed, missed, or still pending. */
export type StatStatus = 'completed' | 'missed' | 'pending';

/** One day row of the log: the date, the five stat states in the fixed order, and the day's net points. */
export interface DayLogRow {
  readonly date: LocalDate;
  readonly dateLabel: string;
  readonly freezeUsed: boolean;
  readonly statuses: readonly StatStatus[];
  readonly netPoints: number;
}

/** A highlighted milestone line between day rows (design §5). */
export interface MilestoneLogRow {
  readonly type: MilestoneEvent['type'];
  readonly text: string;
}

/** One line of the day-by-day log, newest day first. */
export type LogRow = DayLogRow | MilestoneLogRow;

const RANGE_DAYS: Record<Exclude<TrendRange, 'all'>, number> = { '7d': 7, '30d': 30 };

/** The first day a range shows, clamped so it never starts before the log does (design §5). */
function rangeStart(range: TrendRange, earliest: LocalDate | null, openDate: LocalDate): LocalDate {
  if (range === 'all' || earliest === null) {
    return earliest ?? openDate;
  }

  const windowStart = addDays(openDate, -(RANGE_DAYS[range] - 1));

  return windowStart < earliest ? earliest : windowStart;
}

/**
 * The state of one stat on one day (design §5). A required stat that was met shows a check; a
 * closed day where a required stat fell short shows a dash; everything else (a stat that was not
 * required, or an open day that has not finished) shows an empty circle as still pending.
 */
export function statStatus(day: DailyQuestDay, stat: Stat): StatStatus {
  if (day.requiredCompletions[stat] <= 0) {
    return 'pending';
  }

  if (day.actualCompletions[stat] >= day.requiredCompletions[stat]) {
    return 'completed';
  }

  return day.closed ? 'missed' : 'pending';
}

/** The highlighted text of a milestone event (design §5). */
export function milestoneText(event: MilestoneEvent): string {
  switch (event.type) {
    case 'levelUp':
      return `Level up: ${event.from} to ${event.to}`;
    case 'rankUp':
      return `Rank up: ${event.from} to ${event.to}`;
    case 'rankDown':
      return `Rank down: ${event.from} to ${event.to}`;
  }
}

/** The net points of a day row as copy: `+9` gains, `-25` losses, `0` flat (design §5). */
export function netPointsLabel(net: number): string {
  return net > 0 ? `+${net}` : String(net);
}

/**
 * Builds the day-by-day log for one range, newest day first (design §5). The range is the same as
 * the XP trend's: the last 7 or 30 days, or every day from the earliest log entry for `all`. Each
 * shown day renders its milestone lines (a level up reads `Level up: 2 to 3`, a rank down
 * `Rank down: D to E`) directly above its row of per-stat states, freeze marker, and net points.
 * The open day carries its live `netPointsChange`; closed days carry the stored one. Pure: no
 * clock, no DOM, and the inputs are not mutated.
 */
export function buildDailyLog(
  days: readonly DailyQuestDay[],
  events: readonly MilestoneEvent[],
  openDate: LocalDate,
  range: TrendRange
): LogRow[] {
  const byDate = new Map<LocalDate, DailyQuestDay>();
  let earliest: LocalDate | null = null;

  for (const day of days) {
    byDate.set(day.date, day);

    if (earliest === null || day.date < earliest) {
      earliest = day.date;
    }
  }

  const start = rangeStart(range, earliest, openDate);
  const eventsByDate = new Map<LocalDate, MilestoneEvent[]>();

  for (const event of events) {
    if (event.localDate < start || event.localDate > openDate) {
      continue;
    }

    const list = eventsByDate.get(event.localDate) ?? [];
    list.push(event);
    eventsByDate.set(event.localDate, list);
  }

  const rows: LogRow[] = [];

  for (let date = openDate; date >= start; date = addDays(date, -1)) {
    for (const event of eventsByDate.get(date) ?? []) {
      rows.push({ type: event.type, text: milestoneText(event) });
    }

    const day = byDate.get(date);

    if (day !== undefined) {
      rows.push({
        date,
        dateLabel: shortDateLabel(date),
        freezeUsed: day.freezeUsed,
        statuses: STATS.map((stat) => statStatus(day, stat)),
        netPoints: day.netPointsChange,
      });
    }
  }

  return rows;
}

/** True for a day row, false for a highlighted milestone line. */
export function isDayRow(row: LogRow): row is DayLogRow {
  return 'statuses' in row;
}

/** The number of day rows in a log. */
export function logDayCount(rows: readonly LogRow[]): number {
  return rows.filter(isDayRow).length;
}

/**
 * The prefix of `rows` that belongs to the first `shownDays` day rows, newest first (design §5):
 * milestone lines keep their place directly above the day they happened on. `shownDays` of
 * `Infinity` keeps every row.
 */
export function visibleLogRows(rows: readonly LogRow[], shownDays: number): LogRow[] {
  let seen = 0;
  let boundary = rows.length;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];

    if (row !== undefined && isDayRow(row)) {
      seen++;

      if (seen > shownDays) {
        boundary = index;
        break;
      }
    }
  }

  return rows.slice(0, boundary);
}
