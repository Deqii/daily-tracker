import { describe, expect, it } from 'vitest';
import {
  freezesLine,
  penaltyNotificationLine,
  questCounterLabel,
  questPointsLabel,
  questRowState,
  rankUpBlockedLine,
  statLabel,
  type LineSegment,
} from './today-lines';
import { STATS, type Stat } from './types';

function text(segments: LineSegment[]): string {
  return segments.map((segment) => segment.text).join('');
}

describe('freezesLine', () => {
  it('uses the plural copy when more than one freeze is left', () => {
    expect(freezesLine(2)).toBe('2 freezes left this week');
    expect(freezesLine(3)).toBe('3 freezes left this week');
  });

  it('uses the singular copy when exactly one freeze is left', () => {
    expect(freezesLine(1)).toBe('1 freeze left this week');
  });

  it('uses the empty copy when no freeze is left', () => {
    expect(freezesLine(0)).toBe('No freezes left this week');
    expect(freezesLine(-1)).toBe('No freezes left this week');
  });
});

describe('statLabel', () => {
  it('maps every stat code to its copy label', () => {
    expect(STATS.map((stat: Stat) => statLabel(stat))).toEqual([
      'Str',
      'Vit',
      'Int',
      'Disc',
      'Soc',
    ]);
  });
});

describe('rankUpBlockedLine', () => {
  function blockedFor(stat: Stat): LineSegment[] {
    return rankUpBlockedLine(stat, 45, 7);
  }

  it('builds the exact copy for each stat', () => {
    expect(text(blockedFor('STR'))).toBe('Rank-up blocked: raise Str to 45 xp (now 7)');
    expect(text(blockedFor('VIT'))).toBe('Rank-up blocked: raise Vit to 45 xp (now 7)');
    expect(text(blockedFor('INT'))).toBe('Rank-up blocked: raise Int to 45 xp (now 7)');
    expect(text(blockedFor('DISC'))).toBe('Rank-up blocked: raise Disc to 45 xp (now 7)');
    expect(text(blockedFor('SOC'))).toBe('Rank-up blocked: raise Soc to 45 xp (now 7)');
  });

  it('marks only the two numbers as monospace', () => {
    const segments = blockedFor('SOC');

    expect(segments.filter((segment) => segment.mono).map((segment) => segment.text)).toEqual([
      '45',
      '7',
    ]);
    expect(segments.filter((segment) => !segment.mono).map((segment) => segment.text)).toEqual([
      'Rank-up blocked: raise Soc to ',
      ' xp (now ',
      ')',
    ]);
  });
});

describe('penaltyNotificationLine', () => {
  function notificationFor(stat: Stat): LineSegment[] {
    return penaltyNotificationLine(stat);
  }

  it('builds the exact copy for each stat', () => {
    expect(text(notificationFor('STR'))).toBe('Penalty active: Str needs 2 completions today.');
    expect(text(notificationFor('VIT'))).toBe('Penalty active: Vit needs 2 completions today.');
    expect(text(notificationFor('INT'))).toBe('Penalty active: Int needs 2 completions today.');
    expect(text(notificationFor('DISC'))).toBe('Penalty active: Disc needs 2 completions today.');
    expect(text(notificationFor('SOC'))).toBe('Penalty active: Soc needs 2 completions today.');
  });

  it('marks only the required count as monospace', () => {
    const segments = notificationFor('SOC');

    expect(segments.filter((segment) => segment.mono).map((segment) => segment.text)).toEqual([
      '2',
    ]);
    expect(segments.filter((segment) => !segment.mono).map((segment) => segment.text)).toEqual([
      'Penalty active: Soc needs ',
      ' completions today.',
    ]);
  });
});

describe('questRowState', () => {
  it('is done once the stat has met its requirement', () => {
    expect(questRowState(1, 1)).toBe('done');
    expect(questRowState(2, 2)).toBe('done');
    expect(questRowState(3, 2)).toBe('done');
  });

  it('is penalty while a penalized stat is unmet', () => {
    expect(questRowState(0, 2)).toBe('penalty');
    expect(questRowState(1, 2)).toBe('penalty');
  });

  it('is pending for a normal unmet stat', () => {
    expect(questRowState(0, 1)).toBe('pending');
    expect(questRowState(0, 0)).toBe('pending');
  });
});

describe('questPointsLabel', () => {
  it('shows a single value for a single-tier task', () => {
    expect(questPointsLabel(3, 3)).toBe('+3');
  });

  it('shows a range for a task with several effort variants', () => {
    expect(questPointsLabel(3, 8)).toBe('+3 to +8');
  });
});

describe('questCounterLabel', () => {
  it('shows the completed out of required count', () => {
    expect(questCounterLabel(0, 2)).toBe('0/2');
    expect(questCounterLabel(1, 2)).toBe('1/2');
    expect(questCounterLabel(2, 2)).toBe('2/2');
  });
});
