import { writable, type Readable } from 'svelte/store';
import { toLocalDate } from '../lib/date';
import { loadState, write } from '../lib/storage';

export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme = 'dark';

const THEME_ATTRIBUTE = 'data-theme';

function readStoredTheme(today: string): Theme {
  const stored = loadState(today).state.theme;
  return stored === 'light' ? 'light' : 'dark';
}

function applyToDocument(theme: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

export interface ThemeStore extends Readable<Theme> {
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export function createThemeStore(today: () => string): ThemeStore {
  const initial = readStoredTheme(today());
  const { subscribe, set } = writable<Theme>(initial);
  let current = initial;
  applyToDocument(current);

  function persist(next: Theme): void {
    current = next;
    set(next);
    applyToDocument(next);
    // PRD 2.2: a failed write keeps the state in memory and never crashes.
    write('theme', next);
  }

  return {
    subscribe,
    setTheme(next) {
      if (next !== 'dark' && next !== 'light') {
        return;
      }
      persist(next);
    },
    toggle() {
      persist(current === 'dark' ? 'light' : 'dark');
    },
  };
}

export const theme = createThemeStore(() => toLocalDate(new Date()));
