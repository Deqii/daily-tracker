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
