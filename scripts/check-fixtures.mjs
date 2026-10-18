/**
 * Fails if a committed prototype snapshot no longer matches a fresh dump.
 *
 * The snapshots under src/lib/fixtures are derived data: the prototypes own the
 * demo data, and these files only replay it. Nothing in the app reads the
 * prototypes at runtime, so a corrected prototype would otherwise leave a stale
 * snapshot in place and every visual diff would keep comparing against the old
 * values - which is exactly what happened to the Today heat strip and the
 * Rewards purchase log in PR #157.
 *
 * Run it in CI when the visual job exists; see the PR report.
 *
 * Usage: node scripts/check-fixtures.mjs
 */
import { TARGETS, readCommitted, serialise, withPrototypes } from './dump-fixtures.mjs';

const drifted = await withPrototypes(
  TARGETS.map((t) => t.name),
  async (pages, targets) => {
    const failures = [];

    for (const target of targets) {
      const fresh = serialise(await target.build(pages[target.name]));

      let committed;

      try {
        committed = await readCommitted(target.out);
      } catch {
        failures.push(
          `  ${target.out}: missing. Run: node scripts/dump-fixtures.mjs ${target.name}`
        );
        continue;
      }

      if (committed === fresh) {
        console.log(`ok    ${target.out}`);
        continue;
      }

      failures.push(
        `  ${target.out}: does not match a fresh dump of ${target.file}.\n` +
          `         Run: node scripts/dump-fixtures.mjs ${target.name}`
      );
    }

    return failures;
  }
);

if (drifted.length > 0) {
  console.error(`\nprototype fixtures are stale:\n${drifted.join('\n')}\n`);
  process.exit(1);
}

console.log('\nall prototype fixtures match a fresh dump');
