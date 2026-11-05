import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PENALTY_NOTICE_KEY,
  clearPenaltyNotice,
  isPenaltyNotice,
  mergePenaltyNotices,
  readPenaltyNotice,
  writePenaltyNotice,
  type PenaltyNotice,
} from './penalty-notice';

class FakeStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function stubStorage(): FakeStorage {
  const fake = new FakeStorage();
  vi.stubGlobal('localStorage', fake);
  return fake;
}

function notice(overrides: Partial<PenaltyNotice> = {}): PenaltyNotice {
  return {
    version: 1,
    forDate: '2026-11-05',
    days: [
      {
        date: '2026-11-04',
        rankAtStart: 'E',
        missed: [{ stat: 'SOC', actual: 1, required: 2 }],
        nominalDeduction: 5,
        xpDeducted: 5,
        walletDeducted: 3,
        freezeUsed: false,
      },
    ],
    balancesBefore: { xp: 52, wallet: 16 },
    balancesAfter: { xp: 47, wallet: 13 },
    levelBefore: 2,
    levelAfter: 2,
    rankBefore: 'E',
    rankAfter: 'E',
    penaltyStats: ['SOC'],
    rankDowns: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isPenaltyNotice', () => {
  it('accepts a valid notice', () => {
    expect(isPenaltyNotice(notice())).toBe(true);
  });

  it('rejects unknown versions and malformed fields', () => {
    expect(isPenaltyNotice({ ...notice(), version: 2 })).toBe(false);
    expect(isPenaltyNotice({ ...notice(), forDate: '2026-1-1' })).toBe(false);
    expect(isPenaltyNotice({ ...notice(), penaltyStats: ['NOPE'] })).toBe(false);
    expect(isPenaltyNotice({ ...notice(), days: [{ ...notice().days[0], missed: [] }] })).toBe(
      false
    );
    expect(isPenaltyNotice({ ...notice(), balancesAfter: { xp: -1, wallet: 0 } })).toBe(false);
  });
});

describe('penalty notice ledger', () => {
  it('returns null when the key is missing', () => {
    stubStorage();

    expect(readPenaltyNotice()).toBeNull();
  });

  it('round-trips a valid notice', () => {
    stubStorage();

    expect(writePenaltyNotice(notice())).toEqual({ ok: true });
    expect(readPenaltyNotice()).toEqual(notice());
  });

  it('clears malformed JSON instead of throwing', () => {
    const fake = stubStorage();
    fake.setItem(PENALTY_NOTICE_KEY, '{broken');

    expect(() => readPenaltyNotice()).not.toThrow();
    expect(readPenaltyNotice()).toBeNull();
    expect(fake.getItem(PENALTY_NOTICE_KEY)).toBeNull();
  });

  it('clears an unknown version and invalid fields', () => {
    const fake = stubStorage();
    fake.setItem(PENALTY_NOTICE_KEY, JSON.stringify({ ...notice(), version: 99 }));

    expect(readPenaltyNotice()).toBeNull();
    expect(fake.getItem(PENALTY_NOTICE_KEY)).toBeNull();

    fake.setItem(
      PENALTY_NOTICE_KEY,
      JSON.stringify({ ...notice(), balancesAfter: { xp: 'nope', wallet: 0 } })
    );

    expect(readPenaltyNotice()).toBeNull();
    expect(fake.getItem(PENALTY_NOTICE_KEY)).toBeNull();
  });

  it('clears the key explicitly', () => {
    const fake = stubStorage();
    fake.setItem(PENALTY_NOTICE_KEY, JSON.stringify(notice()));

    expect(clearPenaltyNotice()).toEqual({ ok: true });
    expect(fake.getItem(PENALTY_NOTICE_KEY)).toBeNull();
  });

  it('reports a write failure without throwing', () => {
    const fake = new FakeStorage();
    fake.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    vi.stubGlobal('localStorage', fake);

    expect(() => writePenaltyNotice(notice())).not.toThrow();
    expect(writePenaltyNotice(notice())).toEqual({ ok: false, error: 'QUOTA' });
  });

  it('does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(readPenaltyNotice()).toBeNull();
    expect(writePenaltyNotice(notice())).toEqual({ ok: false, error: 'UNAVAILABLE' });
    expect(clearPenaltyNotice()).toEqual({ ok: false, error: 'UNAVAILABLE' });
  });
});

describe('mergePenaltyNotices', () => {
  const older = notice({
    forDate: '2026-11-04',
    days: [
      {
        date: '2026-11-03',
        rankAtStart: 'E',
        missed: [{ stat: 'INT', actual: 0, required: 1 }],
        nominalDeduction: 5,
        xpDeducted: 5,
        walletDeducted: 5,
        freezeUsed: false,
      },
    ],
    balancesBefore: { xp: 60, wallet: 20 },
    balancesAfter: { xp: 55, wallet: 15 },
    levelBefore: 2,
    levelAfter: 2,
    rankBefore: 'E',
    rankAfter: 'E',
    penaltyStats: ['INT'],
    rankDowns: [],
  });

  const newer = notice({
    forDate: '2026-11-05',
    days: [
      {
        date: '2026-11-04',
        rankAtStart: 'E',
        missed: [{ stat: 'SOC', actual: 1, required: 2 }],
        nominalDeduction: 5,
        xpDeducted: 5,
        walletDeducted: 3,
        freezeUsed: true,
      },
    ],
    balancesBefore: { xp: 55, wallet: 15 },
    balancesAfter: { xp: 50, wallet: 12 },
    levelBefore: 2,
    levelAfter: 2,
    rankBefore: 'E',
    rankAfter: 'E',
    penaltyStats: ['INT', 'SOC'],
    rankDowns: [{ localDate: '2026-11-04', from: 'E', to: 'E' }],
  });

  it('returns the other side when one is null', () => {
    expect(mergePenaltyNotices(null, newer)).toBe(newer);
    expect(mergePenaltyNotices(older, null)).toBe(older);
    expect(mergePenaltyNotices(null, null)).toBeNull();
  });

  it('dedupes days by date, unions rank-downs, keeps earliest before and latest after', () => {
    const duplicate = structuredClone(newer);
    const merged = mergePenaltyNotices(older, {
      ...newer,
      days: [...newer.days, duplicate.days[0]!],
      rankDowns: [newer.rankDowns[0]!, newer.rankDowns[0]!],
    });

    expect(merged?.days.map((day) => day.date)).toEqual(['2026-11-03', '2026-11-04']);
    expect(merged?.days).toHaveLength(2);
    expect(merged?.balancesBefore).toEqual({ xp: 60, wallet: 20 });
    expect(merged?.balancesAfter).toEqual({ xp: 50, wallet: 12 });
    expect(merged?.levelBefore).toBe(2);
    expect(merged?.levelAfter).toBe(2);
    expect(merged?.rankBefore).toBe('E');
    expect(merged?.rankAfter).toBe('E');
    expect(merged?.penaltyStats).toEqual(['INT', 'SOC']);
    expect(merged?.rankDowns).toEqual([{ localDate: '2026-11-04', from: 'E', to: 'E' }]);
  });

  it('keeps the existing notice unchanged when no new day arrives', () => {
    const incoming = { ...newer, days: [older.days[0]!] };

    expect(mergePenaltyNotices(older, incoming)).toBe(older);
  });

  it('does not mutate either input', () => {
    const before = structuredClone(older);
    const after = structuredClone(newer);

    mergePenaltyNotices(older, newer);

    expect(older).toEqual(before);
    expect(newer).toEqual(after);
  });
});
