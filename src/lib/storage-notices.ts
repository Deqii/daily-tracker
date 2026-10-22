import type { StorageFailure, StorageReport } from './storage';

export type StorageNoticeType = 'write-failure' | 'recovery';

export interface StorageNotice {
  type: StorageNoticeType;
  message: string;
  hasExport: boolean;
  hasDismiss: boolean;
}

export interface StorageNoticesOptions {
  report: StorageReport;
  saveError: StorageFailure | null;
  dismissedRecovery: boolean;
}

/**
 * Determines which storage notices should be shown at the top of the page.
 * Pure function: takes the load report and save error, returns notices to render.
 */
export function getStorageNotices({
  report,
  saveError,
  dismissedRecovery,
}: StorageNoticesOptions): StorageNotice[] {
  const notices: StorageNotice[] = [];

  if (saveError !== null) {
    notices.push({
      type: 'write-failure',
      message:
        'Your data could not be saved. Export it now so you don’t lose progress.',
      hasExport: true,
      hasDismiss: false,
    });
  }

  const shouldShowRecovery =
    !dismissedRecovery &&
    !report.firstRun &&
    (report.recoveredKeys.length > 0 || report.schemaMismatch !== null);

  if (shouldShowRecovery) {
    notices.push({
      type: 'recovery',
      message: 'Some saved data could not be used, so it was reset. A copy was kept.',
      hasExport: true,
      hasDismiss: true,
    });
  }

  return notices;
}
