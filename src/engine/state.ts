import type { Result } from '../lib/result';
import type {
  Completion,
  DailyQuestDay,
  MilestoneEvent,
  Reward,
  RewardPurchase,
  Task,
  UserState,
} from '../lib/types';

export type { Result };

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
