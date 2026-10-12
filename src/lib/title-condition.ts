import type { TitleId } from '../engine/titles';

/**
 * The unlock-condition copy for every catalog title, shown on its locked row in Settings
 * (design §5, §7). Keyed by title id so the mapping is exhaustive at compile time.
 */
const TITLE_CONDITIONS: Record<TitleId, string> = {
  'streak-7': 'Reach a 7-day streak',
  'streak-30': 'Reach a 30-day streak',
  'first-reward': 'Buy your first reward',
  'rank-d': 'Reach Rank D',
  'rank-c': 'Reach Rank C',
  'rank-b': 'Reach Rank B',
  'rank-a': 'Reach Rank A',
  'rank-s': 'Reach Rank S',
  'completions-100': 'Complete 100 tasks',
};

/** The unlock-condition text for a title id (design §7). Pure: reads the constant map only. */
export function titleUnlockCondition(id: TitleId): string {
  return TITLE_CONDITIONS[id];
}
