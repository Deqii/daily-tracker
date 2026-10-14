import { describe, expect, it } from 'vitest';
import type { MilestoneEvent, Rank } from './types';
import { pendingLevelUpReveals, pendingRankDownNotices, pendingRankUpReveals } from './reveal';

function levelUp(id: string, to: number, seen = false): MilestoneEvent {
  return { id, type: 'levelUp', localDate: '2026-10-11', from: to - 1, to, seen };
}

function rankUp(id: string, seen = false): MilestoneEvent {
  return { id, type: 'rankUp', localDate: '2026-10-11', from: 'E', to: 'D', seen };
}

function rankDown(id: string, to: Rank, seen = false): MilestoneEvent {
  return { id, type: 'rankDown', localDate: '2026-10-11', from: 'D', to, seen };
}

describe('pendingLevelUpReveals', () => {
  it('returns an empty list when there are no events', () => {
    expect(pendingLevelUpReveals([])).toEqual([]);
  });

  it('keeps only unseen level-up events, oldest first', () => {
    const first = levelUp('a', 2);
    const second = levelUp('b', 3);
    const seen = levelUp('c', 4, true);

    expect(pendingLevelUpReveals([first, seen, second])).toEqual([first, second]);
  });

  it('ignores rank events', () => {
    const level = levelUp('a', 2);
    const rank = rankUp('b');

    expect(pendingLevelUpReveals([rank, level])).toEqual([level]);
  });

  it('does not mutate the input', () => {
    const events = [levelUp('a', 2), levelUp('b', 3, true)];
    const copy = structuredClone(events);

    pendingLevelUpReveals(events);

    expect(events).toEqual(copy);
  });
});

describe('pendingRankUpReveals', () => {
  it('returns an empty list when there are no events', () => {
    expect(pendingRankUpReveals([])).toEqual([]);
  });

  it('keeps only unseen rank-up events, oldest first', () => {
    const first = rankUp('a');
    const second = rankUp('b');
    const seen = rankUp('c', true);

    expect(pendingRankUpReveals([first, seen, second])).toEqual([first, second]);
  });

  it('ignores level events', () => {
    const rank = rankUp('a');
    const level = levelUp('b', 2);

    expect(pendingRankUpReveals([level, rank])).toEqual([rank]);
  });

  it('does not mutate the input', () => {
    const events = [rankUp('a'), rankUp('b', true)];
    const copy = structuredClone(events);

    pendingRankUpReveals(events);

    expect(events).toEqual(copy);
  });
});

describe('pendingRankDownNotices', () => {
  it('returns an empty list when there are no events', () => {
    expect(pendingRankDownNotices([])).toEqual([]);
  });

  it('keeps only unseen rank-down events, oldest first', () => {
    const first = rankDown('a', 'E');
    const second = rankDown('b', 'D');
    const seen = rankDown('c', 'E', true);

    expect(pendingRankDownNotices([first, seen, second])).toEqual([first, second]);
  });

  it('ignores rank-up and level events', () => {
    const down = rankDown('a', 'E');
    const up = rankUp('b');
    const level = levelUp('c', 2);

    expect(pendingRankDownNotices([up, level, down])).toEqual([down]);
  });

  it('does not mutate the input', () => {
    const events = [rankDown('a', 'E'), rankDown('b', 'D', true)];
    const copy = structuredClone(events);

    pendingRankDownNotices(events);

    expect(events).toEqual(copy);
  });
});
