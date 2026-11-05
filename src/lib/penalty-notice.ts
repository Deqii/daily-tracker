import { clearPreference, readPreference, writeJsonPreference, type WriteResult } from './storage';
import type { LocalDate, Rank, Stat } from './types';

/** One missed stat on a closed day, as the engine evaluated it. */
export interface PenaltyNoticeMiss {
  readonly stat: Stat;
  readonly actual: number;
  readonly required: number;
}

/** One closed day with at least one missed stat. */
export interface PenaltyNoticeDay {
  readonly date: LocalDate;
  readonly rankAtStart: Rank;
  readonly missed: PenaltyNoticeMiss[];
  readonly nominalDeduction: number;
  readonly xpDeducted: number;
  readonly walletDeducted: number;
  readonly freezeUsed: boolean;
}

/** A rank drop described without the id of the milestone event that carries it. */
export interface PenaltyNoticeRankDown {
  readonly localDate: LocalDate;
  readonly from: Rank;
  readonly to: Rank;
}

/** The local-only summary shown once after rollover (PRD §6; D24). */
export interface PenaltyNotice {
  readonly version: 1;
  readonly forDate: LocalDate;
  readonly days: PenaltyNoticeDay[];
  readonly balancesBefore: { readonly xp: number; readonly wallet: number };
  readonly balancesAfter: { readonly xp: number; readonly wallet: number };
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly rankBefore: Rank;
  readonly rankAfter: Rank;
  readonly penaltyStats: Stat[];
  readonly rankDowns: PenaltyNoticeRankDown[];
}

export const PENALTY_NOTICE_KEY = 'daily-tracker:penaltyNotice';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLocalDate(value: unknown): value is LocalDate {
  return typeof value === 'string' && LOCAL_DATE_PATTERN.test(value);
}

function isRank(value: unknown): value is Rank {
  return (
    value === 'E' ||
    value === 'D' ||
    value === 'C' ||
    value === 'B' ||
    value === 'A' ||
    value === 'S'
  );
}

function isStat(value: unknown): value is Stat {
  return (
    value === 'STR' || value === 'VIT' || value === 'INT' || value === 'DISC' || value === 'SOC'
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isNoticeMiss(value: unknown): value is PenaltyNoticeMiss {
  return (
    isRecord(value) &&
    isStat(value.stat) &&
    isNonNegativeInteger(value.actual) &&
    isPositiveInteger(value.required)
  );
}

function isNoticeDay(value: unknown): value is PenaltyNoticeDay {
  return (
    isRecord(value) &&
    isLocalDate(value.date) &&
    isRank(value.rankAtStart) &&
    Array.isArray(value.missed) &&
    value.missed.length > 0 &&
    value.missed.every(isNoticeMiss) &&
    isNonNegativeInteger(value.nominalDeduction) &&
    isNonNegativeInteger(value.xpDeducted) &&
    isNonNegativeInteger(value.walletDeducted) &&
    typeof value.freezeUsed === 'boolean'
  );
}

function isRankDown(value: unknown): value is PenaltyNoticeRankDown {
  return isRecord(value) && isLocalDate(value.localDate) && isRank(value.from) && isRank(value.to);
}

function isBalances(value: unknown): value is { readonly xp: number; readonly wallet: number } {
  return isRecord(value) && isNonNegativeInteger(value.xp) && isNonNegativeInteger(value.wallet);
}

export function isPenaltyNotice(value: unknown): value is PenaltyNotice {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isLocalDate(value.forDate) &&
    Array.isArray(value.days) &&
    value.days.every(isNoticeDay) &&
    isBalances(value.balancesBefore) &&
    isBalances(value.balancesAfter) &&
    isPositiveInteger(value.levelBefore) &&
    isPositiveInteger(value.levelAfter) &&
    isRank(value.rankBefore) &&
    isRank(value.rankAfter) &&
    Array.isArray(value.penaltyStats) &&
    value.penaltyStats.every(isStat) &&
    Array.isArray(value.rankDowns) &&
    value.rankDowns.every(isRankDown)
  );
}

export function readPenaltyNotice(): PenaltyNotice | null {
  const raw = readPreference(PENALTY_NOTICE_KEY);

  if (raw === null) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPenaltyNotice();
    return null;
  }

  if (!isPenaltyNotice(parsed)) {
    clearPenaltyNotice();
    return null;
  }

  return parsed;
}

export function writePenaltyNotice(notice: PenaltyNotice): WriteResult {
  return writeJsonPreference(PENALTY_NOTICE_KEY, notice);
}

export function clearPenaltyNotice(): WriteResult {
  return clearPreference(PENALTY_NOTICE_KEY);
}

export function mergePenaltyNotices(
  existing: PenaltyNotice | null,
  incoming: PenaltyNotice | null
): PenaltyNotice | null {
  if (existing === null) {
    return incoming;
  }

  if (incoming === null) {
    return existing;
  }

  const existingDates = new Set(existing.days.map((day) => day.date));

  if (incoming.days.every((day) => existingDates.has(day.date))) {
    return existing;
  }

  const daysByDate = new Map<LocalDate, PenaltyNoticeDay>();

  for (const day of existing.days) {
    daysByDate.set(day.date, day);
  }

  for (const day of incoming.days) {
    if (!daysByDate.has(day.date)) {
      daysByDate.set(day.date, day);
    }
  }

  const rankDownsByKey = new Map<string, PenaltyNoticeRankDown>();

  for (const rankDown of [...existing.rankDowns, ...incoming.rankDowns]) {
    const key = `${rankDown.localDate}:${rankDown.from}:${rankDown.to}`;
    rankDownsByKey.set(key, rankDown);
  }

  return {
    ...existing,
    forDate: incoming.forDate,
    days: [...daysByDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
    balancesAfter: incoming.balancesAfter,
    levelAfter: incoming.levelAfter,
    rankAfter: incoming.rankAfter,
    penaltyStats: [...incoming.penaltyStats],
    rankDowns: [...rankDownsByKey.values()].sort((left, right) =>
      left.localDate.localeCompare(right.localDate)
    ),
  };
}
