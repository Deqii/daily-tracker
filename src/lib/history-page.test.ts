import { describe, expect, it } from 'vitest';
import {
  buildHistoryDays,
  calendarOffset,
  chartAriaLabel,
  chartLabelIndices,
  chartScale,
  chartThresholdY,
  chartX,
  chartY,
  formatFullDate,
  formatRangeLabel,
  formatShortDate,
  formatTooltipDate,
  statLabel,
  historyLogRows,
  historySummary,
  historyView,
  HISTORY_WIDTH,
} from './history-page';
import { FIXTURES, FIXED_TODAY } from './fixtures/data';

function historyDays(fixture = FIXTURES.history) {
  const schema = fixture.schema;

  return buildHistoryDays(
    schema.dailyQuestLog,
    schema.milestoneEvents,
    schema.userState.lifetimeXP,
    schema.userState.lastRolloverDate
  );
}

const days = historyDays();
const lastSeven = historyView(days, 7, 60);

describe('en-GB date formatting', () => {
  it('writes short, full and tooltip dates', () => {
    expect(formatShortDate('2026-10-15')).toBe('15 Oct');
    expect(formatFullDate('2026-10-15')).toBe('15 Oct 2026');
    expect(formatTooltipDate('2026-10-15')).toBe('Thu 15 Oct');
    expect(formatShortDate('2026-09-16')).toBe('16 Sept');
    expect(formatTooltipDate('2026-09-16')).toBe('Wed 16 Sept');
  });

  it('writes the prototype stat labels', () => {
    expect(statLabel('STR')).toBe('Str');
    expect(statLabel('VIT')).toBe('Vit');
    expect(statLabel('DISC')).toBe('Disc');
  });

  it('writes the range label with the year only on the end date', () => {
    expect(formatRangeLabel(lastSeven)).toBe('9 Oct – 15 Oct 2026');
  });
});

describe('calendarOffset', () => {
  it('counts Monday as zero', () => {
    expect(calendarOffset('2026-10-12')).toBe(0);
    expect(calendarOffset('2026-10-15')).toBe(3);
    expect(calendarOffset('2026-10-09')).toBe(4);
  });
});

describe('historyView', () => {
  it('shows 7 days by default', () => {
    expect(lastSeven.map((day) => day.date)).toEqual([
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('shows 30 days for the 30-day range', () => {
    expect(historyView(days, 30, 60)).toHaveLength(30);
  });

  it('pages All in 60-day steps and never past the earliest day', () => {
    const long = historyDays(FIXTURES.history.states?.long);

    expect(historyView(long, 'all', 60)).toHaveLength(60);
    expect(historyView(long, 'all', 120)).toHaveLength(120);
    expect(historyView(long, 'all', 180)).toHaveLength(150);
  });
});

describe('historySummary', () => {
  it('derives the default seven-day cards', () => {
    expect(historySummary(lastSeven, 13)).toEqual({
      lifetimeXP: 554,
      delta: 116,
      streak: 13,
      perfectDays: 5,
      dayCount: 7,
      mostMissed: 'STR',
      mostMissedCount: 1,
    });
  });

  it('uses the open day snapshot without a penalty', () => {
    const open = historyDays(FIXTURES.history.states?.open);
    const view = historyView(open, 7, 60);

    expect(historySummary(view, 13)).toMatchObject({
      lifetimeXP: 546,
      delta: 108,
      perfectDays: 4,
      mostMissed: 'SOC',
      mostMissedCount: 2,
    });
    expect(view[view.length - 1]?.open).toBe(true);
    expect(view[view.length - 1]?.completedStats).toBe(3);
  });
});

describe('chart scale and ticks', () => {
  it('chooses the prototype step, floor and four intervals', () => {
    const values = lastSeven.map((day) => day.xp);

    expect(chartScale(values)).toEqual({ step: 50, lo: 400, hi: 600, ticks: [400, 450, 500, 550, 600] });
  });

  it('keeps the thirty-day threshold in range', () => {
    const scale = chartScale(historyView(days, 30, 60).map((day) => day.xp));

    expect(scale).toEqual({ step: 75, lo: 300, hi: 600, ticks: [300, 375, 450, 525, 600] });
    expect(chartThresholdY(350, scale)).toBeGreaterThan(0);
    expect(chartThresholdY(350, scale)).toBeLessThan(300);
  });

  it('places points at the prototype padding', () => {
    expect(chartX(0, 7)).toBe(46);
    expect(chartX(6, 7)).toBe(HISTORY_WIDTH - 14);
    expect(chartY(600, { step: 50, lo: 400, hi: 600, ticks: [] })).toBe(22);
    expect(chartY(400, { step: 50, lo: 400, hi: 600, ticks: [] })).toBe(270);
  });

  it('labels every point up to eight days, then eight evenly spaced ticks', () => {
    expect(chartLabelIndices(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(chartLabelIndices(30)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 29]);
  });
});

describe('chartAriaLabel', () => {
  it('summarises the range from the stored snapshots', () => {
    expect(chartAriaLabel(lastSeven)).toBe(
      'Lifetime XP chart, 7 days: from 438 to 554 XP, 2 key events'
    );
  });
});

describe('buildHistoryDays and the event log', () => {
  it('keeps exactly one record per date and reflects the fixture state', () => {
    const dates = days.map((day) => day.date);

    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.filter((date) => date === FIXED_TODAY)).toHaveLength(1);
    expect(days[days.length - 1]?.open).toBe(false);

    const openState = FIXTURES.history.states?.open;

    if (openState === undefined) throw new Error('history fixture lost its open state');

    const openDays = buildHistoryDays(
      openState.schema.dailyQuestLog,
      openState.schema.milestoneEvents,
      openState.schema.userState.lifetimeXP,
      FIXED_TODAY
    );

    expect(openDays[openDays.length - 1]?.open).toBe(true);
  });

  it('maps rank, level and title events from the stored event log', () => {
    expect(FIXTURES.history.schema.milestoneEvents.map((event) => event.type)).toEqual([
      'rankUp',
      'titleUnlock',
      'rankDown',
      'rankUp',
      'titleUnlock',
      'levelUp',
    ]);
    const events = days.flatMap((day) => day.events);

    expect(events.map((event) => event.kind)).toEqual([
      'rankUp',
      'milestone',
      'rankDown',
      'rankUp',
      'milestone',
      'levelUp',
    ]);
    expect(events[1]).toMatchObject({
      kind: 'milestone',
      title: 'New title: Konsisten 7 hari',
      subtitle: 'Streak reached 7',
    });
  });

  it('orders the log newest first with event rows above their day', () => {
    const rows = historyLogRows(lastSeven);

    expect(rows[0]).toMatchObject({ type: 'day', day: { date: '2026-10-15' } });
    expect(rows.findIndex((row) => row.type === 'event')).toBe(2);
    expect(rows.filter((row) => row.type === 'event')).toHaveLength(2);
  });
});
