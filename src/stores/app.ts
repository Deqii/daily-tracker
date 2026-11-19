import { derived, writable, type Readable } from 'svelte/store';
import {
  completeTask as engineCompleteTask,
  type CompleteTaskResult,
} from '../engine/complete-task';
import { purchaseReward as enginePurchaseReward, type PurchaseResult } from '../engine/purchase';
import type { AppState } from '../engine/state';
import { syncOpenDay } from '../engine/sync-open-day';
import { equipTitle as engineEquipTitle, type TitleId } from '../engine/titles';
import { toLocalDate, toTimestamp } from '../lib/date';
import type { ExportState } from '../lib/export';
import { clearPenaltyNotice, readPenaltyNotice, type PenaltyNotice } from '../lib/penalty-notice';
import { buildRewardFromDraft, type RewardFormDraft } from '../lib/reward-form';
import type { RewardPreviewRow } from '../lib/rewards-preview';
import type { StorageFailure, StorageReport } from '../lib/storage';
import { buildTaskVariants, type TaskFormDraft } from '../lib/task-form';
import type { MilestoneEvent, Rank, Reward, Stat, Task, Tier } from '../lib/types';
import {
  derivations,
  type LevelProgress,
  type RankGateStatus,
  type QuestStatGroup,
} from './app-derivations';
import { loadAppState, persistState } from './app-persistence';
import { createRolloverController } from './app-rollover';

export type {
  LevelProgress,
  QuestRow,
  QuestRowPoints,
  QuestStatGroup,
  QuestVariantOption,
  RankGateStatus,
} from './app-derivations';

export type TimerHandle = ReturnType<typeof setTimeout>;
export type SetTimer = (handler: () => void, delay: number) => TimerHandle;
export type ClearTimer = (handle: TimerHandle) => void;

/** The slice of `document` the rollover listener needs, so tests can pass a plain object. */
export interface VisibilityTarget {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/** The slice of an element the `data-rank` writer needs, so tests can pass a plain object. */
export interface RankRoot {
  setAttribute(name: string, value: string): void;
}

export interface AppDeps {
  readonly now?: () => Date;
  readonly setTimer?: SetTimer;
  readonly clearTimer?: ClearTimer;
  readonly visibility?: VisibilityTarget | null;
  readonly root?: RankRoot | null;
  readonly newId?: () => string;
}

export interface AppStore extends Readable<AppState> {
  completeTask(taskId: string, variantTier: Tier | null): CompleteTaskResult;
  deleteTask(taskId: string): void;
  saveTask(draft: TaskFormDraft, editingId: string | null): string;
  saveReward(draft: RewardFormDraft, editingId: string | null): string;
  deleteReward(rewardId: string): void;
  purchaseReward(rewardId: string): PurchaseResult;
  equipTitle(id: TitleId | null): void;
  importState(state: ExportState): void;
  markMilestoneSeen(eventId: string): void;
  rollover(): void;
  teardown(): void;
  readonly saveError: Readable<StorageFailure | null>;
  readonly loadReport: Readable<import('../lib/storage').StorageReport>;
  readonly level: Readable<number>;
  readonly levelProgress: Readable<LevelProgress>;
  readonly rank: Readable<Rank>;
  readonly levelRank: Readable<Rank>;
  readonly rankGate: Readable<RankGateStatus>;
  readonly statXP: Readable<Record<Stat, number>>;
  readonly equippedTitle: Readable<string | null>;
  readonly streak: Readable<number>;
  readonly freezesLeft: Readable<number>;
  readonly questRows: Readable<QuestStatGroup[]>;
  readonly penaltyStats: Readable<Stat[]>;
  readonly penaltyNotice: Readable<PenaltyNotice | null>;
  acknowledgePenaltyNotice(): void;
  readonly rewardPreview: Readable<RewardPreviewRow[]>;
}

/** Milliseconds from `now` to the next local midnight. */
export function millisecondsUntilNextMidnight(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

  return nextMidnight.getTime() - now.getTime();
}

/** Writes the effective rank where the design tokens are read from (`:root[data-rank]`). */
export function setRankAttribute(root: RankRoot, rank: Rank): void {
  root.setAttribute('data-rank', rank);
}

function defaultNewId(): string {
  const bytes = new Uint8Array(4);
  const webCrypto = globalThis.crypto;

  if (webCrypto !== undefined && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function defaultVisibility(): VisibilityTarget | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return {
    get visibilityState() {
      return document.visibilityState;
    },
    addEventListener(type, listener) {
      document.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      document.removeEventListener(type, listener);
    },
  };
}

function defaultRoot(): RankRoot | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

/**
 * The persisted application store (PRD §5, §2.2; decisions D7, D16, D23, D24). One composed store
 * holds the whole `AppState` and persists it after every mutation through `lib/storage`, writing
 * `userState` last. Mutations only delegate to the engine orchestrators (`completeTask`,
 * `runRollover`, `purchaseReward`); no game rule lives here. Rollover runs on load, when the tab
 * becomes visible again, and from a timer set for the next local midnight that is re-armed after
 * every run. The post-rollover notice lives in `lib/penalty-notice`, outside the game state, and
 * is written before the game state so a crash between the two writes is deduplicated later. A
 * failed write keeps the in-memory state and sets `saveError`; the next successful write clears
 * it. The clock, timer, visibility target, root element, and id generator are parameters with
 * browser defaults so tests need no DOM.
 */
export function createAppStore(deps: AppDeps = {}): AppStore {
  const now = deps.now ?? (() => new Date());
  const setTimer = deps.setTimer ?? ((handler, delay) => setTimeout(handler, delay));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle));
  const visibility = deps.visibility === undefined ? defaultVisibility() : deps.visibility;
  const root = deps.root === undefined ? defaultRoot() : deps.root;
  const newId = deps.newId ?? defaultNewId;
  const today = (): string => toLocalDate(now());

