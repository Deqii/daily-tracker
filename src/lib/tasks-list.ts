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
