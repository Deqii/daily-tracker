import { pointsAwarded } from '../engine/points';
import { getRankConfig } from '../engine/rank';
import type { TaskFormDraft } from './task-form';
import type { DailyQuestDay, Rank, Stat, Task, Tier } from './types';
import { TIERS } from './types';

/** One stat as the Tasks page prints it: the group label, the short filter label and its colour. */
export interface TasksStatDisplay {
  readonly stat: Stat;
  readonly label: string;
  readonly short: string;
  readonly colorVar: string;
}

/** The five stat groups in the page's fixed order (tasks.html `STATS`). */
export const TASKS_STATS: readonly TasksStatDisplay[] = [
  { stat: 'STR', label: 'Strength (Str)', short: 'Str', colorVar: '--stat-str' },
  { stat: 'VIT', label: 'Vitality (Vit)', short: 'Vit', colorVar: '--stat-vit' },
  { stat: 'INT', label: 'Intellect (Int)', short: 'Int', colorVar: '--stat-int' },
  { stat: 'DISC', label: 'Discipline (Disc)', short: 'Disc', colorVar: '--stat-disc' },
  { stat: 'SOC', label: 'Social (Soc)', short: 'Soc', colorVar: '--stat-soc' },
];

/** One effort tier as the drawer prints it (tasks.html `TIERS`). */
export interface TasksTierDisplay {
  readonly tier: Tier;
  readonly name: string;
  readonly colorVar: string;
}

/** Easy, medium, hard in the prototype's order and colours. */
export const TASKS_TIERS: readonly TasksTierDisplay[] = [
  { tier: 'easy', name: 'Easy', colorVar: '--tier-r' },
  { tier: 'medium', name: 'Medium', colorVar: '--tier-s' },
  { tier: 'hard', name: 'Hard', colorVar: '--tier-b' },
];

/** The Tasks toolbar's filter state. `ALL` means no restriction on that axis. */
export interface TasksFilter {
  readonly query: string;
  readonly stat: Stat | 'ALL';
  readonly type: 'ALL' | 'Anchor' | 'Rotating';
}

/** A fresh toolbar: no search, every stat, every type. */
export function emptyTasksFilter(): TasksFilter {
  return { query: '', stat: 'ALL', type: 'ALL' };
}

/**
 * The tasks the page shows, applying the search, stat and type filters together
 * (tasks.html `render()`). Matching is case-insensitive on the task name and keeps
 * the stored order.
 */
export function filterTasks(tasks: readonly Task[], filter: TasksFilter): Task[] {
  const query = filter.query.toLowerCase();

  return tasks.filter(
    (task) =>
      (filter.stat === 'ALL' || task.stat === filter.stat) &&
      (filter.type === 'ALL' || (filter.type === 'Anchor') === task.isAnchor) &&
      task.familyName.toLowerCase().includes(query)
  );
}

/** The line under the page title: total, anchors and rotating tasks (tasks.html `render()`). */
export function tasksSummary(tasks: readonly Task[]): string {
  const anchors = tasks.filter((task) => task.isAnchor).length;

  return `${tasks.length} tasks · ${anchors} anchor · ${tasks.length - anchors} rotating`;
}

/**
 * How many effort variants are stored above the effective rank's per-task cap,
 * which is the number on the Over cap banner (tasks.html `over`, cap from the
 * engine). Rank S is uncapped, so the answer is always 0 there.
 */
export function overCapVariantCount(tasks: readonly Task[], cap: number | null): number {
  if (cap === null) return 0;

  return tasks.reduce(
    (total, task) => total + task.variants.filter((variant) => variant.points > cap).length,
    0
  );
}

/** The banner copy, with the engine's count and cap (tasks.html `render()`). */
export interface OverCapBanner {
  readonly count: number;
  readonly label: string;
  readonly detail: string;
}

export function overCapBanner(
  tasks: readonly Task[],
  cap: number | null,
  rank: Rank
): OverCapBanner | null {
  if (cap === null) return null;

  const count = overCapVariantCount(tasks, cap);

  if (count === 0) return null;

  return {
    count,
    label: `${count} variant${count > 1 ? 's' : ''} over the cap`,
    detail: `Max ${cap} points at Rank ${rank}. Over-cap variants count as ${cap}.`,
  };
}

/** The task ids the open day selected for today's quest (tasks.html `pick`). */
export function pickedTaskIds(openDay: DailyQuestDay | undefined): ReadonlySet<string> {
  if (openDay === undefined) return new Set();

  return new Set(
    Object.values(openDay.selectedTaskIdPerStat).filter((id): id is string => id !== undefined)
  );
}

/** The per-task cap for a rank, or `null` when the rank is uncapped (engine `getRankConfig`). */
export function rankCap(rank: Rank): number | null {
  return getRankConfig(rank).maxPointsPerTask;
}

/**
 * The cap line beside "Effort variants" (tasks.html: `Up to 3 tiers · Max 15 pts at
 * Rank E`). At an uncapped rank there is no maximum to print, so only the tier
 * limit is shown; see the open question in DEVIATIONS.md.
 */
export function capHint(rank: Rank): string {
  const cap = rankCap(rank);

  return cap === null ? 'Up to 3 tiers' : `Up to 3 tiers · Max ${cap} pts at Rank ${rank}`;
}

