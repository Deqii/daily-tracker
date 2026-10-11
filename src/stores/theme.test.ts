import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, STORAGE_KEYS } from '../lib/storage';
import { createThemeStore, type Theme, type ThemeStore } from './theme';

class FakeStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function setup(seed?: Theme): { storage: FakeStorage; setAttribute: ReturnType<typeof vi.fn> } {
  const storage = new FakeStorage();

  if (seed) {
    storage.setItem(STORAGE_KEYS.schemaVersion, JSON.stringify(SCHEMA_VERSION));
    storage.setItem(STORAGE_KEYS.theme, JSON.stringify(seed));
  }

  vi.stubGlobal('localStorage', storage);
  const setAttribute = vi.fn();
  vi.stubGlobal('document', { documentElement: { setAttribute } });

  return { storage, setAttribute };
}

function currentTheme(store: ThemeStore): Theme {
  let value: Theme = 'dark';
  const unsubscribe = store.subscribe((next) => (value = next));
  unsubscribe();
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme store', () => {
  it('defaults to dark and applies it when nothing is stored', () => {
    const { setAttribute } = setup();
    const store = createThemeStore(() => '2026-10-11');

    expect(currentTheme(store)).toBe('dark');
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('reads a persisted light theme and applies it', () => {
    const { setAttribute } = setup('light');
    const store = createThemeStore(() => '2026-10-11');

    expect(currentTheme(store)).toBe('light');
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });

  it('persists and applies the theme set through setTheme', () => {
    const { storage, setAttribute } = setup();
    const store = createThemeStore(() => '2026-10-11');

    store.setTheme('light');

    expect(currentTheme(store)).toBe('light');
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.theme) ?? '')).toBe('light');
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });

  it('toggles between dark and light and persists each change', () => {
    const { storage, setAttribute } = setup('dark');
    const store = createThemeStore(() => '2026-10-11');

    store.toggle();
    expect(currentTheme(store)).toBe('light');
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.theme) ?? '')).toBe('light');

    store.toggle();
    expect(currentTheme(store)).toBe('dark');
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.theme) ?? '')).toBe('dark');
    expect(setAttribute).toHaveBeenLastCalledWith('data-theme', 'dark');
  });

  it('ignores an invalid theme value', () => {
    const { setAttribute } = setup();
    const store = createThemeStore(() => '2026-10-11');

    store.setTheme('invalid' as Theme);

    expect(currentTheme(store)).toBe('dark');
    expect(setAttribute).toHaveBeenCalledTimes(1);
  });

  it('keeps the state in memory when the write fails', () => {
    const { storage, setAttribute } = setup();
    const store = createThemeStore(() => '2026-10-11');

    const failingSet = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });

    expect(() => store.setTheme('light')).not.toThrow();
    expect(currentTheme(store)).toBe('light');
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'light');

    failingSet.mockRestore();
  });
});
