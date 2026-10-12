import { STATS, type Stat, type Task } from './types';

/** Section labels for the five stats as written on the Tasks page (design §5). */
const STAT_SECTION_LABELS: Record<Stat, string> = {
  STR: 'Strength (Str)',
  VIT: 'Vitality (Vit)',
  INT: 'Intellect (Int)',
  DISC: 'Discipline (Disc)',
  SOC: 'Social (Soc)',
};

/** The section label for a stat: `STR` renders as `Strength (Str)`, and so on (design §5). */
export function statSectionLabel(stat: Stat): string {
  return STAT_SECTION_LABELS[stat];
}

/** One Tasks page section: a stat and its task families, in list order (design §5). */
export interface TaskStatGroup {
  readonly stat: Stat;
  readonly tasks: readonly Task[];
}

/**
 * Groups the task library by stat for the Tasks page (design §5). Returns all five stats in the
 * STR, VIT, INT, DISC, SOC order, each with its tasks in their stored order, so a stat with no tasks
 * still gets its section. Pure: it only reads the tasks and never mutates them.
 */
export function groupTasksByStat(tasks: readonly Task[]): TaskStatGroup[] {
  return STATS.map((stat) => ({ stat, tasks: tasks.filter((task) => task.stat === stat) }));
}

/** The tag shown on a task row: `Anchor` for an anchor task, `Rotating` otherwise (design §5). */
export function taskTag(task: Task): 'Anchor' | 'Rotating' {
  return task.isAnchor ? 'Anchor' : 'Rotating';
}

/**
 * Whether a task renders as a family (a heading row with indented effort-variant sub-rows) rather
 * than a single row. Exactly one variant is single-tier (PRD §2.1, design §5).
 */
export function hasEffortVariants(task: Task): boolean {
  return task.variants.length > 1;
}

/** The points shown for one effort variant on a family sub-row, before the multiplier (design §5). */
export function variantPointsLabel(points: number): string {
  return `${points} pts`;
}

/**
 * The over-cap marker for one effort variant, or `null` when it is within the rank's per-task cap
 * (design §7). A stored value above the cap is kept but counts as the cap when awarded (PRD §2.1,
 * decisions D11). Rank S is uncapped, so `maxPointsPerTask` is `null` and nothing is over cap.
 */
export function overCapLabel(points: number, maxPointsPerTask: number | null): string | null {
  if (maxPointsPerTask === null || points <= maxPointsPerTask) {
    return null;
  }

  return `Over cap: counts as ${maxPointsPerTask}`;
}

/**
 * A task's points shown on its row, before the rank multiplier (design §5). A single-tier task
 * shows one value; a family shows its lowest to highest variant.
 */
export function taskPointsLabel(task: Task): string {
  const points = task.variants.map((variant) => variant.points);
  const min = Math.min(...points);
  const max = Math.max(...points);

  return min === max ? `${min} pts` : `${min} to ${max} pts`;
}

/** The count shown next to the Tasks page title, in task families (design §5). */
export function taskCountLabel(count: number): string {
  return `${count} tasks`;
}
