import { describe, expect, it } from 'vitest';
import type { ExportState } from './export';
import { buildExport, buildExportFile, exportFileName, serializeExport } from './export';
import { createDefaultUserState } from './storage';
import type { Task } from './types';

function sampleTask(): Task {
  return {
    id: 'abcd1234',
    familyName: 'Push up routine',
    stat: 'STR',
    isAnchor: true,
    variants: [{ tier: 'easy', description: '10 reps', points: 5 }],
    createdAt: '2026-10-04T10:15:30+07:00',
  };
}

function sampleState(): ExportState {
  return {
    tasks: [sampleTask()],
    completions: [],
    dailyQuestLog: [],
    rewards: [],
    rewardPurchases: [],
    userState: createDefaultUserState('2026-10-12'),
    milestoneEvents: [],
  };
}

describe('buildExportFile', () => {
  it('carries every persisted key except the theme', () => {
    const file = buildExportFile(sampleState(), 2, null);

    expect(Object.keys(file).sort()).toEqual([
      'completions',
      'dailyQuestLog',
      'milestoneEvents',
      'rewardPurchases',
      'rewards',
      'schemaVersion',
      'tasks',
      'userState',
    ]);
    expect(file.schemaVersion).toBe(2);
    expect(file.tasks).toEqual([sampleTask()]);
  });

  it('omits recoveryBackup when there is no backup', () => {
    expect(buildExportFile(sampleState(), 2, null)).not.toHaveProperty('recoveryBackup');
  });

  it('omits recoveryBackup when the backup is empty', () => {
    expect(buildExportFile(sampleState(), 2, {})).not.toHaveProperty('recoveryBackup');
  });

  it('includes recoveryBackup when the backup holds entries', () => {
    const backup = { 'daily-tracker:tasks': '{broken' };

    expect(buildExportFile(sampleState(), 2, backup).recoveryBackup).toEqual(backup);
  });
});

describe('serializeExport', () => {
  it('writes readable JSON with a trailing newline', () => {
    const file = buildExportFile(sampleState(), 2, null);
    const text = serializeExport(file);

    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "schemaVersion": 2');
    expect(JSON.parse(text)).toEqual(file);
  });
});

describe('exportFileName', () => {
  it('names the file after the local day of now', () => {
    expect(exportFileName(new Date(2026, 9, 12, 23, 30))).toBe('daily-tracker-2026-10-12.json');
  });
});

describe('buildExport', () => {
  it('pairs the download name with the serialized document', () => {
    const bundle = buildExport(sampleState(), 2, null, new Date(2026, 9, 12));

    expect(bundle.filename).toBe('daily-tracker-2026-10-12.json');
    expect(JSON.parse(bundle.contents).tasks).toEqual([sampleTask()]);
  });
});
