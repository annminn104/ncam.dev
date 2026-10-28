// Copies the Basis Universal transcoder (needed by KTX2Loader) from three into public/basis/.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const threeRoot = join(dirname(require.resolve('three')), '..');
const src = join(threeRoot, 'examples/jsm/libs/basis');
const dest = join(dirname(fileURLToPath(import.meta.url)), '../public/basis');
mkdirSync(dest, { recursive: true });
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm'])
  copyFileSync(join(src, file), join(dest, file));
console.log(`copy-basis: ${src} -> ${dest}`);