  const loaded = loadAppState(today());
  const initial = loaded.state;
  const { subscribe, set } = writable<AppState>(initial);
  const saveError = writable<StorageFailure | null>(null);
  const loadReport = writable<StorageReport>(loaded.report);
  const initialPenaltyNotice = readPenaltyNotice();
  const penaltyNotice = writable<PenaltyNotice | null>(initialPenaltyNotice);

  let current = initial;
  let pendingPenaltyNotice = initialPenaltyNotice;
  let timer: TimerHandle | null = null;

  function applyRank(): void {
    if (root !== null) {
      setRankAttribute(root, current.userState.rank);
    }
  }

  function commit(next: AppState): void {
    current = next;
    set(next);
    applyRank();
  }

  function persist(state: AppState): void {
    saveError.set(persistState(state));
  }

  function armMidnightTimer(): void {
    if (timer !== null) {
      clearTimer(timer);
    }

    timer = setTimer(() => rolloverController.run(), millisecondsUntilNextMidnight(now()));
  }

  function onVisibilityChange(): void {
    if (visibility !== null && visibility.visibilityState === 'visible') {
      rolloverController.run();
    }
  }

  const rolloverController = createRolloverController({
    getState: () => current,
    getToday: today,
    newId,
    getPendingPenaltyNotice: () => pendingPenaltyNotice,
    setPendingPenaltyNotice: (notice) => {
      pendingPenaltyNotice = notice;
      penaltyNotice.set(notice);
    },
    commit,
    persist,
    armMidnightTimer,
  });

  applyRank();
  rolloverController.run();

  if (visibility !== null) {
    visibility.addEventListener('visibilitychange', onVisibilityChange);
  }

  const base: Readable<AppState> = { subscribe };

