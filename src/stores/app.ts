import { derived, writable, type Readable } from 'svelte/store';
import { passesBalanceGate } from '../engine/balance';
import {
  completeTask as engineCompleteTask,
  type CompleteTaskResult,
} from '../engine/complete-task';
import { level as levelOf, xpForLevel } from '../engine/level';
import { pointsAwarded } from '../engine/points';
import { purchaseReward as enginePurchaseReward, type PurchaseResult } from '../engine/purchase';
import { getRankConfig, rank as levelRankOf, resolveRank } from '../engine/rank';
import { runRollover as engineRunRollover } from '../engine/run-rollover';
import type { AppState } from '../engine/state';
import { displayStreak } from '../engine/streak';
import { TITLES } from '../engine/titles';
import { toLocalDate, toTimestamp } from '../lib/date';
import { selectRewardPreview, type RewardPreviewRow } from '../lib/rewards-preview';
import { loadState, write, type StorageFailure, type StorageSchema } from '../lib/storage';
import { buildTaskVariants, type TaskFormDraft } from '../lib/task-form';
import type { Rank, Stat, Task, Tier } from '../lib/types';
import { STATS } from '../lib/types';

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

/** In-level XP progress: `xpIntoLevel / xpForThisLevel` is what the Today XP bar fills. */
export interface LevelProgress {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForThisLevel: number;
  readonly ratio: number;
}

/** The rank-up balance gate as shown on Today (PRD §7.6). */
export interface RankGateStatus {
  readonly blocked: boolean;
  readonly levelRank: Rank;
  readonly weakest: Stat | null;
  readonly threshold: number;
  readonly current: number | null;
}

/** The points a quest row awards (after cap and multiplier), lowest to highest across its variants. */
export interface QuestRowPoints {
  readonly min: number;
  readonly max: number;
}

/** One effort variant of a quest row, with the points it will award (after cap and multiplier). */
export interface QuestVariantOption {
  readonly tier: Tier;
  readonly description: string;
  readonly points: number;
}

/** One row of the open day's Daily Quest (an anchor task or that day's rotating pick). */
export interface QuestRow {
  readonly task: Task;
  readonly isAnchor: boolean;
  readonly isRotating: boolean;
  readonly completionCount: number;
  readonly points: QuestRowPoints;
  readonly options: QuestVariantOption[];
}

