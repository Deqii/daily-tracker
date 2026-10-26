import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Thin wrapper around the Playwright CLI for the two convenience scripts in
 * package.json:
 *
 *   npm run test:visual:page -- today
 *   npm run test:visual:quick
 *
 * Playwright's `--grep` matches test titles, not file names, and the state
 * mechanics in `today-states-interactions.spec.ts` have titles that do not
 * contain "today". Hence the extra alternatives in TODAY_TITLES.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CLI = fileURLToPath(new URL('../../node_modules/@playwright/test/cli.js', import.meta.url));
const PAGES = ['today', 'tasks', 'rewards', 'history', 'settings'];
const TODAY_TITLES =
  'today|tier picker|engine-derived lines|title and empty states|overlays and notices';

function run(args) {
  const result = spawnSync(process.execPath, [CLI, 'test', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.error !== undefined) throw result.error;

  process.exit(result.status ?? 1);
}

const mode = process.argv[2];

if (mode === 'quick') {
  run([
    'tests/visual/fidelity.spec.ts',
    'tests/visual/health.spec.ts',
    'tests/visual/shell.spec.ts',
    'tests/visual/today-interactions.spec.ts',
    'tests/visual/today-states.spec.ts',
    'tests/visual/today-states-interactions.spec.ts',
    'tests/visual/tasks-interactions.spec.ts',
    '--grep',
    `${TODAY_TITLES}|tasks`,
    '--grep-invert',
    'self-test|390|light',
  ]);
}

if (mode === 'page') {
  const page = process.argv[3];

  if (!PAGES.includes(page)) {
    console.error(`usage: npm run test:visual:page -- <${PAGES.join('|')}>`);
    process.exit(2);
  }

  const files = ['tests/visual/fidelity.spec.ts', 'tests/visual/health.spec.ts'];
  let grep = page;

  if (page === 'today') {
    files.push(
      'tests/visual/today-interactions.spec.ts',
      'tests/visual/today-states.spec.ts',
      'tests/visual/today-states-interactions.spec.ts'
    );
    grep = TODAY_TITLES;
  } else if (page === 'tasks') {
    files.push('tests/visual/tasks-interactions.spec.ts');
  }

  run([...files, '--grep', grep]);
}

console.error('usage: node tests/visual/run-suite.mjs <page|quick> [page-name]');
process.exit(2);
