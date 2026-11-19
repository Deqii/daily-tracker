import type { AppState } from '../engine/state';
import {
  loadState,
  write,
  type StorageFailure,
  type StorageReport,
  type StorageSchema,
} from '../lib/storage';

export interface LoadedAppState {
  readonly state: AppState;
  readonly report: StorageReport;
}

function toAppState(schema: StorageSchema): AppState {
  return {
    tasks: schema.tasks,
    completions: schema.completions,
    dailyQuestLog: schema.dailyQuestLog,
    rewards: schema.rewards,
    rewardPurchases: schema.rewardPurchases,
    userState: schema.userState,
    milestoneEvents: schema.milestoneEvents,
  };
}

export function loadAppState(today: string): LoadedAppState {
  const loaded = loadState(today);

  return { state: toAppState(loaded.state), report: loaded.report };
}

/** Persists the whole state in the fixed key order and returns the first failed write, if any. */
export function persistState(state: AppState): StorageFailure | null {
  const writes = [
    write('tasks', state.tasks),
    write('completions', state.completions),
    write('dailyQuestLog', state.dailyQuestLog),
    write('rewards', state.rewards),
    write('rewardPurchases', state.rewardPurchases),
    write('milestoneEvents', state.milestoneEvents),
    write('userState', state.userState),
  ];

  const failure = writes.find((result) => !result.ok);

  return failure !== undefined && !failure.ok ? failure.error : null;
}
