import type { MilestoneEvent } from './types';

/** A level-up milestone: what the level-up reveal overlay shows (design §6). */
export type LevelUpEvent = Extract<MilestoneEvent, { type: 'levelUp' }>;

/**
 * The rank-change half of a milestone event. `MilestoneEvent` keeps rank up and rank down in one
 * member whose `type` is a union, so they are narrowed by intersecting with the literal.
 */
type RankChangeEvent = Extract<MilestoneEvent, { type: 'rankUp' | 'rankDown' }>;

/** A rank-up milestone: what the rank-up reveal overlay shows (design §6). */
export type RankUpEvent = RankChangeEvent & { type: 'rankUp' };

/** A rank-down milestone: what the quiet rank-down notice shows (design §6). */
export type RankDownEvent = RankChangeEvent & { type: 'rankDown' };

/**
 * The level-up events still waiting to be revealed, oldest first (design §6). `milestoneEvents`
 * are appended in the order they happen, so filtering keeps the oldest event at the front: the
 * overlay shows one at a time and marks each seen as it closes, which reveals the next. Pure: the
 * input is not mutated.
 */
export function pendingLevelUpReveals(events: readonly MilestoneEvent[]): LevelUpEvent[] {
  return events.filter((event): event is LevelUpEvent => event.type === 'levelUp' && !event.seen);
}

/**
 * The rank-up events still waiting to be revealed, oldest first (design §6). `milestoneEvents`
 * are appended in the order they happen, so filtering keeps the oldest event at the front: the
 * overlay shows one at a time and marks each seen as it closes, which reveals the next. Pure: the
 * input is not mutated.
 */
export function pendingRankUpReveals(events: readonly MilestoneEvent[]): RankUpEvent[] {
  return events.filter((event): event is RankUpEvent => event.type === 'rankUp' && !event.seen);
}

/**
 * The rank-down events still waiting to be noticed, oldest first (design §6). A rank down gets no
 * overlay and no motion, just a notice block on Today; dismissing it marks the entry seen and the
 * next one takes its place. Pure: the input is not mutated.
 */
export function pendingRankDownNotices(events: readonly MilestoneEvent[]): RankDownEvent[] {
  return events.filter((event): event is RankDownEvent => event.type === 'rankDown' && !event.seen);
}
