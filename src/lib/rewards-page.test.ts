import { describe, expect, it } from 'vitest';
import { FIXTURES } from './fixtures/data';
import {
  AVERAGE_INCOME_DAYS,
  RING_CIRCUMFERENCE,
  affordabilityHint,
  affordableCount,
  affordableLine,
  averageDailyIncome,
  averageIncomeLine,
  purchaseHistory,
  relativePurchaseLabel,
  rewardCards,
  rewardsSummary,
  sortRewardCards,
  totalSpent,
} from './rewards-page';
import type { DailyQuestDay, RewardPurchase } from './types';

function day(date: string, netPointsChange: number): DailyQuestDay {
  return {
    date,
    selectedTaskIdPerStat: {},
    requiredCompletions: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    actualCompletions: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    netPointsChange,
    freezeUsed: false,
    closed: true,
    lifetimeXPEnd: 0,
    levelEnd: null,
    rankEnd: null,
  };
}

function purchase(
  id: string,
  rewardId: string,
  cost: number,
  purchasedAt: string,
  localDate: string
): RewardPurchase {
  return {
    id,
    rewardId,
    rewardTitle: rewardId,
    costAtPurchase: cost,
    purchasedAt,
    localDate,
  };
}

const REWARDS = FIXTURES.rewards.schema.rewards;
const PURCHASES = FIXTURES.rewards.schema.rewardPurchases;

describe('averageDailyIncome', () => {
  it('averages the last 14 days, counting missing days as zero, and rounds', () => {
    const log = [day('2026-10-15', 9), day('2026-10-14', 13), day('2026-10-13', 13)];
    // 35 / 14 = 2.5 -> 3
    expect(averageDailyIncome(log, '2026-10-15')).toBe(3);
  });

  it('ignores days outside the window', () => {
    const log = [day('2026-10-01', 140), day('2026-10-15', 14)];

    expect(averageDailyIncome(log, '2026-10-15')).toBe(1);
  });

  it('yields the prototype average from the rewards fixture', () => {
    expect(averageDailyIncome(FIXTURES.rewards.schema.dailyQuestLog, '2026-10-15')).toBe(13);
    expect(AVERAGE_INCOME_DAYS).toBe(14);
  });

  it('rejects a non-positive window', () => {
    expect(() => averageDailyIncome([], '2026-10-15', 0)).toThrow(RangeError);
  });
});

describe('relativePurchaseLabel', () => {
  it('labels today, yesterday and older days', () => {
    expect(relativePurchaseLabel('2026-10-15', '2026-10-15')).toBe('Just now');
    expect(relativePurchaseLabel('2026-10-14', '2026-10-15')).toBe('Yesterday');
    expect(relativePurchaseLabel('2026-10-13', '2026-10-15')).toBe('2 days ago');
    expect(relativePurchaseLabel('2026-09-18', '2026-10-15')).toBe('27 days ago');
  });
});

describe('purchaseHistory', () => {
  it('sorts newest first and keeps the cost snapshot', () => {
    const rows = purchaseHistory(
      [
        purchase('a', 'r1', 35, '2026-10-13T19:00:00+07:00', '2026-10-13'),
        purchase('b', 'r1', 40, '2026-10-14T19:00:00+07:00', '2026-10-14'),
      ],
      '2026-10-15'
    );

    expect(rows.map((row) => row.purchase.costAtPurchase)).toEqual([40, 35]);
    expect(rows.map((row) => row.label)).toEqual(['Yesterday', '2 days ago']);
  });

  it('reads the rewards fixture as fifteen entries, newest first', () => {
    const rows = purchaseHistory(PURCHASES, '2026-10-15');

    expect(rows).toHaveLength(15);
    expect(rows[0]?.label).toBe('Yesterday');
    expect(rows[0]?.purchase.rewardTitle).toBe('Main game 2 jam');
  });
});

describe('rewards fixture values', () => {
  const average = averageDailyIncome(FIXTURES.rewards.schema.dailyQuestLog, '2026-10-15');
  const cards = rewardCards(REWARDS, PURCHASES, 65, average);

  it('summarises the catalog and affordability', () => {
    expect(rewardsSummary(cards.length, affordableCount(cards))).toBe(
      '5 items · 2 affordable now'
    );
    expect(affordableLine(affordableCount(cards), cards.length)).toBe('2 of 5');
    expect(averageIncomeLine(average)).toBe('+13 / day');
    expect(totalSpent(PURCHASES).toLocaleString('en-US')).toBe('2,370');
  });

  it('gives each locked card the prototype percentage and countdown', () => {
    const locked = cards.filter((card) => card.locked);

    expect(locked.map((card) => Math.floor(card.progress * 100))).toEqual([43, 26, 8]);
    expect(locked.map((card) => card.daysToGo)).toEqual([7, 15, 57]);
    expect(RING_CIRCUMFERENCE).toBeCloseTo(163.3628, 4);
  });

  it('sorts by affordability, cost and purchase count', () => {
    expect(sortRewardCards(cards, 65, 'afford').map((card) => card.reward.cost)).toEqual([
      35, 60, 150, 250, 800,
    ]);
    expect(sortRewardCards(cards, 65, 'cheap').map((card) => card.reward.cost)).toEqual([
      35, 60, 150, 250, 800,
    ]);
    expect(sortRewardCards(cards, 65, 'most').map((card) => card.purchaseCount)).toEqual([
      8, 4, 2, 1, 0,
    ]);
  });

  it('locks every reward and recomputes the countdown after buying the cheapest', () => {
    const after = rewardCards(REWARDS, PURCHASES, 5, average);

    expect(affordableCount(after)).toBe(0);
    expect(after.filter((card) => card.locked).map((card) => card.daysToGo)).toEqual([
      5, 3, 12, 19, 62,
    ]);
  });
});

describe('affordabilityHint', () => {
  it('describes affordable and locked costs', () => {
    expect(affordabilityHint('', 65, 13)).toBe('');
    expect(affordabilityHint('35', 65, 13)).toBe('You can buy this now.');
    expect(affordabilityHint('150', 65, 13)).toBe('About 7 days at an average of 13 coins a day.');
  });

  it('does not divide by zero income', () => {
    expect(affordabilityHint('150', 65, 0)).toBe('About 0 days at an average of 0 coins a day.');
  });
});
