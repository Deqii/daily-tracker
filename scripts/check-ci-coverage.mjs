import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Guard the shard split in .github/ci-shards.json.
 *
 * Every visual test must run in exactly one required shard, unless it matches
 * one of the `informational` grep patterns (pages that are not ported yet).
 * A shard that silently drops a file would otherwise turn a required check
 * green without running the test.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const CONFIG = fileURLToPath(new URL('../.github/ci-shards.json', import.meta.url));

const SHARD_FILES = new Set(['fidelity.spec.ts', 'health.spec.ts']);

function splitArgs(input) {
  const args = [];
  let current = '';
  let quote = null;
  let started = false;

  for (const char of input) {
    if (quote !== null) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (started || current.length > 0) {
        args.push(current);
        current = '';
        started = false;
      }
      continue;
    }

    current += char;
    started = true;
  }

  if (quote !== null) throw new Error(`unbalanced quote in shard args: ${input}`);
  if (started || current.length > 0) args.push(current);

  return args;
}

function listTests(args) {
  const result = spawnSync(process.execPath, [CLI, 'test', ...args, '--list', '--reporter=json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`playwright --list failed for: ${args.join(' ')}`);
  }

  const report = JSON.parse(result.stdout);
  const tests = [];

  const walk = (suites, titles) => {
    for (const suite of suites) {
      const isFileRoot = /[.](spec|test)[.][cm]?[jt]s$/.test(suite.title ?? '');
      const next = suite.title && !isFileRoot ? [...titles, suite.title] : titles;
      for (const spec of suite.specs ?? []) {
        tests.push({
          file: spec.file,
          title: [...next, spec.title].join(' › '),
        });
      }
      if (suite.suites) walk(suite.suites, next);
    }
  };

  walk(report.suites ?? [], []);

  return tests;
}

function id(test) {
  return `${test.file} :: ${test.title}`;
}

function matches(pattern, test) {
  return new RegExp(pattern).test(test.title);
}

function main() {
  let config;
  try {
    config = JSON.parse(readFileSync(CONFIG, 'utf8'));
  } catch (error) {
    console.error(`check:ci-coverage: cannot read ${CONFIG}: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(config.shards) || !Array.isArray(config.informational)) {
    console.error(
      'check:ci-coverage: ci-shards.json must have `shards` and `informational` arrays'
    );
    process.exit(1);
  }

  const all = listTests([]);
  const covered = new Set();
  const shardCounts = [];

  for (const shard of config.shards) {
    if (typeof shard.name !== 'string' || typeof shard.args !== 'string') {
      console.error('check:ci-coverage: every shard needs a string `name` and `args`');
      process.exit(1);
    }

    const tests = listTests(splitArgs(shard.args));
    shardCounts.push({ name: shard.name, count: tests.length });

    for (const test of tests) covered.add(id(test));
  }

  const informational = new Set();
  const unmatchedPatterns = [];

  for (const pattern of config.informational) {
    let matched = 0;

    for (const test of all) {
      if (!SHARD_FILES.has(test.file)) continue;
      if (!matches(pattern, test)) continue;
      matched += 1;
      informational.add(id(test));
    }

    if (matched === 0) unmatchedPatterns.push(pattern);
  }

  const uncovered = all.filter((test) => !covered.has(id(test)) && !informational.has(id(test)));

  console.log('tests per shard:');
  for (const shard of shardCounts) console.log(`  ${shard.name}: ${shard.count}`);
  console.log(`  informational: ${informational.size}`);
  console.log(`  total: ${all.length}`);

  let failed = false;

  if (uncovered.length > 0) {
    failed = true;
    console.error(`\nuncovered tests (${uncovered.length}):`);
    for (const test of uncovered) console.error(`  - ${id(test)}`);
  }

  if (unmatchedPatterns.length > 0) {
    failed = true;
    console.error('\ninformational patterns that matched no test:');
    for (const pattern of unmatchedPatterns) console.error(`  - ${pattern}`);
  }

  if (failed) {
    console.error('\ncheck:ci-coverage failed.');
    process.exit(1);
  }

  console.log('\ncheck:ci-coverage passed.');
}

main();
