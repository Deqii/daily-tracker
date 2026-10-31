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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROTOTYPES = {
  today: join('docs', 'prototype', 'today.html'),
  tasks: join('docs', 'prototype', 'tasks.html'),
  rewards: join('docs', 'prototype', 'rewards.html'),
  history: join('docs', 'prototype', 'history.html'),
};
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
const SCOPE_ROOTS = {
  today: '@scope (body[data-page=today])',
  tasks: '@scope (body[data-page=tasks])',
  rewards: '@scope (body[data-page=rewards])',
  history: '@scope (body[data-page=history])',
};

/**
 * Page-local keyframes, renamed with a `today-` prefix because `@keyframes`
 * names are global and another page's `spin` is a different animation. The
 * bodies are the prototype's; only the name moved. Every rename is listed in
 * `docs/prototype/DEVIATIONS.md` under "Mechanical renames".
 */
const KEYFRAME_RENAMES = {
  today: ['spin', 'shine', 'blink', 'pen', 'pulse', 'fl', 'rg', 'tiers-in'],
  tasks: ['flash', 'out'],
  rewards: ['flash', 'out', 'pop', 'cn', 'fl', 'shake'],
  history: ['draw', 'fade', 'mk'],
};

/** `today-spin` -> `spin` and `tasks-flash` -> `flash`, only for the rename lists. */
function unrenameKeyframes(text) {
  return text
    .replace(new RegExp(`\\btoday-(${KEYFRAME_RENAMES.today.join('|')})\\b`, 'g'), '$1')
    .replace(new RegExp(`\\btasks-(${KEYFRAME_RENAMES.tasks.join('|')})\\b`, 'g'), '$1')
    .replace(new RegExp(`\\brewards-(${KEYFRAME_RENAMES.rewards.join('|')})\\b`, 'g'), '$1')
    .replace(new RegExp(`\\bhistory-(${KEYFRAME_RENAMES.history.join('|')})\\b`, 'g'), '$1');
}

const SCOPE_ROOT_LIST = Object.values(SCOPE_ROOTS);

/** Drops the `@scope` wrappers from a context chain. */
function unscopeContext(context) {
  return context
    .split(' / ')
    .filter((segment) => !SCOPE_ROOT_LIST.includes(segment))
    .join(' / ');
}

