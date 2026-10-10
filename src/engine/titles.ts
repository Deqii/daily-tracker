import type { Rank, UserState } from '../lib/types';
import { RANKS } from '../lib/types';
import type { Result } from './state';

export type TitleId =
  | 'streak-7'
  | 'streak-30'
  | 'first-reward'
  | 'rank-d'
  | 'rank-c'
  | 'rank-b'
  | 'rank-a'
  | 'rank-s'
  | 'completions-100';

export interface TitlesInput {
  readonly userState: UserState;
  readonly displayedStreak: number;
}

export interface Title {
  readonly id: TitleId;
  readonly name: string;
  readonly condition: (input: TitlesInput) => boolean;
}

/** Whether the effective rank sits at or above `target`, e.g. rank C reaches rank D (PRD §2.1). */
const atLeast = (rank: Rank, target: Rank): boolean => RANKS.indexOf(rank) >= RANKS.indexOf(target);

/** The title catalog (PRD §2.1 Titles, §7.8). Names are placeholders; ids are what is stored. */
export const TITLES: readonly Title[] = [
  {
    id: 'streak-7',
    name: 'Konsisten 7 hari',
    condition: ({ displayedStreak }) => displayedStreak >= 7,
  },
  {
    id: 'streak-30',
    name: 'Konsisten 30 hari',
    condition: ({ displayedStreak }) => displayedStreak >= 30,
  },
  {
    id: 'first-reward',
    name: 'Hadiah pertama',
    condition: ({ userState }) => userState.totalPurchases >= 1,
  },
  {
    id: 'rank-d',
    name: 'Naik ke Rank D',
    condition: ({ userState }) => atLeast(userState.rank, 'D'),
  },
  {
    id: 'rank-c',
    name: 'Naik ke Rank C',
    condition: ({ userState }) => atLeast(userState.rank, 'C'),
  },
  {
    id: 'rank-b',
    name: 'Naik ke Rank B',
    condition: ({ userState }) => atLeast(userState.rank, 'B'),
  },
  {
    id: 'rank-a',
    name: 'Naik ke Rank A',
    condition: ({ userState }) => atLeast(userState.rank, 'A'),
  },
  {
    id: 'rank-s',
    name: 'Naik ke Rank S',
    condition: ({ userState }) => atLeast(userState.rank, 'S'),
  },
  {
    id: 'completions-100',
    name: '100 tugas selesai',
    condition: ({ userState }) => userState.totalCompletions >= 100,
  },
];

/**
 * Title ids whose conditions are newly met (PRD §7.8): a catalog id appears at most once and an id
 * already in `unlockedTitles` is never returned. Appending the result to `unlockedTitles` is the
 * caller's job, which is how a rank-* title unlocks only the first time its rank is reached.
 */
export function evaluateTitles(input: TitlesInput): string[] {
  const unlocked = new Set(input.userState.unlockedTitles);

  return TITLES.filter((title) => !unlocked.has(title.id) && title.condition(input)).map(
    (title) => title.id
  );
}

/**
 * Equips a title (PRD §7.8); passing `null` unequips. Returns an error result, not an exception,
 * when the id is not unlocked.
 */
export function equipTitle(
  userState: UserState,
  id: TitleId | null
): Result<UserState, 'TITLE_NOT_UNLOCKED'> {
  if (id !== null && !userState.unlockedTitles.includes(id)) {
    return { ok: false, error: 'TITLE_NOT_UNLOCKED' };
  }

  return { ok: true, value: { ...userState, equippedTitle: id } };
}
