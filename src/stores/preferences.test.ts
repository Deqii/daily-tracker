import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { MOTION_PREFERENCE_KEY, SOUND_PREFERENCE_KEY } from '../lib/storage';
import { createMotionPreference, createSoundPreference } from './preferences';

function recorder(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: { key: string; value: string }[] = [];
  const applied: string[] = [];

  return {
    writes,
    applied,
    read: (key: string): string | null => values.get(key) ?? null,
    write: (key: string, value: string): void => {
      writes.push({ key, value });
      values.set(key, value);
    },
    applyMotion: (value: string): void => {
      applied.push(value);
    },
  };
}

describe('createMotionPreference', () => {
  it('defaults on and applies the document attribute', () => {
    const deps = recorder();
    const store = createMotionPreference({ ...deps, reducedMotion: () => false });

    expect(get(store)).toBe('on');
    expect(deps.applied).toEqual(['on']);
  });

  it('reads an explicit off preference', () => {
    const deps = recorder({ [MOTION_PREFERENCE_KEY]: 'off' });
    const store = createMotionPreference({ ...deps, reducedMotion: () => false });

    expect(get(store)).toBe('off');
  });

  it('is off when the OS prefers reduced motion', () => {
    const deps = recorder();
    const store = createMotionPreference({ ...deps, reducedMotion: () => true });

    expect(get(store)).toBe('off');
  });

  it('persists and applies a toggle', () => {
    const deps = recorder();
    const store = createMotionPreference({ ...deps, reducedMotion: () => false });

    store.toggle();

    expect(get(store)).toBe('off');
    expect(deps.applied).toEqual(['on', 'off']);
    expect(deps.writes).toEqual([{ key: MOTION_PREFERENCE_KEY, value: 'off' }]);
  });
});

describe('createSoundPreference', () => {
  it('defaults off and persists an explicit on', () => {
    const deps = recorder();
    const store = createSoundPreference(deps);

    expect(get(store)).toBe('off');

    store.setPreference('on');

    expect(get(store)).toBe('on');
    expect(deps.writes).toEqual([{ key: SOUND_PREFERENCE_KEY, value: 'on' }]);
  });

  it('reads a stored on value', () => {
    const deps = recorder({ [SOUND_PREFERENCE_KEY]: 'on' });

    expect(get(createSoundPreference(deps))).toBe('on');
  });
});
