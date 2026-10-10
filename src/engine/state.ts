import type {
  Completion,
  DailyQuestDay,
  MilestoneEvent,
  Reward,
  RewardPurchase,
  Task,
  UserState,
} from '../lib/types';

/** The whole persisted application state (PRD §6, §7). */
export interface AppState {
  tasks: Task[];
  completions: Completion[];
  dailyQuestLog: DailyQuestDay[];
  rewards: Reward[];
  rewardPurchases: RewardPurchase[];
  userState: UserState;
  milestoneEvents: MilestoneEvent[];
}

/** The engine result shape (PRD §7): resolvable errors are values, never thrown exceptions. */
export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
