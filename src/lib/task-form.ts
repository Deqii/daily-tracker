import { TIERS, type Stat, type Task, type TaskVariant, type Tier } from './types';

/** One effort-variant card in the Add/Edit task form; `points` stays raw user input (design §5). */
export interface TaskVariantDraft {
  tier: Tier;
  description: string;
  points: string;
}

/** The Add/Edit task form's draft, always carrying one card per tier in Ringan, Sedang, Berat order. */
export interface TaskFormDraft {
  familyName: string;
  stat: Stat;
  isAnchor: boolean;
  variants: TaskVariantDraft[];
}

/** Why a card's Points field is rejected; `MISSING` is empty, `INVALID` is not a whole number ≥ 1. */
export type VariantPointsError = 'MISSING' | 'INVALID';

/** The per-card piece of `TaskFormErrors` (design §7). */
export interface VariantDraftErrors {
  readonly description: boolean;
  readonly points: VariantPointsError | null;
}

/** Which messages the Add/Edit task form shows (design §7); `valid` is false while any is set. */
export interface TaskFormErrors {
  readonly familyName: boolean;
  readonly variants: VariantDraftErrors[];
  readonly noVariant: boolean;
  readonly valid: boolean;
}

function emptyVariant(tier: Tier): TaskVariantDraft {
  return { tier, description: '', points: '' };
}

/** A blank draft: no name, Stat Str (the design's default), Rotating, and three empty cards. */
export function emptyTaskFormDraft(): TaskFormDraft {
  return {
    familyName: '',
    stat: 'STR',
    isAnchor: false,
    variants: TIERS.map(emptyVariant),
  };
}

/** The draft that fills the form from a task being edited, one card per tier in fixed order. */
export function taskToFormDraft(task: Task): TaskFormDraft {
  const variants = TIERS.map((tier) => {
    const variant = task.variants.find((entry) => entry.tier === tier);

    if (variant === undefined) {
      return emptyVariant(tier);
    }

    return { tier, description: variant.description, points: String(variant.points) };
  });

  return { familyName: task.familyName, stat: task.stat, isAnchor: task.isAnchor, variants };
}

/** Whether a card has any input; a card with both fields empty is ignored (design §5). */
export function isVariantDraftFilled(variant: TaskVariantDraft): boolean {
  return variant.description.trim() !== '' || variant.points.trim() !== '';
}

function parsePoints(raw: string): number | null {
  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const value = Number(trimmed);

  return Number.isInteger(value) && value >= 1 ? value : null;
}

function variantErrors(variant: TaskVariantDraft): VariantDraftErrors {
  if (!isVariantDraftFilled(variant)) {
    return { description: false, points: null };
  }

  const description = variant.description.trim() === '';
  const points: VariantPointsError | null =
    variant.points.trim() === ''
      ? 'MISSING'
      : parsePoints(variant.points) === null
        ? 'INVALID'
        : null;

  return { description, points };
}

/**
 * Validates a form draft and reports which messages to show (design §7, PRD §2.1). A card is only
 * checked once it has input; a fully empty card is ignored. `valid` is true exactly when the name
 * is set, at least one card is filled, and every filled card is complete with whole points ≥ 1.
 */
export function validateTaskForm(draft: TaskFormDraft): TaskFormErrors {
  const variants = draft.variants.map(variantErrors);
  const noVariant = !draft.variants.some(isVariantDraftFilled);
  const familyName = draft.familyName.trim() === '';
  const valid =
    !familyName &&
    !noVariant &&
    variants.every((entry) => !entry.description && entry.points === null);

  return { familyName, variants, noVariant, valid };
}

/**
 * The task's effort variants from a valid draft: only the filled cards, in Ringan, Sedang, Berat
 * order, with trimmed descriptions and parsed integers. Callers validate first (design §5, PRD §2.1).
 */
export function buildTaskVariants(draft: TaskFormDraft): TaskVariant[] {
  return draft.variants.filter(isVariantDraftFilled).map((variant) => ({
    tier: variant.tier,
    description: variant.description.trim(),
    points: Number(variant.points.trim()),
  }));
}
