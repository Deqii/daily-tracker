/**
 * Proves the ported global CSS is still the prototypes' CSS.
 *
 * The UI Fidelity Contract asks for the rules in `src/styles/ui/*.css` and the
 * token blocks in `src/app.css` to be copied verbatim from
 * `docs/prototype/*.html`. "Verbatim" is not something a comment can enforce and
 * a pixel diff cannot localise: a changed `--ease` shows up as a 40 ms timing
 * shift in an animation that has already finished by the time anything is
 * captured, so every pixel still matches and the rule is silently wrong.
 *
 * This script reads `today.html`'s `<style>` block and the app's own CSS, pulls
 * the rules the shell owns out of both, normalises whitespace and comments, and
 * compares them. It prints what is missing and what differs, property by
 * property, and exits non-zero.
 *
 * `today.html` is the reference the issue names; the token blocks were verified
 * byte-identical across all five prototypes before this was written.
 *
 * Node built-ins only. Usage: node scripts/check-ui-css.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROTOTYPE = join('docs', 'prototype', 'today.html');
const APP_CSS = [join('src', 'app.css'), ...uiStylesheets()];

/* ------------------------------------------------------------------ parsing */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The scoping root the page stylesheets wrap their rules in (UI Revamp Issue 2).
 *
 * The prototypes are five standalone documents and the app has one global
 * stylesheet, so page rules are isolated with `@scope (body[data-page="today"])`.
 * `@scope` changes where a rule applies without changing what it says, so the
 * checker reads through it: a wrapped rule is compared against the prototype's
 * unwrapped rule, exactly as if the wrapper were not there.
 */
const SCOPE_ROOTS = ['@scope (body[data-page=today])'];

/**
 * Page-local keyframes, renamed with a `today-` prefix because `@keyframes`
 * names are global and another page's `spin` is a different animation. The
 * bodies are the prototype's; only the name moved. Every rename is listed in
 * `docs/prototype/DEVIATIONS.md` under "Mechanical renames".
 */
const KEYFRAME_RENAMES = ['spin', 'shine', 'blink', 'pen', 'pulse', 'fl', 'rg'];

/** `today-spin` -> `spin`, but only for a name on the rename list. */
function unrenameKeyframes(text) {
  return text.replace(new RegExp(`\\btoday-(${KEYFRAME_RENAMES.join('|')})\\b`, 'g'), '$1');
}

/** Drops the `@scope` wrappers from a context chain. */
function unscopeContext(context) {
  return context
    .split(' / ')
    .filter((segment) => !SCOPE_ROOTS.includes(segment))
    .join(' / ');
}

/**
 * Splits a stylesheet into `{ context, selector, declarations }` records.
 *
 * At-rules that hold rules (`@media`, `@keyframes`) keep their own text as
 * `context`; at-rules that hold declarations (`@property`) are records like any
 * other. Comments are removed first, so `{` and `}` inside them cannot shift the
 * nesting.
 */
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

/** `[data-motion='off']` and `[data-motion=off]` select the same elements. */
const unquote = (s) => s.replace(/'([^']*)'/g, '$1').replace(/"([^"]*)"/g, '$1');

const collapse = (s) => unquote(s.replace(/\s+/g, ' ').trim());

/** A media condition: `@media (max-width: 700px)` is `@media(max-width:700px)`. */
const condition = (s) => unrenameKeyframes(unquote(s)).replace(/\s+/g, '').toLowerCase();

/**
 * Numbers, with leading and trailing zeros removed: `0.15s` is `.15s` and
 * `.10` is `.1`. A hand-written stylesheet and a formatter disagree about which
 * to write, and that is not a fidelity difference.
 */
