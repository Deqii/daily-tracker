/**
 * Dumps prototype demo data into src/lib/fixtures/*.json.
 *
 * Every snapshot is produced by *running* the prototype in Playwright and
 * reading what it rendered, never by hand-copying a literal. The prototypes are
 * the source of truth for demo data (UI Fidelity Contract), and hand-copying is
 * how the previous snapshots drifted: when `today.html`'s heat strip and
 * `rewards.html`'s purchase log were corrected in PR #157, the fixtures kept the
 * old values and every visual diff went on comparing against them.
 *
 * `scripts/check-fixtures.mjs` re-runs these builders and fails if a committed
 * snapshot no longer matches a fresh dump, so the drift is caught by a command
 * rather than by a pixel diff.
 *
 * Usage:
 *   node scripts/dump-fixtures.mjs                 # all snapshots
 *   node scripts/dump-fixtures.mjs history today   # a subset
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Must stay identical to FIXED_TIME in tests/visual/harness.ts. */
export const FIXED_TIME = new Date('2026-10-15T09:00:00+07:00');

/** Context options identical to tests/visual/harness.ts, so a dump is a render. */
const CONTEXT_OPTIONS = {
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
};

/* ----------------------------------------------------------------- builders */

/**
 * `history.html`'s own simulation. It ignores the balance gate, freezes and 2x
 * requirements, so it deliberately does NOT match what the engine would produce.
 * The visual diff needs the prototype's numbers, so they are snapshotted here and
 * replayed as fixture data.
 */
export async function buildHistory(page) {
  /* `D` and `EV` are globals declared by the prototype's own <script>. */
  /* eslint-disable no-undef */
  const snapshot = await page.evaluate(() => {
    const local = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      source: 'docs/prototype/history.html',
      note: 'Prototype simulation: ignores the balance gate, freezes and 2x requirements. Not engine output.',
      fixedTime: '2026-10-15T09:00:00+07:00',
      chips: {
        rank: document.getElementById('cRank').textContent,
        streak: document.getElementById('cStreak').textContent,
      },
      days: D.map((d) => ({
        index: d.i,
        date: local(d.date),
        mask: d.m,
        satisfiedStats: d.c,
        netPointsChange: d.net,
        lifetimeXPEnd: d.xp,
        levelEnd: d.L,
        rankEnd: d.rank,
        streakEnd: d.streak,
        events: d.ev.map((e) => ({ kind: e.k, title: e.t, subtitle: e.s })),
      })),
      events: EV.map((e) => ({
        kind: e.k,
        title: e.t,
        subtitle: e.s,
        dayIndex: e.d.i,
        date: local(e.d.date),
      })),
    };
  });
  /* eslint-enable no-undef */

  return snapshot;
}

/**
 * `rewards.html`'s demo data: `R` is the reward catalog with each card's
 * purchase count, `L` the purchase log with a relative day label per entry.
 * Both are top-level `let` bindings, so they are readable from the page's global
 * lexical scope even though they are not properties of `window`.
 */
export async function buildRewards(page) {
  /* eslint-disable no-undef */
  const snapshot = await page.evaluate(() => ({
    catalog: R.map((r) => ({ id: r.id, title: r.t, cost: r.c, bought: r.b })),
    purchases: L.map((e) => ({ title: e.t, cost: e.c, when: e.w })),
  }));
  /* eslint-enable no-undef */

  return {
    source: 'docs/prototype/rewards.html',
    note: 'Prototype demo data: R is the reward catalog with its purchase counts, L the purchase log with relative day labels. Not engine output.',
    fixedTime: '2026-10-15T09:00:00+07:00',
    totalSpent: snapshot.purchases.reduce((sum, e) => sum + e.cost, 0),
    catalog: snapshot.catalog,
    purchases: snapshot.purchases,
  };
}

/**
 * `today.html`'s heat strip. The levels are not a top-level binding, they are
 * painted into `#heat` as `data-l` attributes, so they are read back out of the
 * rendered DOM, oldest cell first. `x` becomes `null`: a day with no completions
 * (DEVIATIONS.md note 1).
 */
export async function buildToday(page) {
  const raw = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#heat i')).map((el) => el.getAttribute('data-l'))
  );

  if (raw.length === 0) {
    throw new Error('today.html rendered no #heat cells');
  }

  return {
    source: 'docs/prototype/today.html',
    note: 'Prototype heat strip: one data-l per cell, oldest first. null is the red cell (data-l=x), a day with no completions. Not engine output.',
    fixedTime: '2026-10-15T09:00:00+07:00',
    heatLevels: raw.map((l) => (l === 'x' ? null : Number(l))),
  };
}

/* ------------------------------------------------------------------ targets */

export const TARGETS = [
  {
    name: 'history',
    file: 'history.html',
    out: join('src', 'lib', 'fixtures', 'history-snapshot.json'),
    build: buildHistory,
  },
  {
    name: 'rewards',
    file: 'rewards.html',
    out: join('src', 'lib', 'fixtures', 'rewards-snapshot.json'),
    build: buildRewards,
  },
  {
    name: 'today',
    file: 'today.html',
    out: join('src', 'lib', 'fixtures', 'today-snapshot.json'),
    build: buildToday,
  },
];

/* ------------------------------------------------------------------- runner */

/** Serialises a snapshot exactly as it is committed, so drift is byte drift. */
export function serialise(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/**
 * Loads each named prototype once and hands the pages to `fn`. One browser for
 * the whole run, so `check-fixtures.mjs` can compare all three snapshots without
 * paying for three launches.
 */
export async function withPrototypes(names, fn) {
  const targets = names.map((n) => TARGETS.find((t) => t.name === n));

  for (const [i, t] of targets.entries()) {
    if (t === undefined) {
      throw new Error(
        `unknown fixture snapshot "${names[i]}"; known: ${TARGETS.map((x) => x.name).join(', ')}`
      );
    }
  }

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext(CONTEXT_OPTIONS);
    const pages = {};

    for (const target of targets) {
      const page = await context.newPage();

      await page.clock.setFixedTime(FIXED_TIME);
      await page.goto(pathToFileURL(join(root, 'docs', 'prototype', target.file)).href);
      await page.waitForTimeout(200);

      pages[target.name] = page;
    }

    return await fn(pages, targets);
  } finally {
    await browser.close();
  }
}

export async function dumpAll(names) {
  return withPrototypes(names, async (pages, targets) => {
    const out = [];

    for (const target of targets) {
      const snapshot = await target.build(pages[target.name]);

      await mkdir(dirname(join(root, target.out)), { recursive: true });
      await writeFile(join(root, target.out), serialise(snapshot), 'utf8');

      out.push({ name: target.name, path: target.out, snapshot });
    }

    return out;
  });
}

export async function readCommitted(out) {
  return readFile(join(root, out), 'utf8');
}

export { root };

/* --------------------------------------------------------------------- main */

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const names = process.argv.slice(2);
  const written = await dumpAll(names.length > 0 ? names : TARGETS.map((t) => t.name));

  for (const { name, path, snapshot } of written) {
    const detail =
      'days' in snapshot
        ? `${snapshot.days.length} days, ${snapshot.events.length} events`
        : 'purchases' in snapshot
          ? `${snapshot.purchases.length} purchases, total ${snapshot.totalSpent}`
          : `${snapshot.heatLevels.length} heat cells`;

    console.log(`wrote ${detail} to ${path} (${name})`);
  }
}
