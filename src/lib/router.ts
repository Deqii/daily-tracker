import { readable } from 'svelte/store';

export type Route = 'today' | 'tasks' | 'rewards' | 'history' | 'settings';

export function normalizeRoute(hash: string): Route {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = stripped.startsWith('/') ? stripped.slice(1) : stripped;
  const lower = path.toLowerCase();
  
  switch (lower) {
    case 'today':
      return 'today';
    case 'tasks':
      return 'tasks';
    case 'rewards':
      return 'rewards';
    case 'history':
      return 'history';
    case 'settings':
      return 'settings';
    default:
      return 'today';
  }
}

function getCurrentRoute(): Route {
  if (typeof window === 'undefined') {
    return 'today';
  }
  return normalizeRoute(window.location.hash || '#/today');
}

export const currentRoute = readable<Route>('today', (set) => {
  const update = () => set(getCurrentRoute());
  if (typeof window !== 'undefined') {
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }
  return () => {};
});
