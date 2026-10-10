import type { Rank, Stat, Tier } from './types';
import { RANKS, STATS, TIERS } from './types';

export type StoredKey =
  | 'schemaVersion'
  | 'tasks'
  | 'completions'
  | 'dailyQuestLog'
  | 'rewards'
  | 'rewardPurchases'
  | 'userState'
  | 'milestoneEvents'
  | 'theme';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value >= 1;
}

function isLocalDate(value: unknown): value is string {
  return isString(value) && LOCAL_DATE_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  return isString(value) && TIMESTAMP_PATTERN.test(value);
}

function isStat(value: unknown): value is Stat {
  return isString(value) && (STATS as readonly string[]).includes(value);
}

function isTier(value: unknown): value is Tier {
  return isString(value) && (TIERS as readonly string[]).includes(value);
}

function isRank(value: unknown): value is Rank {
  return isString(value) && (RANKS as readonly string[]).includes(value);
}

function isArrayOf(value: unknown, predicate: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(predicate);
}

function isStatCountRecord(value: unknown): boolean {
  return isRecord(value) && STATS.every((stat) => isNonNegativeInteger(value[stat]));
}

function isSelectedTaskIdRecord(value: unknown): boolean {
  return (
    isRecord(value) && Object.entries(value).every(([key, id]) => isStat(key) && isString(id))
  );
}

function isTaskVariant(value: unknown): boolean {
  return (
    isRecord(value) &&
    isTier(value.tier) &&
    isString(value.description) &&
    isPositiveInteger(value.points)
  );
}

function isTask(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.familyName) ||
    !isStat(value.stat) ||
    typeof value.isAnchor !== 'boolean' ||
    !isTimestamp(value.createdAt)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.variants) ||
    value.variants.length < 1 ||
    value.variants.length > 3 ||
    !value.variants.every(isTaskVariant)
  ) {
    return false;
  }

  const tiers = value.variants.map((variant) => (isRecord(variant) ? variant.tier : undefined));

  return new Set(tiers).size === tiers.length;
}

function isCompletion(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.taskId) &&
    isString(value.taskName) &&
    isStat(value.stat) &&
    (value.variantTier === null || isTier(value.variantTier)) &&
    isNonNegativeInteger(value.pointsAwarded) &&
    isTimestamp(value.completedAt) &&
    isLocalDate(value.localDate)
  );
}

function isDailyQuestDay(value: unknown): boolean {
  return (
    isRecord(value) &&
    isLocalDate(value.date) &&
    isSelectedTaskIdRecord(value.selectedTaskIdPerStat) &&
    isStatCountRecord(value.requiredCompletions) &&
    isStatCountRecord(value.actualCompletions) &&
    isFiniteNumber(value.netPointsChange) &&
    typeof value.freezeUsed === 'boolean' &&
    typeof value.closed === 'boolean' &&
    (value.lifetimeXPEnd === null || isFiniteNumber(value.lifetimeXPEnd)) &&
    (value.levelEnd === null || isFiniteNumber(value.levelEnd)) &&
    (value.rankEnd === null || isRank(value.rankEnd))
  );
}

function isReward(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isPositiveInteger(value.cost) &&
    isTimestamp(value.createdAt)
  );
}

function isRewardPurchase(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.rewardId) &&
    isString(value.rewardTitle) &&
    isNonNegativeInteger(value.costAtPurchase) &&
    isTimestamp(value.purchasedAt) &&
    isLocalDate(value.localDate)
  );
}

function isMilestoneEvent(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id) || !isLocalDate(value.localDate)) {
    return false;
  }

  if (typeof value.seen !== 'boolean') {
    return false;
  }

  switch (value.type) {
    case 'levelUp':
      return isFiniteNumber(value.from) && isFiniteNumber(value.to);
    case 'rankUp':
    case 'rankDown':
      return isRank(value.from) && isRank(value.to);
    default:
      return false;
  }
}

function isUserState(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.lifetimeXP) &&
    isNonNegativeInteger(value.wallet) &&
    isStatCountRecord(value.statXP) &&
    isRank(value.rank) &&
    isNonNegativeInteger(value.currentStreak) &&
    isNonNegativeInteger(value.freezesUsedThisWeek) &&
    isLocalDate(value.lastFreezeWeekReset) &&
    isArrayOf(value.penaltyStats, isStat) &&
    (value.equippedTitle === null || isString(value.equippedTitle)) &&
    isArrayOf(value.unlockedTitles, isString) &&
    isNonNegativeInteger(value.totalCompletions) &&
    isNonNegativeInteger(value.totalPurchases) &&
    isLocalDate(value.lastRolloverDate)
  );
}

/** Hand-written shape check for one stored value, per PRD section 6. */
export function isValidStoredValue(key: StoredKey, value: unknown): boolean {
  switch (key) {
    case 'schemaVersion':
      return isFiniteNumber(value);
    case 'tasks':
      return isArrayOf(value, isTask);
    case 'completions':
      return isArrayOf(value, isCompletion);
    case 'dailyQuestLog':
      return isArrayOf(value, isDailyQuestDay);
    case 'rewards':
      return isArrayOf(value, isReward);
    case 'rewardPurchases':
      return isArrayOf(value, isRewardPurchase);
    case 'userState':
      return isUserState(value);
    case 'milestoneEvents':
      return isArrayOf(value, isMilestoneEvent);
    case 'theme':
      return value === 'dark' || value === 'light';
  }
}
