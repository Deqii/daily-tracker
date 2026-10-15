/**
 * Dumps the History prototype's simulation into src/lib/fixtures/history-snapshot.json.
 *
 * The prototype's `MASKS` walk ignores the balance gate, freezes and 2x
 * requirements, so it deliberately does NOT match what the engine would produce.
 * The visual diff needs the prototype's own numbers, so they are snapshotted
 * once here and replayed as fixture data. Do not regenerate these with the
 * engine; re-run this script if docs/prototype/history.html changes.
 *
 * Usage: node scripts/dump-history-fixture.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Must stay identical to FIXED_TIME in tests/visual/fidelity.spec.ts. */
const FIXED_TIME = new Date('2026-10-15T09:00:00+07:00');

const browser = await chromium.launch();
const page = await browser.newPage({
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});

await page.clock.setFixedTime(FIXED_TIME);
await page.goto(pathToFileURL(join(root, 'docs', 'prototype', 'history.html')).href);
await page.waitForTimeout(200);

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

await browser.close();

const out = join(root, 'src', 'lib', 'fixtures', 'history-snapshot.json');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

console.log(`wrote ${snapshot.days.length} days and ${snapshot.events.length} events to ${out}`);
