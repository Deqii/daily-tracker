import type { Reward } from './types';

/** The Add/Edit reward form's draft; `cost` stays raw user input (design §5). */
export interface RewardFormDraft {
  title: string;
  cost: string;
}

/** Which messages the Add/Edit reward form shows (design §7); `valid` is false while any is set. */
export interface RewardFormErrors {
  readonly title: boolean;
  readonly cost: boolean;
  readonly valid: boolean;
}

/** A blank draft: no name and an empty cost. */
export function emptyRewardFormDraft(): RewardFormDraft {
  return { title: '', cost: '' };
}

/** The draft that fills the form from a reward being edited. */
export function rewardToFormDraft(reward: Reward): RewardFormDraft {
  return { title: reward.title, cost: String(reward.cost) };
}

function parseCost(raw: string): number | null {
  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const value = Number(trimmed);

  return Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Validates a form draft and reports which messages to show (design §7, PRD §2.1 Rewards). A reward
 * needs a title and a whole cost of 1 or more. `valid` is true exactly when both are met.
 */
export function validateRewardForm(draft: RewardFormDraft): RewardFormErrors {
  const title = draft.title.trim() === '';
  const cost = parseCost(draft.cost) === null;

  return { title, cost, valid: !title && !cost };
}

/**
 * The reward's title and cost from a valid draft, with the title trimmed and the cost parsed.
 * Callers validate first (design §5, PRD §2.1 Rewards).
 */
export function buildRewardFromDraft(draft: RewardFormDraft): Pick<Reward, 'title' | 'cost'> {
  return { title: draft.title.trim(), cost: Number(draft.cost.trim()) };
}
