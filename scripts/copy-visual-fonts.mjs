/**
 * Copies the exact woff2 files the prototype and the app both load into
 * tests/visual/fonts/, then writes a manifest with their sha256 digests.
 *
 * The visual harness serves this directory at /__fonts__/ and hands both sides of
 * the diff the same bytes, so a @fontsource release can never silently change
 * the render. Run via `npm run test:visual:fonts`.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'visual', 'fonts');

/** family, weight, @fontsource package, latin woff2 filename. */
const FONTS = [
  ['Chakra Petch', 500, '@fontsource/chakra-petch', 'chakra-petch-latin-500-normal.woff2'],
  ['Chakra Petch', 600, '@fontsource/chakra-petch', 'chakra-petch-latin-600-normal.woff2'],
  ['Chakra Petch', 700, '@fontsource/chakra-petch', 'chakra-petch-latin-700-normal.woff2'],
  ['Manrope', 400, '@fontsource/manrope', 'manrope-latin-400-normal.woff2'],
  ['Manrope', 500, '@fontsource/manrope', 'manrope-latin-500-normal.woff2'],
  ['Manrope', 700, '@fontsource/manrope', 'manrope-latin-700-normal.woff2'],
  ['JetBrains Mono', 500, '@fontsource/jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff2'],
];

await mkdir(outDir, { recursive: true });

const manifest = { fonts: [] };

for (const [family, weight, pkg, file] of FONTS) {
  const src = join(root, 'node_modules', ...pkg.split('/'), 'files', file);
  const dest = join(outDir, file);
  const bytes = await readFile(src);

  await copyFile(src, dest);
  manifest.fonts.push({
    family,
    weight,
    file,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`copied ${manifest.fonts.length} font files to tests/visual/fonts`);
