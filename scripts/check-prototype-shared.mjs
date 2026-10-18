/**
 * Proves the five prototypes still agree on the rules they share.
 *
 * `docs/prototype/*.html` are edited by hand, one file at a time, and each one
 * carries its own copy of the token blocks and of the shell, header, panel and
 * boot rules. Nothing stopped a `--ease` or a `padding` from being corrected in
 * `today.html` and quietly left behind in the other four. The symptom only shows
 * up later, as a page that cannot match the app: `check-ui-css` compares the app
 * against `today.html` alone, so drift between the other four is invisible to it
 * and invisible to a pixel diff too (whichever page the harness happens to
 * capture, it captures against one reference).
 *
 * This script parses all five `<style>` blocks with the same tokenizer
 * `check-ui-css.mjs` uses, pulls out the rules every page is supposed to share,
 * normalises whitespace, quote style and leading zeros, and compares them. It
 * prints the reference value, the offending value, and which file carries the
 * odd one out, and exits non-zero.
 *
 * Only the shared rules are compared. Page-level rules are meant to differ: the
 * `main` grid, `.stats`, `.sep`, `.ranks`, the History table cells, each page's
 * own `.drawer` sizing and Today's `.stat`/`.rw` bracket sizing.
 *
 * Node built-ins only. Usage: node scripts/check-prototype-shared.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGES = ['today', 'tasks', 'rewards', 'history', 'settings'];
const REFERENCE = PAGES[0];

/* ------------------------------------------------------------------ parsing */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function parse(css) {
  const records = [];
  const stack = [];
  let buffer = '';
  let i = 0;

  while (i < css.length) {
    const c = css[i];

    if (c === '{') {
      stack.push({ selector: collapse(buffer), start: i + 1 });
      buffer = '';
    } else if (c === '}') {
      buffer = '';
      const frame = stack.pop();

      if (frame !== undefined) {
        records.push({
          context: stack.map((f) => f.selector).join(' / '),
          selector: frame.selector,
          declarations: css.slice(frame.start, i),
        });
      }
    } else if (c === ';') {
      const atRule = collapse(buffer);

      if (atRule.startsWith('@')) {
        records.push({
          context: stack.length > 0 ? stack[stack.length - 1].selector : '',
          selector: atRule,
          declarations: '',
        });
      }

      buffer = '';
    } else {
      buffer += c;
    }

    i += 1;
  }

  return records;
}

/* --------------------------------------------------------------- normalising */

const unquote = (s) => s.replace(/'([^']*)'/g, '$1').replace(/"([^"]*)"/g, '$1');

const collapse = (s) => unquote(s.replace(/\s+/g, ' ').trim());

const condition = (s) => unquote(s).replace(/\s+/g, '').toLowerCase();

