/**
 * Fails if a build directory contains the prototype fixture marker.
 *
 * The visual harness builds with `--mode visual` so `?fixture=today` can seed
 * `localStorage`. The production build must not contain any of that: the
 * fixtures ship the prototypes' demo data, not the user's. `src/main.ts` gates
 * the import on the build mode, and this script is the proof that the gate
 * actually works - a manual look at `dist/` is not.
 *
 * The marker is the string `FIXTURE_MARKER` in `src/lib/fixtures/index.ts`.
 * It is referenced at runtime there, so it survives tree-shaking in a visual
 * build, which is what makes this check meaningful rather than vacuous.
 *
 * Usage: node scripts/assert-no-fixtures.mjs [dir]   (default: dist)
 * Exits 1 and lists every offending file when the marker is found.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

/** Must equal FIXTURE_MARKER in src/lib/fixtures/index.ts. */
const MARKER = 'DT_PROTOTYPE_FIXTURE_DO_NOT_SHIP';

/** Only text assets can carry the marker, and these are the ones Vite emits. */
const SCAN = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.webmanifest',
]);

function collect(dir) {
  const out = [];

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    const info = statSync(full);

    if (info.isDirectory()) {
      out.push(...collect(full));
    } else if (SCAN.has(extname(entry).toLowerCase())) {
      out.push(full);
    }
  }

  return out;
}

const target = resolve(process.argv[2] ?? 'dist');

if (!statSync(target, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`assert-no-fixtures: ${target} is not a directory`);
  process.exit(1);
}

const files = collect(target);
const offenders = files.filter((file) => readFileSync(file, 'utf8').includes(MARKER));

if (offenders.length > 0) {
  console.error(
    `assert-no-fixtures: FAILED. ${offenders.length} file(s) in ${relative(process.cwd(), target)} contain the fixture marker "${MARKER}":`
  );
  for (const file of offenders) console.error(`  ${relative(process.cwd(), file)}`);
  console.error('The production build must not ship the ?fixture= seeder.');
  process.exit(1);
}

console.log(
  `assert-no-fixtures: OK. ${files.length} text file(s) in ${relative(process.cwd(), target)} scanned, none contain "${MARKER}".`
);