/** The page whose `@scope` wrapper a context chain carries, if any. */
function pageOfContext(context) {
  for (const [page, root] of Object.entries(SCOPE_ROOTS)) {
    if (context.split(' / ').includes(root)) return page;
  }

  return null;
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
  { context: '', selector: '[data-rank=E]' },
  { context: '', selector: '[data-rank=D]' },
  { context: '', selector: '[data-rank=C]' },
  { context: '', selector: '[data-rank=B]' },
  { context: '', selector: '[data-rank=A]' },
  { context: '', selector: '[data-rank=S]' },

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
  { context: '@media(max-width:640px)', selector: '.panel::before' },
  { context: '@media(max-width:640px)', selector: '.drawer::before' },

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
  { context: '', selector: '.chip.rk' },
  { context: '', selector: '.chip.rk b' },
  { context: '', selector: '.coin' },
  { prototype: 'rewards', context: '', selector: '.coin.l' },
  { prototype: 'rewards', context: '', selector: '.coin.xl' },
  // The two-row header from 1023px down. `nav` is never hidden; the 700px
  // block only compacts the first row, so it is compared for header, logo and
  // chips, not for nav.
  { context: '@media(max-width:1023px)', selector: 'header' },
  { context: '@media(max-width:1023px)', selector: '.chips' },
  { context: '@media(max-width:1023px)', selector: 'nav' },
  { context: '@media(max-width:1023px)', selector: 'nav a' },
  { context: '@media(max-width:1023px)', selector: 'nav a[aria-current]::after' },
  { context: '@media(max-width:700px)', selector: 'header' },
  { context: '@media(max-width:700px)', selector: '.logo' },
  { context: '@media(max-width:700px)', selector: '.chips' },
  { context: '@media(max-width:700px)', selector: '.chip' },
  { context: '@media(max-width:380px)', selector: '.chips .chip:first-child' },

  // overlays.css (shared notices and overlays).
  { context: '', selector: '.ov' },
  { context: '', selector: '.ovp' },
  { context: '', selector: '.ovp small' },
  { context: '', selector: '.ovp p' },
  { context: '', selector: '.ovp .big' },
  { context: '', selector: '.ovp dl' },
  { context: '', selector: '.ovp dt' },
  { context: '', selector: '.ovp dd' },
  { context: '@keyframes ov-fade', selector: 'from' },
  { context: '@keyframes ov-in', selector: 'from' },
  { context: '@keyframes ov-pulse', selector: '50%' },
  { context: '', selector: '.banner' },
  { context: '', selector: '.banner.recovery' },
  { context: '', selector: '.banner span:last-child' },
  { context: '', selector: '.notice' },
  { context: '', selector: '.obtn' },
  { context: '', selector: '.obtn:hover' },
  { context: '', selector: '.obtn:active' },
  { context: '', selector: '.obtn:focus-visible' },
  { context: '', selector: '.lnk' },
  { context: '', selector: '.lnk:focus-visible' },
  { context: '@media(prefers-reduced-motion:reduce)', selector: '.ovp' },
  { context: '@media(prefers-reduced-motion:reduce)', selector: '.ovp .big' },
  { context: '', selector: '[data-motion=off] .ovp' },
  { context: '', selector: '[data-motion=off] .ovp .big' },
  { context: '@media(max-width:700px)', selector: '.banner' },

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
  { context: '', selector: '.qgroup' },
  { context: '', selector: '.chev' },
  { context: '', selector: '.qrow[aria-expanded=true] .chev' },
  { context: '', selector: '.tiers' },
  { context: '@keyframes tiers-in', selector: 'from' },
  { context: '', selector: '.tier' },
  { context: '', selector: '.tier:hover' },
  { context: '', selector: '.tier:focus-visible' },
  { context: '', selector: '.tier span' },
  { context: '', selector: '.tier small' },
  { context: '', selector: '.tier b' },
  { context: '', selector: '.blocked' },
  { context: '', selector: '.empty' },
  { context: '', selector: '.empty h2' },
  { context: '', selector: '.empty .btn' },
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
  { context: '@media(max-width:640px)', selector: '.qrow' },
  { context: '@media(max-width:640px)', selector: '.tier' },
  { context: '@media(max-width:640px)', selector: '.btn' },
  { context: '@media(max-width:640px)', selector: '.obtn' },

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

  // tasks.css (tasks.html). Shell rules shared with today.html are checked above;
  // these are the page's own selectors, read through its `@scope` wrapper and
  // with the `tasks-` keyframe prefix removed. `.drawer` is the second block for
  // that selector (the shared surface is the first) and `.drawer::before` is the
  // page override of the shared bracket rule.
  { prototype: 'tasks', context: '', selector: 'h1' },
  { prototype: 'tasks', context: '', selector: 'h2' },
  { prototype: 'tasks', context: '', selector: '.sub' },
  { prototype: 'tasks', context: '', selector: '.row' },
  { prototype: 'tasks', context: '', selector: '.btn' },
  { prototype: 'tasks', context: '', selector: '.btn:hover' },
  { prototype: 'tasks', context: '', selector: '.btn:active' },
  { prototype: 'tasks', context: '', selector: '.btn:focus-visible' },
  { prototype: 'tasks', context: '', selector: '.btn.ghost' },
  { prototype: 'tasks', context: '', selector: '.btn.ghost:hover' },
  { prototype: 'tasks', context: '', selector: 'main' },
  { prototype: 'tasks', context: '', selector: '.head' },
  { prototype: 'tasks', context: '', selector: '.head .sub' },
  { prototype: 'tasks', context: '', selector: '.tools' },
  { prototype: 'tasks', context: '', selector: '.search' },
  { prototype: 'tasks', context: '', selector: '.search:focus' },
  { prototype: 'tasks', context: '', selector: '.fc' },
  { prototype: 'tasks', context: '', selector: '.f' },
  { prototype: 'tasks', context: '', selector: '.f:hover' },
  { prototype: 'tasks', context: '', selector: '.f:focus-visible' },
  { prototype: 'tasks', context: '', selector: '.f[aria-pressed=true]' },
  { prototype: 'tasks', context: '', selector: '.f i' },
  { prototype: 'tasks', context: '', selector: '.sep' },
  { prototype: 'tasks', context: '', selector: '.warn' },
  { prototype: 'tasks', context: '', selector: '.warn b' },
  { prototype: 'tasks', context: '', selector: '.groups' },
  { prototype: 'tasks', context: '', selector: '.group' },
  { prototype: 'tasks', context: '', selector: '.group header' },
  { prototype: 'tasks', context: '', selector: '.group h2' },
  { prototype: 'tasks', context: '', selector: '.group h2 i' },
  { prototype: 'tasks', context: '', selector: '.task' },
  { prototype: 'tasks', context: '', selector: '.task:hover' },
  { prototype: 'tasks', context: '', selector: '.task.flash' },
  { prototype: 'tasks', context: '@keyframes flash', selector: 'from' },
  { prototype: 'tasks', context: '', selector: '.task.out' },
  { prototype: 'tasks', context: '@keyframes out', selector: 'to' },
  { prototype: 'tasks', context: '', selector: '.nm' },
  { prototype: 'tasks', context: '', selector: '.badges' },
  { prototype: 'tasks', context: '', selector: '.bd' },
  { prototype: 'tasks', context: '', selector: '.bd.a' },
  { prototype: 'tasks', context: '', selector: '.bd.t' },
  { prototype: 'tasks', context: '', selector: '.bd.o' },
  { prototype: 'tasks', context: '', selector: '.acts' },
  { prototype: 'tasks', context: '', selector: '.ib' },
  { prototype: 'tasks', context: '', selector: '.ib:hover' },
  { prototype: 'tasks', context: '', selector: '.ib.del:hover' },
  { prototype: 'tasks', context: '', selector: '.ib:focus-visible' },
  { prototype: 'tasks', context: '', selector: '.ib svg' },
  { prototype: 'tasks', context: '', selector: '.pt' },
  { prototype: 'tasks', context: '', selector: '.pt small' },
  { prototype: 'tasks', context: '', selector: '.vs' },
  { prototype: 'tasks', context: '', selector: '.v' },
  { prototype: 'tasks', context: '', selector: '.v em' },
  { prototype: 'tasks', context: '', selector: '.v em::before' },
  { prototype: 'tasks', context: '', selector: '.v span' },
  { prototype: 'tasks', context: '', selector: '.v.over .pt' },
  { prototype: 'tasks', context: '', selector: '.empty' },
  { prototype: 'tasks', context: '', selector: '.scrim' },
  { prototype: 'tasks', context: '', selector: '.scrim.on' },
  { prototype: 'tasks', context: '', selector: '.drawer', occurrence: 2 },
  { prototype: 'tasks', context: '', selector: '.drawer.on' },
  { prototype: 'tasks', context: '', selector: '.drawer::before', occurrence: 2 },
  { prototype: 'tasks', context: '', selector: '.lab' },
  { prototype: 'tasks', context: '', selector: '.in' },
  { prototype: 'tasks', context: '', selector: '.in:focus' },
  { prototype: 'tasks', context: '', selector: '.in.bad' },
  { prototype: 'tasks', context: '', selector: '.seg' },
  { prototype: 'tasks', context: '', selector: '.seg .f' },
  { prototype: 'tasks', context: '', selector: '.tg' },
  { prototype: 'tasks', context: '', selector: '.tg:focus-visible' },
  { prototype: 'tasks', context: '', selector: '.sw' },
  { prototype: 'tasks', context: '', selector: '.sw::after' },
  { prototype: 'tasks', context: '', selector: '.tg[aria-checked=true] .sw' },
  { prototype: 'tasks', context: '', selector: '.tg[aria-checked=true] .sw::after' },
  { prototype: 'tasks', context: '', selector: '.tier' },
  { prototype: 'tasks', context: '', selector: '.tier.off' },
  { prototype: 'tasks', context: '', selector: '.tier label.h' },
  { prototype: 'tasks', context: '', selector: '.tier input[type=checkbox]' },
  { prototype: 'tasks', context: '', selector: '.tg2' },
  { prototype: 'tasks', context: '', selector: '.hint' },
  { prototype: 'tasks', context: '', selector: '.err' },
  { prototype: 'tasks', context: '', selector: '.dfoot' },
  { prototype: 'tasks', context: '', selector: '.toast' },
  { prototype: 'tasks', context: '', selector: '.toast.show' },
  { prototype: 'tasks', context: '', selector: '.toast button' },
  { prototype: 'tasks', context: '', selector: '.toast button:hover' },
  { prototype: 'tasks', context: '', selector: '.confirm' },
  { prototype: 'tasks', context: '', selector: '.confirm span:last-child' },
  { prototype: 'tasks', context: '', selector: '.btn.dng' },
  { prototype: 'tasks', context: '', selector: '.btn.dng:hover' },
  { prototype: 'tasks', context: '@media(max-width:1000px)', selector: '.groups' },
  { prototype: 'tasks', context: '@media(max-width:1000px)', selector: '.head' },
  { prototype: 'tasks', context: '@media(max-width:700px)', selector: 'main' },
  { prototype: 'tasks', context: '@media(max-width:700px)', selector: '.sep' },
  { prototype: 'tasks', context: '@media(max-width:640px)', selector: '.btn' },
  { prototype: 'tasks', context: '@media(max-width:640px)', selector: '.f' },
  { prototype: 'tasks', context: '@media(max-width:640px)', selector: '.ib', occurrence: 2 },
  { prototype: 'tasks', context: '@media(max-width:640px)', selector: '.search' },
  { prototype: 'tasks', context: '@media(max-width:640px)', selector: '.in' },

  // rewards.css (rewards.html). Shell rules shared with the other pages are
  // checked above; these are the page's own selectors, read through its `@scope`
  // wrapper and with the `rewards-` keyframe prefix removed. `.drawer` and
  // `.drawer::before` are the page blocks (the shared surface/bracket rules are
  // occurrence 1).
  { prototype: 'rewards', context: '', selector: 'h1' },
  { prototype: 'rewards', context: '', selector: 'h2' },
  { prototype: 'rewards', context: '', selector: '.sub' },
  { prototype: 'rewards', context: '', selector: '.row' },
  { prototype: 'rewards', context: '', selector: '.btn' },
  { prototype: 'rewards', context: '', selector: '.btn:hover' },
  { prototype: 'rewards', context: '', selector: '.btn:active' },
  { prototype: 'rewards', context: '', selector: '.btn:focus-visible' },
  { prototype: 'rewards', context: '', selector: '.btn.gold' },
  { prototype: 'rewards', context: '', selector: '.btn.gold:hover' },
  { prototype: 'rewards', context: '', selector: '.btn.ghost' },
  { prototype: 'rewards', context: '', selector: '.btn.ghost:hover' },
  { prototype: 'rewards', context: '', selector: 'main' },
  { prototype: 'rewards', context: '', selector: '.head' },
  { prototype: 'rewards', context: '', selector: '.layout' },
  { prototype: 'rewards', context: '', selector: '.side' },
  { prototype: 'rewards', context: '', selector: '.tools' },
  { prototype: 'rewards', context: '', selector: '.f' },
  { prototype: 'rewards', context: '', selector: '.f:hover' },
  { prototype: 'rewards', context: '', selector: '.f:focus-visible' },
  { prototype: 'rewards', context: '', selector: '.f[aria-pressed=true]' },
  { prototype: 'rewards', context: '', selector: '.sep' },
  { prototype: 'rewards', context: '', selector: '.grid' },
  { prototype: 'rewards', context: '', selector: '.card' },
  { prototype: 'rewards', context: '', selector: '.card.can' },
  { prototype: 'rewards', context: '', selector: '.card.can:hover' },
  { prototype: 'rewards', context: '', selector: '.card.lock' },
  { prototype: 'rewards', context: '', selector: '.card.flash' },
  { prototype: 'rewards', context: '', selector: '.card.out' },
  { prototype: 'rewards', context: '', selector: '.card.new' },
  { prototype: 'rewards', context: '', selector: '.ttl' },
  { prototype: 'rewards', context: '', selector: '.cost' },
  { prototype: 'rewards', context: '', selector: '.lock .ttl' },
  { prototype: 'rewards', context: '', selector: '.acts' },
  { prototype: 'rewards', context: '', selector: '.ib' },
  { prototype: 'rewards', context: '', selector: '.ib:hover' },
  { prototype: 'rewards', context: '', selector: '.ib.del:hover' },
  { prototype: 'rewards', context: '', selector: '.ib:focus-visible' },
  { prototype: 'rewards', context: '', selector: '.ib svg' },
  { prototype: 'rewards', context: '', selector: '.bought' },
  { prototype: 'rewards', context: '', selector: '.bought b' },
  { prototype: 'rewards', context: '', selector: '.bought b.pop' },
  { prototype: 'rewards', context: '', selector: '.foot' },
  { prototype: 'rewards', context: '', selector: '.ring' },
  { prototype: 'rewards', context: '', selector: '.ring svg' },
  { prototype: 'rewards', context: '', selector: '.ring circle' },
  { prototype: 'rewards', context: '', selector: '.ring .bg' },
  { prototype: 'rewards', context: '', selector: '.ring .fg' },
  { prototype: 'rewards', context: '', selector: '.ring span' },
  { prototype: 'rewards', context: '', selector: '.need' },
  { prototype: 'rewards', context: '', selector: '.need b' },
  { prototype: 'rewards', context: '', selector: '.need .lk' },
  { prototype: 'rewards', context: '', selector: '.empty' },
  { prototype: 'rewards', context: '', selector: '.wallet' },
  { prototype: 'rewards', context: '', selector: '.big' },
  { prototype: 'rewards', context: '', selector: '.kv' },
  { prototype: 'rewards', context: '', selector: '.kv b' },
  { prototype: 'rewards', context: '', selector: '.hist' },
  { prototype: 'rewards', context: '', selector: '.log' },
  { prototype: 'rewards', context: '', selector: '.log li' },
  { prototype: 'rewards', context: '', selector: '.log li small' },
  { prototype: 'rewards', context: '', selector: '.log li b' },
  { prototype: 'rewards', context: '', selector: '.log li.fresh' },
  { prototype: 'rewards', context: '', selector: '.cn' },
  { prototype: 'rewards', context: '', selector: '.float' },
  { prototype: 'rewards', context: '', selector: '.shake' },
  { prototype: 'rewards', context: '', selector: '.scrim' },
  { prototype: 'rewards', context: '', selector: '.scrim.on' },
  { prototype: 'rewards', context: '', selector: '.drawer', occurrence: 2 },
  { prototype: 'rewards', context: '', selector: '.drawer.on' },
  { prototype: 'rewards', context: '', selector: '.drawer::before', occurrence: 2 },
  { prototype: 'rewards', context: '', selector: '.lab' },
  { prototype: 'rewards', context: '', selector: '.in' },
  { prototype: 'rewards', context: '', selector: '.in:focus' },
  { prototype: 'rewards', context: '', selector: '.in.bad' },
  { prototype: 'rewards', context: '', selector: '.hint' },
  { prototype: 'rewards', context: '', selector: '.err' },
  { prototype: 'rewards', context: '', selector: '.dfoot' },
  { prototype: 'rewards', context: '', selector: '.toast' },
  { prototype: 'rewards', context: '', selector: '.toast.show' },
  { prototype: 'rewards', context: '', selector: '.toast button' },
  { prototype: 'rewards', context: '', selector: '.toast button:hover' },
  { prototype: 'rewards', context: '', selector: '.confirm' },
  { prototype: 'rewards', context: '', selector: '.confirm span:last-child' },
  { prototype: 'rewards', context: '', selector: '.btn.dng' },
  { prototype: 'rewards', context: '', selector: '.btn.dng:hover' },
  { prototype: 'rewards', context: '@media(max-width:1000px)', selector: '.layout' },
  { prototype: 'rewards', context: '@media(max-width:1000px)', selector: '.side' },
  { prototype: 'rewards', context: '@media(max-width:1000px)', selector: '.head' },
  { prototype: 'rewards', context: '@media(max-width:700px)', selector: 'main' },
  { prototype: 'rewards', context: '@media(max-width:700px)', selector: '.sep' },
  { prototype: 'rewards', context: '@media(max-width:640px)', selector: '.btn' },
  { prototype: 'rewards', context: '@media(max-width:640px)', selector: '.f' },
  { prototype: 'rewards', context: '@media(max-width:640px)', selector: '.ib' },
  { prototype: 'rewards', context: '@media(max-width:640px)', selector: '.in' },
  { prototype: 'rewards', context: '@keyframes flash', selector: 'from' },
  { prototype: 'rewards', context: '@keyframes out', selector: 'to' },
  { prototype: 'rewards', context: '@keyframes pop', selector: '40%' },
  { prototype: 'rewards', context: '@keyframes cn', selector: 'to' },
  { prototype: 'rewards', context: '@keyframes fl', selector: 'to' },
  { prototype: 'rewards', context: '@keyframes shake', selector: '25%' },
  { prototype: 'rewards', context: '@keyframes shake', selector: '75%' },

  // history.css (history.html). Page selectors, read through its `@scope` wrapper
  // and with the `history-` keyframe prefix removed.
  { prototype: 'history', context: '', selector: 'h1' },
  { prototype: 'history', context: '', selector: 'h2' },
  { prototype: 'history', context: '', selector: '.sub' },
  { prototype: 'history', context: '', selector: '.row' },
  { prototype: 'history', context: '', selector: '.f' },
  { prototype: 'history', context: '', selector: '.f:hover' },
  { prototype: 'history', context: '', selector: '.f:focus-visible' },
  { prototype: 'history', context: '', selector: '.f[aria-pressed=true]' },
  { prototype: 'history', context: '', selector: 'main' },
  { prototype: 'history', context: '', selector: '.head' },
  { prototype: 'history', context: '', selector: '.sum' },
  { prototype: 'history', context: '', selector: '.sum .panel' },
  { prototype: 'history', context: '', selector: '.sum small' },
  { prototype: 'history', context: '', selector: '.sum b' },
  { prototype: 'history', context: '', selector: '.sum em' },
  { prototype: 'history', context: '', selector: '.up' },
  { prototype: 'history', context: '', selector: '.dn' },
  { prototype: 'history', context: '', selector: '.g1' },
  { prototype: 'history', context: '', selector: '.g2' },
  { prototype: 'history', context: '', selector: '.cw' },
  { prototype: 'history', context: '', selector: '#chart' },
  { prototype: 'history', context: '', selector: '#chart:focus-visible' },
  { prototype: 'history', context: '', selector: '.ln' },
  { prototype: 'history', context: '@keyframes draw', selector: 'to' },
  { prototype: 'history', context: '', selector: '.ar' },
  { prototype: 'history', context: '@keyframes fade', selector: 'to' },
  { prototype: 'history', context: '', selector: '.mk' },
  { prototype: 'history', context: '@keyframes mk', selector: 'from' },
  { prototype: 'history', context: '@keyframes mk', selector: 'to' },
  { prototype: 'history', context: '', selector: '.tip' },
  { prototype: 'history', context: '', selector: '.tip.on' },
  { prototype: 'history', context: '', selector: '.tip b' },
  { prototype: 'history', context: '', selector: '.tip div' },
  { prototype: 'history', context: '', selector: '.tip div span:last-child' },
  { prototype: 'history', context: '', selector: '.leg' },
  { prototype: 'history', context: '', selector: '.leg i' },
  { prototype: 'history', context: '', selector: '.evs' },
  { prototype: 'history', context: '', selector: '.ev' },
  { prototype: 'history', context: '', selector: '.ev:hover' },
  { prototype: 'history', context: '', selector: '.ev:focus-visible' },
  { prototype: 'history', context: '', selector: '.ev.big' },
  { prototype: 'history', context: '', selector: '.ev .g' },
  { prototype: 'history', context: '', selector: '.ev b' },
  { prototype: 'history', context: '', selector: '.ev small' },
  { prototype: 'history', context: '', selector: '.cal' },
  { prototype: 'history', context: '', selector: '.cal span' },
  { prototype: 'history', context: '', selector: '.cal button' },
  { prototype: 'history', context: '', selector: '.cal button:hover' },
  { prototype: 'history', context: '', selector: '.cal button:focus-visible' },
  { prototype: 'history', context: '', selector: '.cal button[data-l=1]' },
  { prototype: 'history', context: '', selector: '.cal button[data-l=2]' },
  { prototype: 'history', context: '', selector: '.cal button[data-l=3]' },
  { prototype: 'history', context: '', selector: '.cal button[data-l=x]' },
  { prototype: 'history', context: '', selector: '.cal button.sel' },
  { prototype: 'history', context: '', selector: '.cal i' },
  { prototype: 'history', context: '', selector: '.lw' },
  { prototype: 'history', context: '', selector: 'table' },
  { prototype: 'history', context: '', selector: 'th' },
  { prototype: 'history', context: '', selector: 'th:first-child' },
  { prototype: 'history', context: '', selector: 'td:first-child' },
  { prototype: 'history', context: '', selector: 'th:last-child' },
  { prototype: 'history', context: '', selector: 'td:last-child' },
  { prototype: 'history', context: '', selector: 'td' },
  { prototype: 'history', context: '', selector: 'tr.d' },
  { prototype: 'history', context: '', selector: 'tr.d:hover' },
  { prototype: 'history', context: '', selector: 'tr.d.sel' },
  { prototype: 'history', context: '', selector: 'tr.d:focus-visible' },
  { prototype: 'history', context: '', selector: 'td svg' },
  { prototype: 'history', context: '', selector: 'td .no' },
  { prototype: 'history', context: '', selector: '.net' },
  { prototype: 'history', context: '', selector: 'tr.e td' },
  { prototype: 'history', context: '', selector: 'tr.e td:last-child' },
  { prototype: 'history', context: '', selector: '.frz' },
  { prototype: 'history', context: '', selector: '.pend' },
  { prototype: 'history', context: '@media (max-width: 1100px)', selector: '.g1' },
  { prototype: 'history', context: '@media (max-width: 1100px)', selector: '.g2' },
  { prototype: 'history', context: '@media (max-width: 1100px)', selector: '.sum' },
  { prototype: 'history', context: '@media (max-width: 1100px)', selector: '.head' },
  { prototype: 'history', context: '@media (max-width: 700px)', selector: 'main' },
  { prototype: 'history', context: '@media (max-width: 700px)', selector: 'td:nth-child(n+2):nth-child(-n+6)' },
  { prototype: 'history', context: '@media (max-width: 700px)', selector: 'th:nth-child(n+2):nth-child(-n+6)' },
  { prototype: 'history', context: '@media (max-width: 640px)', selector: '.f' },
  { prototype: 'history', context: '@media (prefers-reduced-motion: reduce)', selector: '.ln' },
  { prototype: 'history', context: '@media (prefers-reduced-motion: reduce)', selector: '.ar' },
  { prototype: 'history', context: '@media (prefers-reduced-motion: reduce)', selector: '.mk' },

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
function indexAll(records, onlyPage = null) {
  const map = new Map();

  for (const record of records) {
    const page = pageOfContext(record.context);
    const prefixedKeyframes = /(?:^| \/ )@keyframes (today|tasks|rewards|history)-/.exec(record.context);

    if (page !== null && onlyPage !== null && page !== onlyPage) continue;
    if (
      onlyPage !== null &&
      prefixedKeyframes !== null &&
      prefixedKeyframes[1] !== onlyPage
    ) {
      continue;
    }

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
  const appCss = readFileSync(join('src', 'app.css'), 'utf8');
  const imports = [...appCss.matchAll(/@import '\.\/styles\/ui\/([^']+)'/g)].map((m) => m[1]);

  return imports.map((f) => join(dir, f));
}

const allPrototype = Object.fromEntries(
  Object.entries(PROTOTYPES).map(([name, file]) => [
    name,
    indexAll(
      parse(stripComments(readFileSync(file, 'utf8')).match(/<style>([\s\S]*?)<\/style>/)[1])
    ),
  ])
);
const appRecords = APP_CSS.flatMap((f) => parse(stripComments(readFileSync(f, 'utf8'))));

const allApp = Object.fromEntries(
  Object.keys(PROTOTYPES).map((name) => [name, indexAll(appRecords, name)])
);

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
  const prototypeName = rule.prototype ?? 'today';
  const prototypeFile = PROTOTYPES[prototypeName];
  const ctx = rule.context === '' ? '' : condition(rule.context);
  const key = `${ctx}|${rule.selector}`;
  const occurrence = rule.occurrence ?? 1;
  const seenKey = `${prototypeName}|${key}#${occurrence}`;

  if (seen.has(seenKey)) continue;

  seen.add(seenKey);

  const expected = block(allPrototype[prototypeName], key, occurrence);

  if (expected === undefined) {
    failures.push(
      `${label(rule)}\n      not found in ${prototypeFile}; the check itself is out of date`
    );
    continue;
  }

  const actual = block(allApp[prototypeName], key, occurrence);

  if (actual === undefined) {
    failures.push(`${label(rule)}\n      missing from the app CSS`);
    continue;
  }

  if (actual === null) {
    failures.push(`${label(rule)}\n      has fewer declaration blocks than ${prototypeFile}`);
    continue;
  }

  const lines = diff(expected, actual);

  if (lines.length > 0) {
    failures.push(`${label(rule)}\n${lines.join('\n')}`);
  }
}

if (failures.length > 0) {
  console.error(
    `\n${failures.length} of ${seen.size} ported rules do not match their prototype:\n`
  );

  for (const failure of failures) console.error(`    ${failure}`);

  console.error('\nthe rules in src/app.css and src/styles/ui/*.css must stay verbatim\n');
  process.exit(1);
}

console.log(`ok    ${seen.size} ported rules match their prototype verbatim`);
