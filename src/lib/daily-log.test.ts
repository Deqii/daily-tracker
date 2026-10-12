import { describe, expect, it } from 'vitest';
import type { DailyQuestDay, MilestoneEvent, Stat } from './types';
import {
  buildDailyLog,
  isDayRow,
  logDayCount,
  milestoneText,
  netPointsLabel,
  statStatus,
  visibleLogRows,
  type DayLogRow,
  type LogRow,
  type MilestoneLogRow,
  type StatStatus,
} from './daily-log';

const OPEN_DATE = '2026-09-27';

const ALL_STATS: readonly Stat[] = ['STR', 'VIT', 'INT', 'DISC', 'SOC'];

const zeroCounts = (): Record<Stat, number> => ({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

/** A required-count record with `1` for the listed stats and `0` for the rest. */
function counts(withOne: readonly Stat[]): Record<Stat, number> {
  const result = zeroCounts();

  for (const stat of withOne) {
    result[stat] = 1;
  }

  return result;
}

interface DayProps {
  readonly required?: readonly Stat[];
  readonly actual?: readonly Stat[];
  readonly net?: number;
  readonly freezeUsed?: boolean;
  readonly closed?: boolean;
}

function day(date: string, props: DayProps = {}): DailyQuestDay {
  const closed = props.closed ?? true;

  return {
    date,
    selectedTaskIdPerStat: {},
    requiredCompletions: counts(props.required ?? []),
    actualCompletions: counts(props.actual ?? []),
    netPointsChange: props.net ?? 0,
    freezeUsed: props.freezeUsed ?? false,
    closed,
    lifetimeXPEnd: closed ? 0 : null,
    levelEnd: null,
    rankEnd: null,
  };
}

/** `count` consecutive days starting at `from`, each with every stat required and met, net 7. */
function contiguousDays(from: string, count: number): DailyQuestDay[] {
  const base = new Date(`${from}T00:00:00Z`);
  const result: DailyQuestDay[] = [];

  for (let offset = 0; offset < count; offset++) {
    const date = new Date(base.getTime() + offset * 86400000);
    result.push(
      day(
        `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
          date.getUTCDate()
        ).padStart(2, '0')}`,
        { required: ALL_STATS, actual: ALL_STATS, net: 7 }
      )
    );
  }

  return result;
}

function levelUp(date: string, from = 2, to = 3): MilestoneEvent {
  return { id: `l-${date}`, type: 'levelUp', localDate: date, from, to, seen: false };
}

function rankEvent(date: string, type: 'rankUp' | 'rankDown'): MilestoneEvent {
  return { id: `r-${date}`, type, localDate: date, from: 'E', to: 'D', seen: false };
}

/** The seven-day sample from design §5, newest first: 27, 26, 25, 24, 23, 22, 21 Sep. */
function sampleDays(): DailyQuestDay[] {
  return [
    day('2026-09-21', { required: ALL_STATS, actual: ['STR', 'VIT', 'INT', 'DISC'], net: 7 }),
    day('2026-09-22', { required: ALL_STATS, net: -25 }),
    day('2026-09-23', { required: ALL_STATS, actual: ALL_STATS, net: 15 }),
    day('2026-09-24', {
      required: ALL_STATS,
      actual: ['STR', 'INT', 'SOC'],
      net: -1,
    }),
    day('2026-09-25', { required: ALL_STATS, actual: ALL_STATS, net: 15 }),
    day('2026-09-26', {
      required: ALL_STATS,
      actual: ['STR', 'VIT', 'INT', 'DISC'],
      net: 7,
    }),
    day('2026-09-27', {
      required: ['STR', 'VIT', 'DISC'],
      actual: ['STR', 'VIT', 'DISC'],
      net: 9,
      closed: false,
    }),
  ];
}

function sampleRows(): LogRow[] {
  return buildDailyLog(sampleDays(), [levelUp('2026-09-26')], OPEN_DATE, '7d');
}

function dayRows(rows: readonly LogRow[]): DayLogRow[] {
  return rows.filter(isDayRow);
}

function dayRowStatuses(rows: readonly LogRow[]): StatStatus[][] {
  return dayRows(rows).map((row) => [...row.statuses]);
}

describe('statStatus', () => {
  it('shows a check for a required stat that met its count', () => {
    const satisfied = day('2026-09-26', { required: ALL_STATS, actual: ALL_STATS });

    expect(statStatus(satisfied, 'STR')).toBe('completed');
    expect(statStatus(satisfied, 'SOC')).toBe('completed');
  });

  it('shows a check once a 2x requirement is fully met', () => {
    const fullyMet: DailyQuestDay = {
      ...day('2026-09-27', { closed: false }),
      requiredCompletions: { ...zeroCounts(), STR: 2 },
      actualCompletions: { ...zeroCounts(), STR: 2 },
    };

    expect(statStatus(fullyMet, 'STR')).toBe('completed');
  });

  it('shows a dash for a missed stat on a closed day', () => {
    const missed = day('2026-09-26', {
      required: ALL_STATS,
      actual: ['STR', 'VIT', 'INT', 'DISC'],
    });

    expect(statStatus(missed, 'SOC')).toBe('missed');
  });

  it('shows a dash when a 2x requirement was met only once', () => {
    const oneOfTwo: DailyQuestDay = {
      ...day('2026-09-26'),
      requiredCompletions: { ...zeroCounts(), STR: 2 },
      actualCompletions: { ...zeroCounts(), STR: 1 },
    };

    expect(statStatus(oneOfTwo, 'STR')).toBe('missed');
  });

  it('shows an empty circle for a stat that was not required', () => {
    const notRequired = day('2026-09-27', { required: ['STR'], actual: ['STR'] });

    expect(statStatus(notRequired, 'INT')).toBe('pending');
  });

  it('shows an empty circle for an open-day stat that has not finished', () => {
    const openDay = day('2026-09-27', { required: ['STR', 'INT'], closed: false });

    expect(statStatus(openDay, 'INT')).toBe('pending');
  });
});

describe('milestoneText', () => {
  it('writes a level up as copy', () => {
    expect(milestoneText(levelUp('2026-09-26', 2, 3))).toBe('Level up: 2 to 3');
  });

  it('writes rank changes as copy', () => {
    expect(milestoneText(rankEvent('2026-09-26', 'rankUp'))).toBe('Rank up: E to D');
    expect(milestoneText(rankEvent('2026-09-22', 'rankDown'))).toBe('Rank down: E to D');
  });
});

describe('netPointsLabel', () => {
  it('signs gains and losses and leaves flat days unsigned', () => {
    expect(netPointsLabel(9)).toBe('+9');
    expect(netPointsLabel(-25)).toBe('-25');
    expect(netPointsLabel(0)).toBe('0');
  });
});

describe('buildDailyLog', () => {
  it('builds the sample log newest first with the level-up line between 27 and 26 Sep', () => {
    const rows = sampleRows();

    expect(rows).toHaveLength(8);
    expect(dayRows(rows).map((row) => row.date)).toEqual([
      '2026-09-27',
      '2026-09-26',
      '2026-09-25',
      '2026-09-24',
      '2026-09-23',
      '2026-09-22',
      '2026-09-21',
    ]);
    expect(rows[1]).toEqual({ type: 'levelUp', text: 'Level up: 2 to 3' });
  });

  it('maps the sample check, dash, and pending icons', () => {
    expect(dayRowStatuses(sampleRows())).toEqual([
      ['completed', 'completed', 'pending', 'completed', 'pending'],
      ['completed', 'completed', 'completed', 'completed', 'missed'],
      ['completed', 'completed', 'completed', 'completed', 'completed'],
      ['completed', 'missed', 'completed', 'missed', 'completed'],
      ['completed', 'completed', 'completed', 'completed', 'completed'],
      ['missed', 'missed', 'missed', 'missed', 'missed'],
      ['completed', 'completed', 'completed', 'completed', 'missed'],
    ]);
  });

  it('keeps the sample net points on each day', () => {
    expect(dayRows(sampleRows()).map((row) => row.netPoints)).toEqual([9, 7, 15, -1, 15, -25, 7]);
  });

  it('labels the date in monospace copy', () => {
    const rows = sampleRows();
    const first = dayRows(rows)[0];

    expect(first?.dateLabel).toBe('27 Sep');
    expect(first?.freezeUsed).toBe(false);
  });

  it('carries the freeze marker onto the row', () => {
    const frozen = day('2026-09-24', {
      required: ALL_STATS,
      net: -25,
      freezeUsed: true,
    });
    const rows = buildDailyLog([...sampleDays(), frozen], [], OPEN_DATE, '7d');

    expect(dayRows(rows).find((row) => row.date === '2026-09-24')?.freezeUsed).toBe(true);
  });

  it('places every milestone in the order it was emitted on its day', () => {
    const rows = buildDailyLog(
      sampleDays(),
      [levelUp('2026-09-23', 1, 2), rankEvent('2026-09-23', 'rankUp')],
      OPEN_DATE,
      '7d'
    );
    const between = rows.filter((row) => !isDayRow(row));

    expect(between).toEqual([
      { type: 'levelUp', text: 'Level up: 1 to 2' },
      { type: 'rankUp', text: 'Rank up: E to D' },
    ]);
  });

  it('places a rank-down line above the day it happened on', () => {
    const rows = buildDailyLog(
      sampleDays(),
      [rankEvent('2026-09-22', 'rankDown')],
      OPEN_DATE,
      '7d'
    );
    const indexOfLine = rows.findIndex((row) => !isDayRow(row));
    const nextDay = rows.slice(indexOfLine + 1).find(isDayRow);

    expect(indexOfLine).toBeGreaterThan(-1);
    expect(nextDay?.date).toBe('2026-09-22');
  });

  it('windows seven and thirty days, rendering only the entries in the window', () => {
    const seven = buildDailyLog(sampleDays(), [], OPEN_DATE, '7d');
    const thirty = buildDailyLog(
      [...contiguousDays('2026-08-29', 30), ...sampleDays()],
      [],
      OPEN_DATE,
      '30d'
    );

    expect(dayRows(seven)).toHaveLength(7);
    expect(dayRows(thirty)).toHaveLength(30);
    expect(dayRows(thirty)[0]?.date).toBe(OPEN_DATE);
  });

  it('clamps the window so it never starts before the earliest log entry', () => {
    const rows = buildDailyLog(
      [day('2026-09-25'), day('2026-09-27', { closed: false })],
      [],
      OPEN_DATE,
      '7d'
    );

    expect(dayRows(rows).map((row) => row.date)).toEqual(['2026-09-27', '2026-09-25']);
  });

  it('starts at the earliest log entry for the all range', () => {
    const rows = buildDailyLog([...contiguousDays('2026-09-20', 8)], [], OPEN_DATE, 'all');

    expect(dayRows(rows).map((row) => row.date)).toEqual([
      '2026-09-27',
      '2026-09-26',
      '2026-09-25',
      '2026-09-24',
      '2026-09-23',
      '2026-09-22',
      '2026-09-21',
      '2026-09-20',
    ]);
  });

  it('renders only dates that have a log entry', () => {
    const rows = buildDailyLog(
      [day('2026-09-21'), day('2026-09-27', { closed: false })],
      [],
      OPEN_DATE,
      '7d'
    );

    expect(dayRows(rows).map((row) => row.date)).toEqual(['2026-09-27', '2026-09-21']);
  });

  it('renders nothing when there is no log yet', () => {
    const rows = buildDailyLog([], [], OPEN_DATE, '7d');

    expect(rows).toEqual([]);
  });

  it('ignores milestone events outside the range', () => {
    const rows = buildDailyLog(sampleDays(), [levelUp('2026-08-01')], OPEN_DATE, '7d');

    expect(rows.every(isDayRow)).toBe(true);
  });
});

describe('logDayCount and visibleLogRows', () => {
  it('counts day rows and skips milestone lines', () => {
    const rows = buildDailyLog(sampleDays(), [levelUp('2026-09-26')], OPEN_DATE, 'all');

    expect(logDayCount(rows)).toBe(7);
  });

  it('keeps the newest sixty days and their milestone lines for the all range', () => {
    const rows = buildDailyLog(
      contiguousDays('2026-07-25', 65),
      [levelUp('2026-07-25')],
      OPEN_DATE,
      'all'
    );
    const page = visibleLogRows(rows, 60);

    expect(logDayCount(rows)).toBe(65);
    expect(page).toHaveLength(60);
    expect(dayRows(page).every((row) => row.date >= '2026-07-30')).toBe(true);
  });

  it('keeps every row for a non-all range', () => {
    const rows = buildDailyLog(
      contiguousDays('2026-07-25', 65),
      [levelUp('2026-07-25')],
      OPEN_DATE,
      '30d'
    );
    const page = visibleLogRows(rows, 60);

    expect(page).toEqual(rows);
  });

  it('reveals more days with a larger window while keeping the milestone lines', () => {
    const rows = buildDailyLog(
      contiguousDays('2026-07-25', 65),
      [levelUp('2026-07-25')],
      OPEN_DATE,
      'all'
    );
    const pagedOut = visibleLogRows(rows, 60).some(
      (row) => !isDayRow(row) && row.type === 'levelUp'
    );
    const revealed = visibleLogRows(rows, 65);

    expect(pagedOut).toBe(false);
    expect(revealed).toHaveLength(66);
    expect(
      revealed.some(
        (row): row is MilestoneLogRow => !isDayRow(row) && row.text === 'Level up: 2 to 3'
      )
    ).toBe(true);
  });
});
