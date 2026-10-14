import type { MilestoneEvent } from './types';

/** A level-up milestone: what the level-up reveal overlay shows (design §6). */
export type LevelUpEvent = Extract<MilestoneEvent, { type: 'levelUp' }>;

/**
 * The level-up events still waiting to be revealed, oldest first (design §6). `milestoneEvents`
 * are appended in the order they happen, so filtering keeps the oldest event at the front: the
 * overlay shows one at a time and marks each seen as it closes, which reveals the next. Pure: the
 * input is not mutated.
 */
export function pendingLevelUpReveals(events: readonly MilestoneEvent[]): LevelUpEvent[] {
  return events.filter((event): event is LevelUpEvent => event.type === 'levelUp' && !event.seen);
}