  return {
    subscribe,
    saveError,
    loadReport,
    level: derived(base, derivations.level),
    levelProgress: derived(base, derivations.levelProgress),
    rank: derived(base, derivations.rank),
    levelRank: derived(base, derivations.levelRank),
    rankGate: derived(base, derivations.rankGate),
    statXP: derived(base, derivations.statXP),
    equippedTitle: derived(base, derivations.equippedTitle),
    streak: derived(base, derivations.streak),
    freezesLeft: derived(base, derivations.freezesLeft),
    penaltyNotice,
    acknowledgePenaltyNotice: rolloverController.acknowledge,
    questRows: derived(base, derivations.questRows),
    rewardPreview: derived(base, derivations.rewardPreview),
    penaltyStats: derived(base, derivations.penaltyStats),
    completeTask(taskId, variantTier) {
      const result = engineCompleteTask(current, { taskId, variantTier }, now(), newId);

      if (result.ok) {
        commit(result.value.state);
        persist(result.value.state);
      }

      return result;
    },
    saveTask(draft, editingId) {
      const existing =
        editingId === null ? undefined : current.tasks.find((task) => task.id === editingId);
      const task: Task = {
        id: existing?.id ?? newId(),
        familyName: draft.familyName.trim(),
        stat: draft.stat,
        isAnchor: draft.isAnchor,
        variants: buildTaskVariants(draft),
        createdAt: existing?.createdAt ?? toTimestamp(now()),
      };
      const tasks =
        existing === undefined
          ? [...current.tasks, task]
          : current.tasks.map((entry) => (entry.id === task.id ? task : entry));
      const next = syncOpenDay({ ...current, tasks }, today());

      commit(next);
      persist(next);

      return task.id;
    },
    deleteTask(taskId) {
      const task = current.tasks.find((entry) => entry.id === taskId);

      if (task === undefined) {
        return;
      }

      const tasks = current.tasks.filter((entry) => entry.id !== taskId);
      const next = syncOpenDay({ ...current, tasks }, today());

      commit(next);
      persist(next);
    },
    saveReward(draft, editingId) {
      const existing =
        editingId === null ? undefined : current.rewards.find((reward) => reward.id === editingId);
      const data = buildRewardFromDraft(draft);
      const reward: Reward = {
        id: existing?.id ?? newId(),
        title: data.title,
        cost: data.cost,
        createdAt: existing?.createdAt ?? toTimestamp(now()),
      };
      const rewards =
        existing === undefined
          ? [...current.rewards, reward]
          : current.rewards.map((entry) => (entry.id === reward.id ? reward : entry));
      const next: AppState = { ...current, rewards };

      commit(next);
      persist(next);

      return reward.id;
    },
    deleteReward(rewardId) {
      const rewards = current.rewards.filter((entry) => entry.id !== rewardId);
      const next: AppState = { ...current, rewards };

      commit(next);
      persist(next);
    },
    purchaseReward(rewardId) {
      const result = enginePurchaseReward(current, rewardId, now(), newId);

      if (result.ok) {
        commit(result.value.state);
        persist(result.value.state);
      }

      return result;
    },
    equipTitle(id) {
      const result = engineEquipTitle(current.userState, id);

      if (result.ok) {
        const next: AppState = { ...current, userState: result.value };

        commit(next);
        persist(next);
      }
    },
    importState(state) {
      pendingPenaltyNotice = null;
      penaltyNotice.set(null);
      clearPenaltyNotice();
      commit(state);
      persist(state);
    },
    markMilestoneSeen(eventId) {
      const target = current.milestoneEvents.find((event) => event.id === eventId);

      if (target === undefined || target.seen) {
        return;
      }

      const milestoneEvents = current.milestoneEvents.map((event): MilestoneEvent =>
        event.id === eventId ? { ...event, seen: true } : event
      );
      const next: AppState = { ...current, milestoneEvents };

      commit(next);
      persist(next);
    },
    rollover: rolloverController.run,
    teardown() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }

      if (visibility !== null) {
        visibility.removeEventListener('visibilitychange', onVisibilityChange);
      }
    },
  };
}

/** The app-wide store, hydrated from `localStorage` on first import. */
export const app = createAppStore();