function normaliseNumbers(text) {
  return text.replace(/(?<![\w#.-])(\d*)\.(\d+)/g, (match, int, frac) => {
    const trimmed = frac.replace(/0+$/, '');

    if (trimmed.length === 0) return int === '' ? '0' : int;

    return `${int === '0' ? '' : int}.${trimmed}`;
  });
}

function declarations(text) {
  return text
    .split(';')
    .map((d) =>
      normaliseNumbers(
        collapse(d)
          .replace(/(^|[^:]):\s+/, '$1:')
          .replace(/\s*,\s*/g, ',')
          .replace(/\s*!\s*important/g, '!important')
          .replace(/\s*([+*/])\s*/g, '$1')
      )
    )
    .filter((d) => d.length > 0);
}

function selectorList(selector) {
  return selector
    .split(',')
    .map((s) => collapse(s))
    .filter((s) => s.length > 0);
}

/* ------------------------------------------------------------ what we compare */

/**
 * The rules every page carries, as `{ context, selector }` pairs.
 *
 * `context` is `''` at the top level or the media condition. Combined selectors
 * are expanded per selector, because a page may group `.panel,.drawer` where
 * another writes the two rules separately while still applying the same
 * declarations to the same elements. `occurrence` is 1-based and addresses a
 * selector a page declares more than once, such as `.panel`: the shared surface
 * and then the default padding.
 */
const RULES = [
  // Design tokens: both blocks end with `color-scheme`.
  { context: '', selector: ':root' },
  { context: '', selector: '[data-theme=light]' },

  // base.css
  { context: '', selector: '*' },
  { context: '', selector: 'body' },
  { context: '', selector: ':focus-visible' },

  // layers.css
  { context: '', selector: 'body::before' },
  { context: '', selector: 'body::after' },
  { context: '', selector: '#fx' },

  // panel.css
  // `.penalty`, `.stat` and `.rw` appear as bare selectors only in `today.html`
  // (it assigns their `--bc`), so they are page rules and are not compared here.
  // Their `::before` half is shared: all five carry the one bracket rule.
  { context: '', selector: '.panel' },
  { context: '', selector: '.drawer' },
  { context: '', selector: '.panel', occurrence: 2 },
  { context: '', selector: '@property --arm' },
  { context: '', selector: '.panel::before' },
  { context: '', selector: '.drawer::before' },
  { context: '', selector: '.penalty::before' },
  { context: '', selector: '.stat::before' },
  { context: '', selector: '.rw::before' },
  { context: '@keyframes brk-in', selector: 'from' },
  { context: '@keyframes brk-in', selector: 'to' },
  { context: '@keyframes brk-breathe', selector: 'from' },
  { context: '@keyframes brk-breathe', selector: 'to' },

  // boot.css
  { context: '', selector: '.boot' },
  { context: '', selector: '.scan' },
  { context: '@keyframes boot', selector: 'from' },
  { context: '@keyframes boot', selector: 'to' },
  { context: '@keyframes scan', selector: 'from' },
  { context: '@keyframes scan', selector: 'to' },

  // header.css
  { context: '', selector: 'header' },
  { context: '', selector: '.logo' },
  { context: '', selector: 'nav' },
  { context: '', selector: 'nav a' },
  { context: '', selector: 'nav a:hover' },
  { context: '', selector: 'nav a[aria-current]' },
  { context: '', selector: 'nav a[aria-current]::after' },
  { context: '', selector: '.chips' },
  { context: '', selector: '.chip' },
  { context: '', selector: '.chip span' },
  { context: '', selector: '.coin' },
  { context: '@media(max-width:700px)', selector: 'header' },
  { context: '@media(max-width:700px)', selector: 'nav' },
  { context: '@media(max-width:700px)', selector: '.logo' },
  { context: '@media(max-width:700px)', selector: '.chips' },
  { context: '@media(max-width:700px)', selector: '.chip' },
  { context: '@media(max-width:380px)', selector: '.chips .chip:first-child' },

  // motion.css
  { context: '@media(prefers-reduced-motion:reduce)', selector: '*' },
  { context: '@media(prefers-reduced-motion:reduce)', selector: '*::before' },
  { context: '@media(prefers-reduced-motion:reduce)', selector: '*::after' },
  { context: '@media(prefers-reduced-motion:reduce)', selector: '#fx' },
  { context: '@media(prefers-reduced-motion:reduce)', selector: '.scan' },
  { context: '', selector: '[data-motion=off] *' },
  { context: '', selector: '[data-motion=off] *::before' },
  { context: '', selector: '[data-motion=off] *::after' },
  { context: '', selector: '[data-motion=off] #fx' },
  { context: '', selector: '[data-motion=off] .scan' },
];

/* ------------------------------------------------------------------ indexing */

function indexAll(records) {
  const map = new Map();

  for (const record of records) {
    const ctx = record.context === '' ? '' : condition(record.context);

    if (record.context !== '' && record.selector.startsWith('@')) continue;
    if (record.context === '' && record.selector.startsWith('@') && record.declarations === '')
      continue;

    for (const selector of selectorList(record.selector)) {
      const key = `${ctx}|${selector}`;

      if (!map.has(key)) map.set(key, []);

      map.get(key).push(declarations(record.declarations));
    }
  }

  return map;
}

function block(map, key, occurrence) {
  const blocks = map.get(key);

  if (blocks === undefined) return undefined;

  return blocks[(occurrence ?? 1) - 1] ?? null;
}

function label(rule) {
  const where = rule.context === '' ? rule.selector : `${rule.context} { ${rule.selector} }`;
  const nth = rule.occurrence === undefined ? '' : ` (block ${rule.occurrence})`;

  return `${where}${nth}`;
}

/** One line per declaration difference, in the form the report reads best. */
function diff(expected, actual) {
  const lines = [];

  for (const d of expected) if (!actual.includes(d)) lines.push(`        - ${d}`);

  for (const d of actual) if (!expected.includes(d)) lines.push(`        + ${d}`);

  return lines;
}

/* ---------------------------------------------------------------------- main */

const pages = {};

for (const page of PAGES) {
  const html = readFileSync(join('docs', 'prototype', `${page}.html`), 'utf8');
  const match = html.match(/<style>([\s\S]*?)<\/style>/);

  if (match === null) {
    console.error(`\n${page}.html has no <style> block; the check itself is out of date\n`);
    process.exit(1);
  }

  pages[page] = indexAll(parse(stripComments(match[1])));
}

const failures = [];
const seen = new Set();

for (const rule of RULES) {
  const ctx = rule.context === '' ? '' : condition(rule.context);
  const key = `${ctx}|${rule.selector}`;
  const occurrence = rule.occurrence ?? 1;
  const seenKey = `${key}#${occurrence}`;

  if (seen.has(seenKey)) continue;

  seen.add(seenKey);

  const expected = block(pages[REFERENCE], key, occurrence);

  if (expected === undefined) {
    failures.push(
      `${label(rule)}\n      not found in ${REFERENCE}.html; the check itself is out of date`
    );
    continue;
  }

  for (const page of PAGES) {
    const actual = block(pages[page], key, occurrence);

    if (actual === undefined) {
      failures.push(`${label(rule)}\n      missing from ${page}.html`);
      continue;
    }

    if (actual === null) {
      failures.push(`${label(rule)}\n      ${page}.html has fewer declaration blocks`);
      continue;
    }

    const lines = diff(expected, actual);

    if (lines.length > 0) {
      failures.push(
        `${label(rule)}\n      ${page}.html differs from ${REFERENCE}.html\n${lines.join('\n')}`
      );
    }
  }
}

/**
 * Today used to style `.chip b`, and its label read "Streak minggu ini". Neither
 * survives into the app, and a rule or a label can come back unnoticed in one
 * file. Both are part of the shared header, so both are checked here.
 */
const todayHtml = readFileSync(join('docs', 'prototype', `${REFERENCE}.html`), 'utf8');

if (todayHtml.includes('<span>Streak</span>') === false) {
  failures.push(
    'header chip label\n      today.html must show <span>Streak</span>, not the old "Streak minggu ini"'
  );
}

for (const page of PAGES) {
  const html = readFileSync(join('docs', 'prototype', `${page}.html`), 'utf8');

  if (/<span>\s*Streak\s*<\/span>/.test(html) === false) {
    failures.push(`header chip label\n      ${page}.html must show <span>Streak</span>`);
  }

  if (block(pages[page], '|.chip b', 1) !== undefined) {
    failures.push(
      `.chip b\n      ${page}.html has a .chip b rule; the prototypes no longer style it`
    );
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} shared rules disagree across the prototypes:\n`);

  for (const failure of failures) console.error(`    ${failure}`);

  console.error(
    `\nthe ${PAGES.length} prototypes must carry one copy of every shared rule; ${REFERENCE}.html is the reference\n`
  );
  process.exit(1);
}

console.log(`ok    ${seen.size} shared rules are identical across ${PAGES.length} prototypes`);