/** The open day's quest rows for one quest-active stat. */
export interface QuestStatGroup {
  readonly stat: Stat;
  readonly required: number;
  readonly completed: number;
  readonly rows: QuestRow[];
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
  saveTask(draft: TaskFormDraft, editingId: string | null): void;
  purchaseReward(rewardId: string): PurchaseResult;
  rollover(): void;
  teardown(): void;
  readonly saveError: Readable<StorageFailure | null>;
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

function openDayOf(state: AppState) {
  return state.dailyQuestLog.find((day) => day.date === state.userState.lastRolloverDate);
}

function hasCompletionToday(state: AppState): boolean {
  const openDay = openDayOf(state);

  return openDay !== undefined && STATS.some((stat) => openDay.actualCompletions[stat] > 0);
}

function toLevelProgress(state: AppState): LevelProgress {
  const xp = state.userState.lifetimeXP;
  const level = levelOf(xp);
  const levelFloor = xpForLevel(level);
  const xpForThisLevel = xpForLevel(level + 1) - levelFloor;
  const xpIntoLevel = xp - levelFloor;

  return {
    level,
    xpIntoLevel,
    xpForThisLevel,
    ratio: xpForThisLevel > 0 ? xpIntoLevel / xpForThisLevel : 0,
  };
}

function toRankGate(state: AppState): RankGateStatus {
  const level = levelOf(state.userState.lifetimeXP);
  const resolution = resolveRank(state.userState.rank, level, state.userState.statXP);
  const gate = passesBalanceGate(state.userState.statXP);

  return {
    blocked: resolution.blocked,
    levelRank: levelRankOf(level),
    weakest: gate.weakest,
    threshold: gate.threshold,
    current: gate.weakest === null ? null : state.userState.statXP[gate.weakest],
  };
}

function equippedTitleName(id: string | null): string | null {
  if (id === null) {
    return null;
  }

  return TITLES.find((title) => title.id === id)?.name ?? null;
}

function toQuestOptions(task: Task, rank: Rank): QuestVariantOption[] {
  return task.variants.map((variant) => ({
    tier: variant.tier,
    description: variant.description,
    points: pointsAwarded(variant.points, rank),
  }));
}

function toQuestRowPoints(options: QuestVariantOption[]): QuestRowPoints {
  const awarded = options.map((option) => option.points);

  return { min: Math.min(...awarded), max: Math.max(...awarded) };
}

function toQuestGroups(state: AppState): QuestStatGroup[] {
  const openDay = openDayOf(state);

  if (openDay === undefined) {
    return [];
  }

  const groups: QuestStatGroup[] = [];

  for (const stat of STATS) {
    if (openDay.requiredCompletions[stat] <= 0) {
      continue;
    }

    const rotatingTaskId = openDay.selectedTaskIdPerStat[stat];
    const rank = state.userState.rank;

    const rows = state.tasks
      .filter((task) => task.stat === stat && (task.isAnchor || task.id === rotatingTaskId))
      .map((task) => {
        const options = toQuestOptions(task, rank);

        return {
          task,
          isAnchor: task.isAnchor,
          isRotating: !task.isAnchor && task.id === rotatingTaskId,
          completionCount: state.completions.filter(
            (completion) => completion.localDate === openDay.date && completion.taskId === task.id
          ).length,
          points: toQuestRowPoints(options),
          options,
        };
      });

    groups.push({
      stat,
      required: openDay.requiredCompletions[stat],
      completed: openDay.actualCompletions[stat],
      rows,
    });
  }

  return groups;
}

/**
 * The persisted application store (PRD §5, §2.2; decisions D7, D16). One composed store holds the
 * whole `AppState` and persists it after every mutation through `lib/storage`, writing `userState`
 * last. Mutations only delegate to the engine orchestrators (`completeTask`, `runRollover`,
 * `purchaseReward`); no game rule lives here. Rollover runs on load, when the tab becomes visible
 * again, and from a timer set for the next local midnight that is re-armed after every run. A failed
 * write keeps the in-memory state and sets `saveError`; the next successful write clears it. The
 * clock, timer, visibility target, root element, and id generator are parameters with browser
 * defaults so tests need no DOM.
 */
export function createAppStore(deps: AppDeps = {}): AppStore {
  const now = deps.now ?? (() => new Date());
  const setTimer = deps.setTimer ?? ((handler, delay) => setTimeout(handler, delay));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle));
  const visibility = deps.visibility === undefined ? defaultVisibility() : deps.visibility;
  const root = deps.root === undefined ? defaultRoot() : deps.root;
  const newId = deps.newId ?? defaultNewId;
  const today = (): string => toLocalDate(now());

  const loaded = loadState(today());
  const initial = toAppState(loaded.state);
  const { subscribe, set } = writable<AppState>(initial);
  const saveError = writable<StorageFailure | null>(null);

  let current = initial;
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
    saveError.set(failure !== undefined && !failure.ok ? failure.error : null);
  }

  function armMidnightTimer(): void {
    if (timer !== null) {
      clearTimer(timer);
    }

    timer = setTimer(runRollover, millisecondsUntilNextMidnight(now()));
  }

  function runRollover(): void {
    const rolled = engineRunRollover(current, today(), newId);
    commit(rolled.state);
    persist(rolled.state);
    armMidnightTimer();
  }

  function onVisibilityChange(): void {
    if (visibility !== null && visibility.visibilityState === 'visible') {
      runRollover();
    }
  }

  applyRank();
  runRollover();

  if (visibility !== null) {
    visibility.addEventListener('visibilitychange', onVisibilityChange);
  }

  const base: Readable<AppState> = { subscribe };
  const level = derived(base, (state) => levelOf(state.userState.lifetimeXP));
  const rank = derived(base, (state) => state.userState.rank);
  const levelRank = derived(base, (state) => levelRankOf(levelOf(state.userState.lifetimeXP)));
  const freezesLeft = derived(base, (state) =>
    Math.max(
      0,
      getRankConfig(state.userState.rank).freezesPerWeek - state.userState.freezesUsedThisWeek
    )
  );

  return {
    subscribe,
    saveError,
    level,
    levelProgress: derived(base, toLevelProgress),
    rank,
    levelRank,
    rankGate: derived(base, toRankGate),
    statXP: derived(base, (state) => state.userState.statXP),
    equippedTitle: derived(base, (state) => equippedTitleName(state.userState.equippedTitle)),
    streak: derived(base, (state) =>
      displayStreak(state.userState.currentStreak, hasCompletionToday(state))
    ),
    freezesLeft,
    questRows: derived(base, toQuestGroups),
    rewardPreview: derived(base, (state) =>
      selectRewardPreview(state.rewards, state.userState.wallet)
    ),
    penaltyStats: derived(base, (state) => {
      const openDay = openDayOf(state);

      if (openDay === undefined) {
        return [];
      }

      return STATS.filter((stat) => openDay.requiredCompletions[stat] === 2);
    }),
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
      const next: AppState = { ...current, tasks };

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
    rollover: runRollover,
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
