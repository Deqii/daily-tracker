export type Stat = 'STR' | 'VIT' | 'INT' | 'DISC' | 'SOC';
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type Tier = 'ringan' | 'sedang' | 'berat';

export interface TaskVariant {
  tier: Tier;
  description: string;
  points: number; // nominal, pre-multiplier
}

export interface Task {
  id: string;
  familyName: string; // e.g. "Push up routine"
  stat: Stat;
  isAnchor: boolean; // true = always in Daily Quest, never rotated
  variants: TaskVariant[]; // 1 to 3 entries
  createdAt: string; // ISO 8601
}

export interface Completion {
  id: string;
  taskId: string;
  variantTier: Tier | null;
  completedAt: string; // ISO 8601, local time
  pointsAwarded: number; // actual points after rank multiplier, rounded up
}

export interface DailyQuestDay {
  date: string; // ISO date, local day boundary
  selectedTaskIdPerStat: Partial<Record<Stat, string>>; // today's rotating pick per stat
  requiredCompletions: Record<Stat, number>; // 1 normally, 2 if penalized
  actualCompletions: Record<Stat, number>;
  netPointsChange: number; // filled in at rollover
}

export interface Reward {
  id: string;
  title: string;
  cost: number; // Wallet points
  createdAt: string;
}

export interface RewardPurchase {
  id: string;
  rewardId: string;
  purchasedAt: string;
}

export interface UserState {
  lifetimeXP: number; // drives Level/Rank; can decrease via deduction
  wallet: number; // spendable; decreases via deduction and purchases
  statXP: Record<Stat, number>; // per-stat lifetime totals; monotonic, never decreases
  currentStreak: number;
  freezeUsedThisWeek: boolean;
  lastFreezeWeekReset: string; // ISO date
  penaltyStats: Stat[]; // stats currently requiring 2x
  equippedTitle: string | null;
  unlockedTitles: string[];
  lastRolloverDate: string; // ISO date of the last day the engine evaluated
}

export const STATS: readonly Stat[] = ['STR', 'VIT', 'INT', 'DISC', 'SOC'];
export const RANKS: readonly Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
export const TIERS: readonly Tier[] = ['ringan', 'sedang', 'berat'];
