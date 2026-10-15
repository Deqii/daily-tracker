/**
 * Static server for the prototype side of the visual diff.
 *
 *   /            -> docs/prototype/<file>
 *   /__fonts__/  -> tests/visual/fonts/<file>
 *
 * Deliberately dependency-free: `http-server` is outside the allow-list in the
 * UI Fidelity Contract, and a dozen lines of node:http is easier to keep
 * deterministic than an extra dev dependency.
 *
 * Usage: node scripts/serve-prototypes.mjs [--port 4174]
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const portArg = process.argv.indexOf('--port');
const PORT = portArg === -1 ? 4174 : Number(process.argv[portArg + 1]);

const MOUNTS = [
  { prefix: '/__fonts__/', dir: join(root, 'tests', 'visual', 'fonts') },
  { prefix: '/', dir: join(root, 'docs', 'prototype') },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Rejects anything that escapes its mount directory. */
function resolveFile(pathname) {
  for (const mount of MOUNTS) {
    if (!pathname.startsWith(mount.prefix)) continue;

    const rel = normalize(pathname.slice(mount.prefix.length));
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) continue;

    const file = join(mount.dir, rel);
    if (!resolve(file).startsWith(resolve(mount.dir))) continue;

    return file;
  }

  return null;
}

const server = createServer((req, res) => {
  const send = (code, body, type = 'text/plain; charset=utf-8') => {
    res.writeHead(code, {
      'content-type': type,
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    });
    res.end(body);
  };

  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const file = resolveFile(pathname === '/' ? '/today.html' : pathname);

  if (file === null) {
    send(404, 'not found');
    return;
  }

  stat(file).then(
    (info) => {
      if (!info.isFile()) {
        send(404, 'not found');
        return;
      }

      res.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'content-length': info.size,
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      });
      createReadStream(file).pipe(res);
    },
    () => send(404, 'not found')
  );
});

server.listen(PORT, () => {
  console.log(`prototypes on http://localhost:${PORT}/ (fonts at /__fonts__/)`);
});
