// Copies the Stockfish lite single-threaded build out of node_modules into
// public/stockfish/ as stockfish.js + stockfish.wasm (+ licence), so the remote
// serves it from its own origin. Runs on predev / prebuild; the output is gitignored.
// Stockfish is GPLv3: the files are copied unmodified, with the licence.
// The names stay the same across versions, so vercel.json has browsers revalidate
// them (never `immutable`): an upgrade reaches returning visitors as a matching pair.
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve('stockfish/package.json'));
const out = fileURLToPath(new URL('../public/stockfish/', import.meta.url));

async function find(dir, test) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      const hit = await find(full, test);
      if (hit) return hit;
    } else if (test(entry.name)) return full;
  }
  return null;
}

const js = await find(pkgDir, (n) => /lite-single.*\.js$/.test(n) && !n.endsWith('.map'));
const wasm = await find(pkgDir, (n) => /lite-single.*\.wasm$/.test(n));
if (!js || !wasm) throw new Error(`stockfish lite-single build not found under ${pkgDir}`);
const licence = await find(pkgDir, (n) => /^(copying|license)(\.txt|\.md)?$/i.test(n));
if (!licence) throw new Error(`stockfish licence (Copying.txt) not found under ${pkgDir}`);

await mkdir(out, { recursive: true });
await copyFile(js, path.join(out, 'stockfish.js'));
await copyFile(wasm, path.join(out, 'stockfish.wasm'));
await copyFile(licence, path.join(out, 'COPYING.txt'));
const { version } = require('stockfish/package.json');
await writeFile(
  path.join(out, 'SOURCE.txt'),
  `Stockfish ${version} (lite, single-threaded), GPLv3.\nSource: https://github.com/nmrugg/stockfish.js and https://github.com/official-stockfish/Stockfish\nCopied unmodified from ${path.basename(js)} / ${path.basename(wasm)}.\n`,
);
console.log(`stockfish: ${path.basename(js)} + ${path.basename(wasm)} → public/stockfish/`);
