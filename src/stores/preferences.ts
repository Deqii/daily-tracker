import { writable, type Readable } from 'svelte/store';
import {
  MOTION_PREFERENCE_KEY,
  SOUND_PREFERENCE_KEY,
  readPreference,
  writePreference,
} from '../lib/storage';

export type MotionPreference = 'on' | 'off';
export type SoundPreference = 'on' | 'off';

export interface PreferenceStore<T extends string> extends Readable<T> {
  setPreference: (value: T) => void;
  toggle: () => void;
}

interface PreferenceDeps {
  readonly read?: (key: string) => string | null;
  readonly write?: (key: string, value: string) => void;
  readonly reducedMotion?: () => boolean;
  readonly applyMotion?: (value: MotionPreference) => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function applyMotionToDocument(value: MotionPreference): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.motion = value;
  }
}

/**
 * The animation switch (DEVIATIONS.md Q2). The stored value is the explicit
 * preference; the effective value is off when the OS asks for reduced motion,
 * exactly as `settings.html` computes `motionOn`. The document attribute is what
 * the global motion stylesheet reads.
 */
export function createMotionPreference(
  deps: PreferenceDeps = {}
): PreferenceStore<MotionPreference> {
  const read = deps.read ?? readPreference;
  const write =
    deps.write ??
    ((key: string, value: string): void => {
      writePreference(key, value);
    });
  const reduced = deps.reducedMotion ?? prefersReducedMotion;
  const apply = deps.applyMotion ?? applyMotionToDocument;
  const initial: MotionPreference =
    read(MOTION_PREFERENCE_KEY) === 'off' || reduced() ? 'off' : 'on';
  const { subscribe, set } = writable<MotionPreference>(initial);
  let current = initial;

  apply(current);

  function persist(next: MotionPreference): void {
    current = next;
    set(next);
    apply(next);
    write(MOTION_PREFERENCE_KEY, next);
  }

  return {
    subscribe,
    setPreference(next) {
      if (next === 'off' || next === 'on') persist(next);
    },
    toggle() {
      persist(current === 'on' ? 'off' : 'on');
    },
  };
}

/** The title-equip sound switch, stored locally and defaulting to off (Q2). */
export function createSoundPreference(
  deps: Pick<PreferenceDeps, 'read' | 'write'> = {}
): PreferenceStore<SoundPreference> {
  const read = deps.read ?? readPreference;
  const write =
    deps.write ??
    ((key: string, value: string): void => {
      writePreference(key, value);
    });
  const initial: SoundPreference = read(SOUND_PREFERENCE_KEY) === 'on' ? 'on' : 'off';
  const { subscribe, set } = writable<SoundPreference>(initial);
  let current = initial;

  function persist(next: SoundPreference): void {
    current = next;
    set(next);
    write(SOUND_PREFERENCE_KEY, next);
  }

  return {
    subscribe,
    setPreference(next) {
      if (next === 'off' || next === 'on') persist(next);
    },
    toggle() {
      persist(current === 'on' ? 'off' : 'on');
    },
  };
}

export const motionPreference = createMotionPreference();
export const soundPreference = createSoundPreference();
