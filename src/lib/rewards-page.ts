import { addDays, daysBetween } from './date';
import { buildRewardList } from './rewards-list';
import type { DailyQuestDay, LocalDate, Reward, RewardPurchase } from './types';

/** The window the Rewards page averages daily income over (Issue 4). */
export const AVERAGE_INCOME_DAYS = 14;

/** The prototype's ring geometry: two circles of radius 26 in a 62x62 viewBox. */
export const RING_CIRCUMFERENCE = 2 * Math.PI * 26;

export type RewardsSort = 'afford' | 'cheap' | 'most';

/** One Rewards card: a reward, its purchase count, and the values its locked state prints. */
export interface RewardCard {
  readonly reward: Reward;
  readonly purchaseCount: number;
  readonly locked: boolean;
  /** Filled fraction of the progress ring, 0..1 (1 when affordable). */
  readonly progress: number;
  /** `ceil((cost - wallet) / averageIncome)`, 0 when affordable or income is 0. */
  readonly daysToGo: number;
}

/** One row of the purchase history panel, newest first. */
export interface PurchaseHistoryRow {
  readonly purchase: RewardPurchase;
  readonly label: string;
}

/**
 * Average points earned per day over the last `days` calendar days, ending on
 * `today` inclusive and rounded to a whole number (design §5, Issue 4). The
 * PRD defines no income rule, so this is a presentation value: it sums each
 * day's `netPointsChange` in the window and divides by the window length.
 * Days with no record count as zero. Pure: it only reads its inputs.
 */
export function averageDailyIncome(
  dailyQuestLog: readonly DailyQuestDay[],
  today: LocalDate,
  days = AVERAGE_INCOME_DAYS
): number {
  if (!Number.isInteger(days) || days <= 0) {
    throw new RangeError(`Days must be a positive integer, received ${days}`);
  }

  const first = addDays(today, -(days - 1));
  const byDate = new Map(dailyQuestLog.map((day) => [day.date, day.netPointsChange]));

  let total = 0;

  for (let index = 0; index < days; index++) {
    total += byDate.get(addDays(first, index)) ?? 0;
  }

  return Math.round(total / days);
}

/** `Yesterday`, `N days ago`, or `Just now` for a purchase on the current local day. */
export function relativePurchaseLabel(purchasedOn: LocalDate, today: LocalDate): string {
  const days = daysBetween(purchasedOn, today);

  if (days <= 0) return 'Just now';
  if (days === 1) return 'Yesterday';

  return `${days} days ago`;
}

/** History rows, newest first, with the label derived from the purchase day and `today`. */
export function purchaseHistory(
  purchases: readonly RewardPurchase[],
  today: LocalDate
): PurchaseHistoryRow[] {
  return [...purchases]
    .sort((a, b) =>
      a.purchasedAt === b.purchasedAt
        ? 0
        : a.purchasedAt < b.purchasedAt
          ? 1
          : -1
    )
    .map((purchase) => ({
      purchase,
      label: relativePurchaseLabel(purchase.localDate, today),
    }));
}

/** `5 items · 2 affordable now`, the line under the page title. */
export function rewardsSummary(count: number, affordable: number): string {
  return `${count} items · ${affordable} affordable now`;
}

/** `2 of 5`, the wallet panel's affordability line. */
export function affordableLine(affordable: number, count: number): string {
  return `${affordable} of ${count}`;
}

/** `2,370`, the sum of every logged purchase's cost snapshot. */
export function totalSpent(purchases: readonly RewardPurchase[]): number {
  return purchases.reduce((sum, purchase) => sum + purchase.costAtPurchase, 0);
}

/** `+13 / day`, the wallet panel's average-income line. */
export function averageIncomeLine(average: number): string {
  return `+${average} / day`;
}

/** Cards for every reward, with ring and countdown values for the current wallet. */
export function rewardCards(
  rewards: readonly Reward[],
  purchases: readonly RewardPurchase[],
  wallet: number,
  average: number
): RewardCard[] {
  return buildRewardList(rewards, purchases, wallet).map((row) => {
    const progress = row.locked ? Math.min(1, wallet / row.reward.cost) : 1;
    const missing = row.reward.cost - wallet;
    const daysToGo =
      row.locked && average > 0 ? Math.max(0, Math.ceil(missing / average)) : 0;

    return { ...row, progress, daysToGo };
  });
}

/**
 * The three toolbar orders (Issue 4). `afford` keeps affordable rewards first,
 * then sorts by cost, exactly as `rewards.html`'s comparator does; `cheap` sorts
 * by cost and `most` by purchase count. Ties keep the incoming order. Pure.
 */
export function sortRewardCards(
  cards: readonly RewardCard[],
  wallet: number,
  sort: RewardsSort
): RewardCard[] {
  const copy = [...cards];

  switch (sort) {
    case 'afford':
      return copy.sort(
        (a, b) =>
          Number(wallet >= b.reward.cost) - Number(wallet >= a.reward.cost) ||
          a.reward.cost - b.reward.cost
      );
    case 'cheap':
      return copy.sort((a, b) => a.reward.cost - b.reward.cost);
    case 'most':
      return copy.sort((a, b) => b.purchaseCount - a.purchaseCount);
  }
}

/** How many rewards the wallet covers. */
export function affordableCount(cards: readonly RewardCard[]): number {
  return cards.filter((card) => !card.locked).length;
}

/** The drawer's cost helper; empty while the cost is not a positive number. */
export function affordabilityHint(cost: string, wallet: number, average: number): string {
  const value = Number(cost.trim());

  if (!Number.isFinite(value) || value <= 0) return '';
  if (value <= wallet) return 'You can buy this now.';

  const days = average > 0 ? Math.ceil((value - wallet) / average) : 0;

  return `About ${days} days at an average of ${average} coins a day.`;
}