/** The XP one variant awards at a rank, after the engine's cap and multiplier. */
export function variantXp(points: number, rank: Rank): number {
  return pointsAwarded(points, rank);
}

/** One row of the add/edit drawer's draft, including whether its tier is enabled. */
export interface DrawerVariantDraft {
  readonly tier: Tier;
  enabled: boolean;
  description: string;
  points: string;
}

/** The add/edit drawer's draft (tasks.html `formStat`, `formAnchor` and `v`). */
export interface DrawerDraft {
  familyName: string;
  stat: Stat;
  isAnchor: boolean;
  variants: DrawerVariantDraft[];
}

/** The prototype's prefill points per tier for a tier that starts disabled (tasks.html `tiers()`). */
const DEFAULT_POINTS: Record<Tier, string> = { easy: '5', medium: '12', hard: '25' };

/**
 * A blank add draft: no name, Str, rotating, Easy enabled with empty description
 * and 5 points, Medium and Hard disabled with their prototype defaults. The
 * values are form affordances; the cap and the XP preview come from the engine.
 */
export function emptyDrawerDraft(): DrawerDraft {
  return {
    familyName: '',
    stat: 'STR',
    isAnchor: false,
    variants: TIERS.map((tier) => ({
      tier,
      enabled: tier === 'easy',
      description: '',
      points: DEFAULT_POINTS[tier],
    })),
  };
}

/** The draft that fills the drawer from a task, one row per tier in fixed order. */
export function taskToDrawerDraft(task: Task): DrawerDraft {
  return {
    familyName: task.familyName,
    stat: task.stat,
    isAnchor: task.isAnchor,
    variants: TIERS.map((tier) => {
      const variant = task.variants.find((entry) => entry.tier === tier);

      return {
        tier,
        enabled: variant !== undefined,
        description: variant?.description ?? '',
        points: variant === undefined ? DEFAULT_POINTS[tier] : String(variant.points),
      };
    }),
  };
}

/** Why one drawer row's points field is rejected. */
export type DrawerPointsError = 'MISSING' | 'INVALID';

/** One row's messages: description, points, and the rank cap it exceeds. */
export interface DrawerVariantErrors {
  readonly description: boolean;
  readonly points: DrawerPointsError | null;
  readonly overCap: number | null;
}

/** The drawer's messages, in the prototype's order of checks (tasks.html `save`). */
export interface DrawerErrors {
  readonly familyName: boolean;
  readonly variants: DrawerVariantErrors[];
  readonly noVariant: boolean;
  readonly valid: boolean;
}

function parsePoints(raw: string): number | null {
  const value = Number(raw);

  return Number.isInteger(value) && value >= 1 ? value : null;
}

function variantErrors(variant: DrawerVariantDraft, rank: Rank): DrawerVariantErrors {
  if (!variant.enabled) {
    return { description: false, points: null, overCap: null };
  }

  if (variant.description.trim() === '') {
    return { description: true, points: null, overCap: null };
  }

  if (variant.points === '') {
    return { description: false, points: 'MISSING', overCap: null };
  }

  const parsed = parsePoints(variant.points);

  if (parsed === null) {
    return { description: false, points: 'INVALID', overCap: null };
  }

  const cap = rankCap(rank);

  if (cap !== null && parsed > cap) {
    return { description: false, points: null, overCap: cap };
  }

  return { description: false, points: null, overCap: null };
}

/**
 * Validates the drawer draft with the prototype's exact order: name first, then
 * each enabled tier (description before points), then "at least one variant".
 * Only enabled tiers are checked; a disabled tier's inputs are ignored. The cap
 * comes from the engine for the given rank.
 */
export function validateDrawerDraft(draft: DrawerDraft, rank: Rank): DrawerErrors {
  const variants = draft.variants.map((variant) => variantErrors(variant, rank));
  const familyName = draft.familyName.trim() === '';
  const anyEnabled = draft.variants.some((variant) => variant.enabled);
  const variantProblems = variants.some(
    (entry) => entry.description || entry.points !== null || entry.overCap !== null
  );
  const noVariant = !anyEnabled && !familyName && !variantProblems;
  const valid = !familyName && anyEnabled && !variantProblems;

  return { familyName, variants, noVariant, valid };
}

/**
 * The store's task-form draft from a valid drawer draft: only enabled rows, in
 * tier order. Disabled rows become empty cards so `buildTaskVariants` keeps the
 * tier order without needing to know about `enabled`.
 */
export function drawerDraftToTaskFormDraft(draft: DrawerDraft): TaskFormDraft {
  return {
    familyName: draft.familyName,
    stat: draft.stat,
    isAnchor: draft.isAnchor,
    variants: draft.variants.map((variant) => ({
      tier: variant.tier,
      description: variant.enabled ? variant.description : '',
      points: variant.enabled ? variant.points : '',
    })),
  };
}

/** The stat label shown inside a group heading (`Strength (Str)`). */
export function statDisplay(stat: Stat): TasksStatDisplay {
  const match = TASKS_STATS.find((entry) => entry.stat === stat);

  if (match === undefined) {
    throw new RangeError(`Unknown stat: ${stat}`);
  }

  return match;
}
