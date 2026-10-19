import { statLabel } from './today-lines';
import type { DailyQuestDay, Stat } from './types';
import { STATS } from './types';

/** The stat's copy label, as the radar axis and the stat chips write it. */
export { statLabel };

/**
 * The data behind the Today page (UI Revamp Issue 2).
 *
 * Pure: no DOM, no clock, no store. Every rule-shaped value here comes from the
 * engine's own data (`DailyQuestDay`, `StatXP`, the balance gate); this module
 * only presents it the way `docs/prototype/today.html` presents it.
 */

/** How many days the Today heat strip shows. */
export const HEAT_DAYS = 14;

/**
 * The radar's outer drawing scale (DEVIATIONS.md note 2).
 *
 * `today.html` divides every stat by `MAX = 30`. That is a drawing scale and not
 * a rule: the engine has no per-stat ceiling, and the one value the engine does
 * own on this page, the balance-gate threshold, comes from
 * `passesBalanceGate` as `ceil(sum / (2 x count))`. The value itself is taken
 * from the engine.
 */
export const RADAR_SCALE = 30;

/** The `data-l` a day with this many satisfied stats paints (see `history.html`). */
export type HeatLevel = 0 | 1 | 2 | 3 | 'x';

/** One cell of the 14-day heat strip, oldest first. */
export interface HeatCell {
  /** The day the cell stands for, `YYYY-MM-DD`. */
  readonly date: string;
  /** How many days before the open day; 0 for today. */
  readonly daysAgo: number;
  /** 5 or 4 satisfied stats is the brightest cell, fewer than 3 is the red one. */
  readonly level: HeatLevel;
  /** The `title` attribute, as `today.html` writes it. */
  readonly title: string;
}

/** The five stats of one day that have met their requirement (PRD §2.1). */
export function satisfiedStats(day: DailyQuestDay): Stat[] {
  return STATS.filter(
    (stat) =>
      day.requiredCompletions[stat] > 0 &&
      day.actualCompletions[stat] >= day.requiredCompletions[stat]
  );
}

/**
 * How many stats of a day are satisfied. A stat that is not required today does
 * not count towards the day's total, which is what keeps a five-stat day at 5
 * and a day with two required stats at 2.
 */
export function satisfiedCount(day: DailyQuestDay): number {
  return satisfiedStats(day).length;
}

/**
 * The cell brightness, the same mapping `history.html` uses: all five stats done
 * is the brightest, four is the middle, three is the dimmest lit cell, and
 * anything below three - a day with no completions at all - is the red cell.
 */
export function heatLevel(satisfied: number): HeatLevel {
  if (satisfied >= 5) return 3;
  if (satisfied === 4) return 2;
  if (satisfied === 3) return 1;

  return 'x';
}

/**
 * The `title` `today.html` puts on each cell: the last one reads "Hari ini", the
 * rest count back from it.
 */
export function heatTitle(index: number, count: number): string {
  return index === count - 1 ? 'Hari ini' : `${count - 1 - index} hari lalu`;
}

/**
 * The last `HEAT_DAYS` days up to and including the open day, oldest first, so
 * the newest cell is today. A day with fewer entries than the strip is wide
 * yields fewer cells rather than invented ones; the fixture always has fourteen.
 */
export function heatCells(days: readonly DailyQuestDay[], openDate: string): HeatCell[] {
  const end = days.findIndex((day) => day.date === openDate);
  const last = end === -1 ? days.length - 1 : end;

  return days.slice(Math.max(0, last - HEAT_DAYS + 1), last + 1).map((day, index, cells) => ({
    date: day.date,
    daysAgo: cells.length - 1 - index,
    level: heatLevel(satisfiedCount(day)),
    title: heatTitle(index, cells.length),
  }));
}

/** Whether the open day already holds a completion, which is what the streak counts (PRD §2.1). */
export function hasCompletionToday(day: DailyQuestDay | undefined): boolean {
  return day !== undefined && STATS.some((stat) => day.actualCompletions[stat] > 0);
}

/** The freezes-left copy, in the prototype's wording. */
export function freezesRemainingText(freezesLeft: number): string {
  return `Freeze ${freezesLeft} tersisa`;
}

/**
 * The system message above the quest rows.
 *
 * The three branches are the prototype's (today.html:243); which one applies is
 * the engine's: five satisfied stats is a finished quest, a cleared penalty
 * zone is every remaining penalty stat met, otherwise the daily reminder.
 */
export function systemMessage(satisfied: number, penaltyCleared: boolean): string {
  if (satisfied === STATS.length) return 'Semua stat terpenuhi. Daily quest selesai.';
  if (penaltyCleared) return 'Penalty hilang. Selesaikan stat yang tersisa.';

  return 'Selesaikan minimal 1 task di setiap stat hari ini.';
}

/* ------------------------------------------------------------------- radar */

export const RADAR_CENTER_X = 160;
export const RADAR_CENTER_Y = 160;
export const RADAR_RADIUS = 118;
/** `today.html`'s fixed `viewBox`, wide enough for the axis labels at 1.2 x MAX. */
export const RADAR_VIEW_BOX = '-60 -30 440 380';

export interface RadarPoint {
  readonly x: number;
  readonly y: number;
}

/** Axis `index` points straight up and turns clockwise, one fifth of a circle. */
export function radarAngle(index: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / STATS.length;
}

/** Where axis `index` sits at `value` on the `RADAR_SCALE` radius. */
export function radarPoint(index: number, value: number): RadarPoint {
  const radius = (RADAR_RADIUS * value) / RADAR_SCALE;

  return {
    x: RADAR_CENTER_X + Math.cos(radarAngle(index)) * radius,
    y: RADAR_CENTER_Y + Math.sin(radarAngle(index)) * radius,
  };
}

/** A polygon's `points` attribute, in the fixed stat order. */
export function radarPolygonPoints(values: readonly number[]): string {
  return values
    .map((value, index) => {
      const point = radarPoint(index, value);

      return `${point.x},${point.y}`;
    })
    .join(' ');
}

/** The four grid rings, drawn at a quarter, a half, three quarters and full scale. */
export function radarRings(): number[][] {
  return [0.25, 0.5, 0.75, 1].map((ratio) =>
    Array.from({ length: STATS.length }, () => RADAR_SCALE * ratio)
  );
}

/** The five spokes, from the centre out to the outer ring. */
export function radarSpokes(): RadarPoint[] {
  return STATS.map((_, index) => radarPoint(index, RADAR_SCALE));
}

/** The text `title` the threshold line carries, as the legend describes it. */
export function gateLabel(threshold: number): string {
  return `Ambang gate: ${threshold} XP`;
}

/* ------------------------------------------------------------------ rewards */

/** How much of a reward's cost the wallet covers, as the prototype's bar reads it. */
export function rewardProgressPercent(wallet: number, cost: number): number {
  return cost > 0 ? (wallet / cost) * 100 : 0;
}

/** The coins still missing for a reward the wallet cannot afford yet. */
export function rewardShortfall(wallet: number, cost: number): number {
  return Math.max(0, cost - wallet);
}

/** The one stat row colour token, per stat: `--stat-str`, `--stat-soc`, and so on. */
export function statColorToken(stat: Stat): string {
  return `--stat-${stat.toLowerCase()}`;
}
