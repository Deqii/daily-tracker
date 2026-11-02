import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * WCAG contrast report for the token pairs the five pages use (UI Revamp Issue 7).
 *
 * Reads the token blocks from `src/app.css` and prints the contrast of each
 * foreground token against `--bg`, `--panel` and `--panel-solid` in the dark and
 * light themes. `--panel` is translucent in the prototypes, so it is composited
 * over `--bg` before measuring, which is what the page actually paints.
 *
 * This is a report, not a gate: the tokens come from the prototypes and any
 * failing pair is an open question for the human, not something an agent may
 * change. It exits 0 even when a pair fails and exits 1 only on a malformed
 * token block.
 */

const CSS = fileURLToPath(new URL('../src/app.css', import.meta.url));

const FOREGROUNDS = ['--text', '--muted', '--cyan', '--danger', '--ok', '--gold', '--warn'];
const BACKGROUNDS = ['--bg', '--panel', '--panel-solid'];

function block(source, selector) {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`token block not found: ${selector}`);

  const open = source.indexOf('{', start);
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }

  throw new Error(`unterminated token block: ${selector}`);
}

function tokens(body) {
  const map = new Map();

  for (const line of body.split('\n')) {
    const match = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i.exec(line);
    if (match !== null) map.set(match[1], match[2].trim());
  }

  return map;
}

function hex(value) {
  const raw = value.replace('#', '');
  const full = raw.length === 3 ? [...raw].map((char) => char + char).join('') : raw;

  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${value}`);

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    a: 1,
  };
}

function rgba(value) {
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(
    value
  );
  if (match === null) throw new Error(`not an rgb colour: ${value}`);

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function colour(value) {
  if (value.startsWith('#')) return hex(value);
  if (/^rgba?\(/i.test(value)) return rgba(value);
  throw new Error(`unsupported colour token: ${value}`);
}

function over(top, bottom) {
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];

  return (light + 0.05) / (dark + 0.05);
}

function resolve(map, name) {
  const value = map.get(name);
  if (value === undefined) throw new Error(`token missing: ${name}`);
  if (value.startsWith('var(')) throw new Error(`unresolved indirection: ${name}: ${value}`);

  return colour(value);
}

const source = await readFile(CSS, 'utf8');
const themes = {
  dark: tokens(block(source, ':root')),
  light: tokens(block(source, "[data-theme='light']")),
};

let failures = 0;

for (const [theme, map] of Object.entries(themes)) {
  const bg = resolve(map, '--bg');

  console.log(`\n${theme} theme`);

  for (const background of BACKGROUNDS) {
    const base = resolve(map, background);
    const surface = background === '--panel' ? over(base, bg) : base;

    for (const foreground of FOREGROUNDS) {
      const ratio = contrast(resolve(map, foreground), surface);
      const pass = ratio >= 4.5;
      if (!pass) failures += 1;

      console.log(
        `  ${foreground.padEnd(10)} on ${background.padEnd(14)} ${ratio.toFixed(2).padStart(6)}  ${pass ? 'PASS' : 'FAIL (4.5)'}`
      );
    }
  }
}

console.log(
  `\n${failures} pair(s) below 4.5:1. Tokens come from the prototypes and are reported, not changed.`
);
