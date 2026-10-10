export type Stat = 'STR' | 'VIT' | 'INT' | 'DISC' | 'SOC';
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type Tier = 'ringan' | 'sedang' | 'berat';
export type LocalDate = string; // 'YYYY-MM-DD', device-local day
export type Timestamp = string; // ISO 8601 with UTC offset

export interface TaskVariant {
  tier: Tier;
  description: string;
  points: number; // nominal, pre-multiplier, integer >= 1
}

export interface Task {
  id: string; // short random id (8 chars)
  familyName: string; // e.g. "Push up routine"
  stat: Stat;
  isAnchor: boolean; // true = always in Daily Quest, never rotated
  variants: TaskVariant[]; // 1 to 3 entries, tiers unique; exactly 1 = single-tier
  createdAt: Timestamp;
}

export interface Completion {
  id: string;
  taskId: string;
  taskName: string; // snapshot of familyName
  stat: Stat; // snapshot
  variantTier: Tier | null; // null for single-tier tasks
  pointsAwarded: number; // after cap and multiplier, rounded up
  completedAt: Timestamp;
  localDate: LocalDate;
}

export interface DailyQuestDay {
  date: LocalDate;
  selectedTaskIdPerStat: Partial<Record<Stat, string>>; // the rotating pick per quest-active stat
  requiredCompletions: Record<Stat, number>; // 0 = not required that day, 1 normal, 2 penalized
  actualCompletions: Record<Stat, number>;
  netPointsChange: number; // Lifetime XP delta for the day (earned - deducted); live while open, final when closed
  freezeUsed: boolean;
  closed: boolean; // false while the day is open
  lifetimeXPEnd: number | null; // snapshots, filled when the day is closed
  levelEnd: number | null;
  rankEnd: Rank | null;
}

export interface Reward {
  id: string;
  title: string;
  cost: number; // Wallet points, integer >= 1
  createdAt: Timestamp;
}

export interface RewardPurchase {
  id: string;
  rewardId: string;
  rewardTitle: string; // snapshot
  costAtPurchase: number; // snapshot
  purchasedAt: Timestamp;
  localDate: LocalDate;
}

export interface UserState {
  lifetimeXP: number; // >= 0; drives Level and Rank; decreases only via penalty
  wallet: number; // >= 0; decreases via penalty and purchases
  statXP: Record<Stat, number>; // per-stat totals; monotonic, never decreases
  rank: Rank; // effective rank; can lag the level rank when the gate blocks
  currentStreak: number; // closed days only
  freezesUsedThisWeek: number;
  lastFreezeWeekReset: LocalDate; // Monday of the current freeze week
  penaltyStats: Stat[]; // stats currently requiring 2 completions
  equippedTitle: string | null; // title id
  unlockedTitles: string[]; // title ids
  totalCompletions: number;
  totalPurchases: number;
  lastRolloverDate: LocalDate; // the open day; every earlier day is closed
}

export type MilestoneEvent =
  | { id: string; type: 'levelUp'; localDate: LocalDate; from: number; to: number; seen: boolean }
  | {
      id: string;
      type: 'rankUp' | 'rankDown';
      localDate: LocalDate;
      from: Rank;
      to: Rank;
      seen: boolean;
    };

export const STATS: readonly Stat[] = ['STR', 'VIT', 'INT', 'DISC', 'SOC'];
export const RANKS: readonly Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
export const TIERS: readonly Tier[] = ['ringan', 'sedang', 'berat'];