function normaliseNumbers(text) {
  return text.replace(/(?<![\w#.-])(\d*)\.(\d+)/g, (match, int, frac) => {
    const trimmed = frac.replace(/0+$/, '');

    if (trimmed.length === 0) return int === '' ? '0' : int;

    return `${int === '0' ? '' : int}.${trimmed}`;
  });
}

/**
 * One declaration per entry, with whitespace, quote style and leading zeros
 * normalised away.
 *
 * `--bg:#05070d` against `--bg: #05070d`, `0 0/48px 48px` against
 * `0 0 / 48px 48px` and `calc(var(--i,0)*var(--stagger) + 300ms)` against the
 * spaced form a formatter writes are all the same declaration. Nothing else is
 * touched, so a changed value, a changed unit or a dropped property all still
 * fail.
 *
 * `-` is deliberately left alone as an operator: it is both a sign and a
 * separator, and the values here use it as both.
 */
function declarations(text) {
  return unrenameKeyframes(text)
    .split(';')
    .map((d) =>
      normaliseNumbers(
        collapse(d)
          .replace(/(^|[^:]):\s+/, '$1:')
          .replace(/\s*,\s*/g, ',')
          .replace(/\s*!\s*important/g, '!important')
          .replace(/\s*([+*/])\s*/g, '$1')
          // Prettier pads a gradient's first argument onto its own line and
          // leaves `linear-gradient( 100deg,... )`; the prototype writes
          // `linear-gradient(100deg,...)`. Whitespace inside the parentheses is
          // the same difference of whitespace, not of value.
          .replace(/\(\s+/g, '(')
          .replace(/\s+\)/g, ')')
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
 * The rules the shell owns, as `{ context, selector }` pairs.
 *
 * `context` is `''` at the top level or the media/at-rule condition. Combined
 * selectors are expanded per selector, because the prototypes and the ported
 * stylesheets group them differently (`nav a:hover,nav a[aria-current]` in the
 * ported header against two separate rules in `today.html`) while applying the
 * same declarations to the same elements.
 *
 * Page-content rules are deliberately absent: `.panel` is here because Issue 1
 * owns the primitive, but the History table cells, `.cn`, `.ln`, `.ar` and `.mk`
 * belong to Issues 5-6 and are not the shell's to compare.
 *
 * Since Issue 2 the list also covers every page rule of `today.html`, read
 * through its `@scope` wrapper and with the `today-` keyframe prefix removed
 * (see `SCOPE_ROOTS` and `KEYFRAME_RENAMES`). Rules that appear more than once in
 * the prototype are addressed by `occurrence`.
 */
const RULES = [
  // Design tokens.
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
  // The prototype splits the surface from the default padding, so `.panel`
  // resolves in two blocks. Both are compared; occurrence 1 is the shared
  // `.panel,.drawer` surface, occurrence 2 the `.panel{padding:22px}` default.
  { context: '', selector: '.panel' },
  { context: '', selector: '.drawer' },
  { context: '', selector: '.panel', occurrence: 2 },
  { context: '', selector: '@property --arm' },
  { context: '', selector: '.panel', occurrence: 3 },
  { context: '', selector: '.penalty' },
  { context: '', selector: '.stat' },
  { context: '', selector: '.rw' },
  { context: '', selector: '.panel::before' },
  { context: '', selector: '.drawer::before' },
  { context: '', selector: '.penalty::before' },
  { context: '', selector: '.stat::before' },
  { context: '', selector: '.rw::before' },
  // Keyframes are compared one step at a time: the step bodies hold declarations,
  // and reading them as one flat string would only prove the braces line up.
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

  // today.css
  // today.html:75 assigns `--bc`, the corner-bracket colour. It follows the
  // shared `.panel,.penalty,.stat,.rw` block (occurrence 1, checked above), so
  // for `.stat` and `.penalty` this is occurrence 2.
  { context: '', selector: '.stat', occurrence: 2 },
  { context: '', selector: '.penalty', occurrence: 2 },
  { context: '', selector: '.penalty.clear', occurrence: 1 },
  { context: '', selector: 'main' },
  { context: '', selector: 'h2' },
  { context: '', selector: '.sub' },

  // Status window (today.html:86-100).
  { context: '', selector: '.status' },
  { context: '', selector: '.emblem' },
  { context: '', selector: '.emblem svg' },
  { context: '', selector: '.rank' },
  { context: '', selector: '.lv' },
  { context: '', selector: '.lv b' },
  { context: '', selector: '.title' },
  { context: '', selector: '.xpbar' },
  { context: '', selector: '.xpbar i' },
  { context: '', selector: '.xpbar i::after' },
  { context: '', selector: '.row' },
  { context: '', selector: '.pips' },
  { context: '', selector: '.pips i' },
  { context: '', selector: '.pips i.on' },
  { context: '', selector: '.pips i.today' },
  { context: '', selector: '.shield' },

  // Radar (today.html:101-110).
  { context: '', selector: '.radar-wrap' },
  { context: '', selector: '#radar' },
  { context: '', selector: '.legend' },
  { context: '', selector: '.legend s' },
  { context: '', selector: '.stats' },
  { context: '', selector: '.stat', occurrence: 3 },
  { context: '', selector: '.stat:hover' },
  { context: '', selector: '.stat small' },
  { context: '', selector: '.stat b' },
  { context: '', selector: '.stat .bar' },
  { context: '', selector: '.stat .bar i' },

  // Quest column (today.html:111-136).
  { context: '', selector: '.quest' },
  { context: '', selector: '.sys' },
  { context: '', selector: '.sys small' },
  { context: '', selector: '.sys p' },
  { context: '', selector: '.caret' },
  { context: '', selector: '.penalty', occurrence: 3 },
  { context: '', selector: '.penalty.clear', occurrence: 2 },
  { context: '', selector: '.penalty strong' },
  { context: '', selector: '.penalty.clear strong' },
  { context: '', selector: '.timer' },
  { context: '', selector: '.timer small' },
  { context: '', selector: '.qrow' },
  { context: '', selector: '.qrow:hover' },
  { context: '', selector: '.qrow:focus-visible' },
  { context: '', selector: '.box' },
  { context: '', selector: '.box svg' },
  { context: '', selector: '.qrow.done .box' },
  { context: '', selector: '.qrow.done .box svg' },
  { context: '', selector: '.qrow.done .nm' },
  { context: '', selector: '.nm' },
  { context: '', selector: '.nm small' },
  { context: '', selector: '.pts' },
  { context: '', selector: '.need' },
  { context: '', selector: '.qrow.done .need' },
  { context: '', selector: '.float' },
  { context: '', selector: '.ring' },

  // Bottom strip, rewards and toast (today.html:137-152).
  { context: '', selector: '.bottom' },
  { context: '', selector: '.heat' },
  { context: '', selector: '.heat i' },
  { context: '', selector: '.heat i:hover' },
  { context: '', selector: '.heat i[data-l=1]' },
  { context: '', selector: '.heat i[data-l=2]' },
  { context: '', selector: '.heat i[data-l=3]' },
  { context: '', selector: '.heat i[data-l=x]' },
  { context: '', selector: '.rewards' },
  { context: '', selector: '.rw', occurrence: 2 },
  { context: '', selector: '.rw .row b' },
  { context: '', selector: '.price' },
  { context: '', selector: '.rw .price' },
  { context: '', selector: '.rw .coin' },
  { context: '', selector: '.price .coin' },
  { context: '', selector: '.btn' },
  { context: '', selector: '.btn:hover' },
  { context: '', selector: '.btn:active' },
  { context: '', selector: '.btn[disabled]' },
  { context: '', selector: '.prog' },
  { context: '', selector: '.prog i' },
  { context: '', selector: '.toast' },
  { context: '', selector: '.toast.show' },
  { context: '', selector: '.toast button' },
  { context: '', selector: '.toast button:hover' },

  // Page media queries (today.html:153-154). The 700px block's header, nav,
  // logo, chips and chip rules are the shell's and are checked above; only the
  // two page rules of each block belong to the page.
  { context: '@media(max-width:1100px)', selector: 'main' },
  { context: '@media(max-width:1100px)', selector: '.quest' },
  { context: '@media(max-width:1100px)', selector: '.bottom' },
  { context: '@media(max-width:700px)', selector: 'main' },
  { context: '@media(max-width:700px)', selector: '.stats' },

  // Page keyframes, compared by the prototype's name (today.html:89, 96, 116,
  // 121-122, 134, 136).
  { context: '@keyframes spin', selector: 'to' },
  { context: '@keyframes shine', selector: '60%' },
  { context: '@keyframes blink', selector: '50%' },
  { context: '@keyframes pen', selector: '50%' },
  { context: '@keyframes pulse', selector: '50%' },
  { context: '@keyframes fl', selector: 'to' },
  { context: '@keyframes rg', selector: 'from' },
  { context: '@keyframes rg', selector: 'to' },
];

/* ------------------------------------------------------------------ indexing */

/**
 * `context + selector` -> every declaration block that rule name collects, in
 * source order.
 *
 * A stylesheet may legitimately declare the same selector twice: the prototypes
 * split `.panel,.drawer{...}` (surface) from `.panel{padding:22px}` (default
 * padding), so the cascade for `.panel` is the union of both. Reporting only
 * the first block would leave the second unguarded.
 */
function indexAll(records) {
  const map = new Map();

  for (const record of records) {
    const unwrapped = unscopeContext(record.context);
    const ctx = unwrapped === '' ? '' : condition(unwrapped);

    if (unwrapped !== '' && record.selector.startsWith('@')) continue;
    if (unwrapped === '' && record.selector.startsWith('@') && record.declarations === '') continue;

    for (const selector of selectorList(record.selector)) {
      const key = `${ctx}|${selector}`;

      if (!map.has(key)) map.set(key, []);

      map.get(key).push(declarations(record.declarations));
    }
  }

  return map;
}

/** Where a rule is expected to live, for the failure messages. */
function label(rule) {
  const where = rule.context === '' ? rule.selector : `${rule.context} { ${rule.selector} }`;
  const nth = rule.occurrence === undefined ? '' : ` (block ${rule.occurrence})`;

  return `${where}${nth}`;
}

function diff(expected, actual) {
  const missing = expected.filter((d) => !actual.includes(d));
  const added = actual.filter((d) => !expected.includes(d));
  const lines = [];

  for (const d of missing) lines.push(`      - ${d}`);

  for (const d of added) lines.push(`      + ${d}`);

  return lines;
}

/* ---------------------------------------------------------------------- main */

function uiStylesheets() {
  const dir = join('src', 'styles', 'ui');

  return readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .sort()
    .map((f) => join(dir, f));
}

const prototypeRecords = parse(
  stripComments(readFileSync(PROTOTYPE, 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1])
);
const appRecords = APP_CSS.flatMap((f) => parse(stripComments(readFileSync(f, 'utf8'))));

const allPrototype = indexAll(prototypeRecords);
const allApp = indexAll(appRecords);

/**
 * The Nth declaration block for a selector, 1-based. `occurrence` defaults to 1,
 * which is every rule the checker guarded before it could address a selector
 * that the prototypes declare more than once.
 */
function block(map, key, occurrence) {
  const blocks = map.get(key);

  if (blocks === undefined) return undefined;

  return blocks[(occurrence ?? 1) - 1] ?? null;
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

  const expected = block(allPrototype, key, occurrence);

  if (expected === undefined) {
    failures.push(
      `${label(rule)}\n      not found in ${PROTOTYPE}; the check itself is out of date`
    );
    continue;
  }

  const actual = block(allApp, key, occurrence);

  if (actual === undefined) {
    failures.push(`${label(rule)}\n      missing from the app CSS`);
    continue;
  }

  if (actual === null) {
    failures.push(`${label(rule)}\n      has fewer declaration blocks than ${PROTOTYPE}`);
    continue;
  }

  const lines = diff(expected, actual);

  if (lines.length > 0) {
    failures.push(`${label(rule)}\n${lines.join('\n')}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} of ${seen.size} ported rules do not match ${PROTOTYPE}:\n`);

  for (const failure of failures) console.error(`    ${failure}`);

  console.error('\nthe rules in src/app.css and src/styles/ui/*.css must stay verbatim\n');
  process.exit(1);
}

console.log(`ok    ${seen.size} ported rules match ${PROTOTYPE} verbatim`);
