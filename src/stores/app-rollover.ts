import type { AppState } from '../engine/state';
import { runRollover as engineRunRollover } from '../engine/run-rollover';
import {
  clearPenaltyNotice,
  mergePenaltyNotices,
  writePenaltyNotice,
  type PenaltyNotice,
} from '../lib/penalty-notice';
import type { LocalDate, MilestoneEvent } from '../lib/types';

export interface RolloverDeps {
  readonly getState: () => AppState;
  readonly getToday: () => LocalDate;
  readonly newId: () => string;
  readonly getPendingPenaltyNotice: () => PenaltyNotice | null;
  readonly setPendingPenaltyNotice: (notice: PenaltyNotice | null) => void;
  readonly commit: (state: AppState) => void;
  readonly persist: (state: AppState) => void;
  readonly armMidnightTimer: () => void;
}

export interface RolloverController {
  run(): void;
  acknowledge(): void;
}

/**
 * Wires the pure rollover and penalty-notice rules to the store's commit/persist callbacks.
 * The notice is written before the game state so a crash between the two writes is deduplicated
 * on the next rollover (D24).
 */
export function createRolloverController(deps: RolloverDeps): RolloverController {
  function run(): void {
    const rolled = engineRunRollover(deps.getState(), deps.getToday(), deps.newId);

    if (rolled.penaltyNotice !== null) {
      const pending = deps.getPendingPenaltyNotice();
      const merged = mergePenaltyNotices(pending, rolled.penaltyNotice);

      if (merged !== pending) {
        deps.setPendingPenaltyNotice(merged);

        if (merged !== null) {
          writePenaltyNotice(merged);
        }
      }
    }

    deps.commit(rolled.state);
    deps.persist(rolled.state);
    deps.armMidnightTimer();
  }

  function acknowledge(): void {
    const notice = deps.getPendingPenaltyNotice();

    if (notice === null) {
      return;
    }

    deps.setPendingPenaltyNotice(null);
    clearPenaltyNotice();

    if (notice.rankDowns.length === 0) {
      return;
    }

    const rankDownKeys = new Set(
      notice.rankDowns.map((down) => `${down.localDate}:${down.from}:${down.to}`)
    );
    let changed = false;
    const current = deps.getState();
    const milestoneEvents = current.milestoneEvents.map((event): MilestoneEvent => {
      if (
        event.type === 'rankDown' &&
        !event.seen &&
        rankDownKeys.has(`${event.localDate}:${event.from}:${event.to}`)
      ) {
        changed = true;
        return { ...event, seen: true };
      }

      return event;
    });

    if (changed) {
      const next: AppState = { ...current, milestoneEvents };

      deps.commit(next);
      deps.persist(next);
    }
  }

  return { run, acknowledge };
}
