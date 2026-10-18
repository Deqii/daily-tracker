import { mount } from 'svelte';
import './app.css';

/**
 * The app mounts into `<body>` itself, not into a wrapper element (UI Revamp
 * Issue 2): `docs/prototype/today.html` has `#fx`, `.scan`, `header`, `main` and
 * `.toast` as direct children of `<body>`, and the fidelity test compares DOM
 * paths, so a wrapper would put every one of the app's elements a level deeper
 * than the prototype's.
 */
const target = document.body;

if (!target) {
  throw new Error('Mount target <body> not found');
}

// Visual-diff fixtures (`?fixture=today|tasks|rewards|history|settings`). The
// condition folds to `false` in a production build, so Rollup drops the import
// and none of the fixture data reaches the bundle.
//
// This runs BEFORE `App.svelte` is imported, which has to be a dynamic import
// for that to hold: `stores/app.ts` creates the store at module scope and
// `loadState()` reads `localStorage` the moment it is evaluated. With a static
// import the store would be built from an empty storage, `?fixture=` would seed
// localStorage too late to be seen, and every page would render its first-run
// defaults instead of the prototype's numbers.
if (import.meta.env.DEV || import.meta.env.MODE === 'visual') {
  const { applyFixture } = await import('./lib/fixtures');
  applyFixture();
}

const { default: App } = await import('./App.svelte');

const app = mount(App, { target });

export default app;
