#!/usr/bin/env node
// pnpm --filter @ncam/garden-home art:assets [-- --check] : Blender modules + site.blend -> apps/garden-home/public/assets
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractLines, runBlender } from './src/blender.mjs';
import { isKtxSupported, ktxVersion } from './src/ktx.mjs';
import { mergeScene } from './src/mergeScene.mjs';
import { optimizeModule, TIERS } from './src/optimize.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLENDER = join(ROOT, 'blender');
const SCRIPTS = join(BLENDER, 'scripts');
const RAW = join(BLENDER, 'out');
const ASSETS = join(ROOT, '../public/assets');

function fail(message) {
  console.error(`assets: ${message}`);
  process.exit(1);
}

const tail = (text) => text.split('\n').slice(-20).join('\n');

async function exportModules(ids, check) {
  let failed = 0;
  for (const id of ids) {
    const args = check ? ['--check'] : ['--out-dir', RAW];
    const { code, stderr } = await runBlender({
      blend: join(BLENDER, 'modules', `${id}.blend`),
      script: 'export_module.py',
      args,
      scriptsDir: SCRIPTS,
    });
    const lines = contractLines(stderr);
    for (const line of lines) console.log(`contract ${line}`);
    if (code !== 0) {
      failed += 1;
      if (lines.length === 0) console.error(tail(stderr));
    }
  }
  if (failed) fail(`${failed} module(s) failed`);
}

async function main() {
  const check = process.argv.includes('--check');
  if (!check) {
    const version = ktxVersion();
    if (!isKtxSupported(version)) {
      fail(
        `KTX-Software >= 4.4.0 required (found ${version ? version.join('.') : 'none'}): https://github.com/KhronosGroup/KTX-Software/releases`,
      );
    }
  }
  const ids = readdirSync(join(BLENDER, 'modules'))
    .filter((f) => f.endsWith('.blend'))
    .map((f) => basename(f, '.blend'))
    .sort();
  if (ids.length === 0) fail('no modules in blender/modules');

  rmSync(RAW, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });
  await exportModules(ids, check);
  if (check) {
    console.log('contract: all modules ok');
    return;
  }

  const layoutPath = join(RAW, 'layout.json');
  const layoutRun = await runBlender({
    blend: join(BLENDER, 'site.blend'),
    script: 'export_layout.py',
    args: ['--out', layoutPath],
    scriptsDir: SCRIPTS,
  });
  if (layoutRun.code !== 0) fail(`export_layout failed:\n${tail(layoutRun.stderr)}`);
  const layout = JSON.parse(readFileSync(layoutPath, 'utf8'));
  const metas = ids.map((id) => JSON.parse(readFileSync(join(RAW, `${id}.meta.json`), 'utf8')));

  const modulesDir = join(ASSETS, 'modules');
  rmSync(modulesDir, { recursive: true, force: true });
  mkdirSync(modulesDir, { recursive: true });
  for (const meta of metas) {
    for (const tier of TIERS) {
      await optimizeModule({
        input: join(RAW, `${meta.id}.raw.glb`),
        output: join(modulesDir, `${meta.id}.${tier}.glb`),
        role: meta.role,
        tier,
      });
      console.log(`optimized ${meta.id}.${tier}.glb`);
    }
  }
  const scene = mergeScene({ layout, metas, generatedAt: new Date().toISOString() });
  writeFileSync(join(ASSETS, 'scene.json'), `${JSON.stringify(scene, null, 2)}\n`);
  console.log(`wrote scene.json (${scene.slots.length} slots, ${metas.length} modules)`);
}

main().catch((error) => fail(error.stack ?? String(error)));
