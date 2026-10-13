import { describe, expect, it } from 'vitest';
import type { StorageFailure, StorageReport } from './storage';
import { getStorageNotices } from './storage-notices';

function makeReport(partial: Partial<StorageReport> = {}): StorageReport {
  return {
    firstRun: false,
    recoveredKeys: [],
    backupKeys: [],
    schemaMismatch: null,
    ...partial,
  };
}

describe('getStorageNotices', () => {
  it('returns no notices for first run with no errors', () => {
    const notices = getStorageNotices({
      report: makeReport({ firstRun: true }),
      saveError: null,
      dismissedRecovery: false,
    });

    expect(notices).toEqual([]);
  });

  it('returns no notices for clean load', () => {
    const notices = getStorageNotices({
      report: makeReport(),
      saveError: null,
      dismissedRecovery: false,
    });

    expect(notices).toEqual([]);
  });

  it('shows recovery notice when there are recovered keys', () => {
    const notices = getStorageNotices({
      report: makeReport({ recoveredKeys: ['daily-tracker:tasks'] }),
      saveError: null,
      dismissedRecovery: false,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      type: 'recovery',
      hasDismiss: true,
      hasExport: true,
    });
  });

  it('shows recovery notice on schema mismatch', () => {
    const notices = getStorageNotices({
      report: makeReport({ schemaMismatch: { found: 1, expected: 2 } }),
      saveError: null,
      dismissedRecovery: false,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ type: 'recovery' });
  });

  it('shows write failure notice', () => {
    const notices = getStorageNotices({
      report: makeReport(),
      saveError: 'QUOTA' as StorageFailure,
      dismissedRecovery: false,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      type: 'write-failure',
      hasDismiss: false,
      hasExport: true,
    });
  });

  it('shows both notices when recovery and save error occur', () => {
    const notices = getStorageNotices({
      report: makeReport({ recoveredKeys: ['daily-tracker:tasks'] }),
      saveError: 'UNKNOWN' as StorageFailure,
      dismissedRecovery: false,
    });

    expect(notices).toHaveLength(2);
    expect(notices[0]).toMatchObject({ type: 'write-failure' });
    expect(notices[1]).toMatchObject({ type: 'recovery' });
  });

  it('does not show recovery notice if dismissed for session', () => {
    const notices = getStorageNotices({
      report: makeReport({ recoveredKeys: ['daily-tracker:tasks'] }),
      saveError: null,
      dismissedRecovery: true,
    });

    expect(notices).toEqual([]);
  });
});
