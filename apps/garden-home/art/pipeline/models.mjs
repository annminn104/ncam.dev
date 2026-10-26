#!/usr/bin/env node
// pnpm --filter @ncam/garden-home art:models [-- --force] [--only house pool fence ... site] : generate the villa, garden, pond and carport modules
// and the placeholder yard/site
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBlender } from './src/blender.mjs';
import { GENERATORS, modelSteps } from './src/models.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLENDER = join(ROOT, 'blender');
// the lines a generator prints about what it wrote or skipped
const REPORT = new RegExp(`^(skip|placeholders|${GENERATORS.map(([name]) => name).join('|')}):`);

/** The names after --only, up to the next flag; null when there is no --only. */
function onlyArgs(argv) {
  const start = argv.indexOf('--only');
  if (start < 0) return null;
  const end = argv.findIndex((arg, i) => i > start && arg.startsWith('--'));
  return argv.slice(start + 1, end < 0 ? undefined : end);
}

/** The steps the command line asks for; a usage mistake (--only without names, an unknown name) ends here, stackless. */
function stepsOrExit() {
  try {
    return modelSteps(BLENDER, process.argv.includes('--force'), onlyArgs(process.argv));
  } catch (error) {
    console.error(`models: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  for (const step of stepsOrExit()) {
    const { code, stdout, stderr } = await runBlender({
      script: step.script,
      args: step.args,
      scriptsDir: join(BLENDER, 'scripts'),
    });
    for (const line of stdout.split('\n')) if (REPORT.test(line)) console.log(line);
    for (const line of stderr.split('\n')) if (line.startsWith('LAYOUT ')) console.error(line);
    if (code !== 0) {
      console.error(stderr.split('\n').slice(-20).join('\n'));
      console.error(`models: ${step.script} failed`);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(`models: ${error.stack ?? String(error)}`);
  process.exit(1);
});
