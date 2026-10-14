import { describe, expect, it } from 'vitest';
import type { ExportState } from './export';
import { buildExportFile, serializeExport } from './export';
import { parseImport } from './import';
import { createDefaultUserState, SCHEMA_VERSION } from './storage';
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

function validFile(): Record<string, unknown> {
  return JSON.parse(
    serializeExport(buildExportFile(sampleState(), SCHEMA_VERSION, null))
  ) as Record<string, unknown>;
}

function parse(file: Record<string, unknown>) {
  return parseImport(JSON.stringify(file), SCHEMA_VERSION);
}

describe('parseImport', () => {
  it('accepts a valid export document and returns its state', () => {
    const result = parseImport(
      serializeExport(buildExportFile(sampleState(), SCHEMA_VERSION, null)),
      SCHEMA_VERSION
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.state).toEqual(sampleState());
  });

  it('ignores the recoveryBackup field', () => {
    const file = validFile();
    file.recoveryBackup = { 'daily-tracker:tasks': '{broken' };

    const result = parse(file);

    expect(result.ok).toBe(true);
    expect(result.ok && Object.keys(result.state).sort()).toEqual([
      'completions',
      'dailyQuestLog',
      'milestoneEvents',
      'rewardPurchases',
      'rewards',
      'tasks',
      'userState',
    ]);
  });

  it('ignores unknown fields such as the theme', () => {
    const file = validFile();
    file.theme = 'light';
    file.extra = 42;

    const result = parse(file);

    expect(result.ok).toBe(true);
    expect(result.ok && result.state).not.toHaveProperty('theme');
  });

  it('rejects text that is not valid JSON', () => {
    expect(parseImport('{not json', SCHEMA_VERSION)).toEqual({
      ok: false,
      error: 'INVALID_JSON',
    });
  });

  it('rejects a document from a newer schema version', () => {
    const file = validFile();
    file.schemaVersion = SCHEMA_VERSION + 1;

    expect(parse(file)).toEqual({ ok: false, error: 'NEWER_VERSION' });
  });

  it('rejects a document from an older schema version', () => {
    const file = validFile();
    file.schemaVersion = SCHEMA_VERSION - 1;

    expect(parse(file)).toEqual({ ok: false, error: 'INVALID_DATA' });
  });

  it('rejects a missing schemaVersion', () => {
    const file = validFile();
    delete file.schemaVersion;

    expect(parse(file)).toEqual({ ok: false, error: 'INVALID_DATA' });
  });

  it('rejects a non-number schemaVersion', () => {
    const file = validFile();
    file.schemaVersion = '2';

    expect(parse(file)).toEqual({ ok: false, error: 'INVALID_DATA' });
  });

  it('rejects a missing slice', () => {
    const file = validFile();
    delete file.rewards;

    expect(parse(file)).toEqual({ ok: false, error: 'INVALID_DATA' });
  });

  it('rejects a malformed slice', () => {
    const file = validFile();
    file.tasks = [{ id: 'abcd1234' }];

    expect(parse(file)).toEqual({ ok: false, error: 'INVALID_DATA' });
  });

  it('rejects a top level that is not an object', () => {
    expect(parseImport('[]', SCHEMA_VERSION)).toEqual({ ok: false, error: 'INVALID_DATA' });
    expect(parseImport('null', SCHEMA_VERSION)).toEqual({ ok: false, error: 'INVALID_DATA' });
  });
});
