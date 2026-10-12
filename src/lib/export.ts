import { toLocalDate } from './date';
import type { BackupRecord } from './storage';
import type {
  Completion,
  DailyQuestDay,
  MilestoneEvent,
  Reward,
  RewardPurchase,
  Task,
  UserState,
} from './types';

/** The persisted slices an export carries; matches `AppState` structurally (PRD §6). */
export interface ExportState {
  tasks: Task[];
  completions: Completion[];
  dailyQuestLog: DailyQuestDay[];
  rewards: Reward[];
  rewardPurchases: RewardPurchase[];
  userState: UserState;
  milestoneEvents: MilestoneEvent[];
}

/** The JSON document behind the Settings "Export data" action (PRD §6; D22). Excludes the theme. */
export interface ExportFile extends ExportState {
  schemaVersion: number;
  recoveryBackup?: BackupRecord;
}

/** A ready-to-download file: its name and its text. */
export interface ExportBundle {
  filename: string;
  contents: string;
}

/**
 * Builds the export document. The recovery backup (D22) is included only when it holds an entry, so
 * a clean install exports without the extra field.
 */
export function buildExportFile(
  state: ExportState,
  schemaVersion: number,
  recoveryBackup: BackupRecord | null
): ExportFile {
  const file: ExportFile = {
    schemaVersion,
    tasks: state.tasks,
    completions: state.completions,
    dailyQuestLog: state.dailyQuestLog,
    rewards: state.rewards,
    rewardPurchases: state.rewardPurchases,
    userState: state.userState,
    milestoneEvents: state.milestoneEvents,
  };

  if (recoveryBackup !== null && Object.keys(recoveryBackup).length > 0) {
    file.recoveryBackup = recoveryBackup;
  }

  return file;
}

/** Serializes the document as readable JSON with a trailing newline. */
export function serializeExport(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** The download name, `daily-tracker-YYYY-MM-DD.json`, using the local day of `now`. */
export function exportFileName(now: Date): string {
  return `daily-tracker-${toLocalDate(now)}.json`;
}

/** The downloadable file for the given state: its name and its text. */
export function buildExport(
  state: ExportState,
  schemaVersion: number,
  recoveryBackup: BackupRecord | null,
  now: Date
): ExportBundle {
  return {
    filename: exportFileName(now),
    contents: serializeExport(buildExportFile(state, schemaVersion, recoveryBackup)),
  };
}
