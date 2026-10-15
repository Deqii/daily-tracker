import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Mount target #app not found');
}

// Visual-diff fixtures (`?fixture=today|tasks|rewards|history|settings`). The
// condition folds to `false` in a production build, so Rollup drops the import
// and none of the fixture data reaches the bundle.
if (import.meta.env.DEV || import.meta.env.MODE === 'visual') {
  const { applyFixture } = await import('./lib/fixtures');
  applyFixture();
}

const app = mount(App, { target });

export default app;
