import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runBlender } from '../src/blender.mjs';

// Stands in for Blender: writes a contract line to stderr, cut in the middle of the two UTF-8 bytes of "á".
const FAKE_BLENDER = `#!/usr/bin/env node
const bytes = Buffer.from('CONTRACT pond: Ao cá\\n');
const cut = bytes.indexOf(0xc3) + 1;
process.stderr.write(bytes.subarray(0, cut));
setTimeout(() => process.stderr.write(bytes.subarray(cut)), 100);
`;

// Stands in for Blender: prints its arguments, one per line, to stdout.
const ECHO_BLENDER = `#!/usr/bin/env node
process.stdout.write(process.argv.slice(2).join('\\n'));
`;

function fakeBlender(dir, source) {
  const bin = join(dir, 'blender');
  writeFileSync(bin, source);
  chmodSync(bin, 0o755);
  process.env.BLENDER_BIN = bin;
}

describe('runBlender', () => {
  const original = process.env.BLENDER_BIN;
  let dir;

  afterEach(() => {
    if (original === undefined) delete process.env.BLENDER_BIN;
    else process.env.BLENDER_BIN = original;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('decodes stderr as UTF-8 even when a multi-byte character is split across chunks', async () => {
    dir = mkdtempSync(join(tmpdir(), 'fake-blender-'));
    fakeBlender(dir, FAKE_BLENDER);
    const { code, stderr } = await runBlender({
      blend: 'x.blend',
      script: 'y.py',
      scriptsDir: dir,
    });
    expect(code).toBe(0);
    expect(stderr).toBe('CONTRACT pond: Ao cá\n');
  });

  it('opens the .blend when given and starts from an empty scene otherwise', async () => {
    dir = mkdtempSync(join(tmpdir(), 'fake-blender-'));
    fakeBlender(dir, ECHO_BLENDER);
    const withBlend = await runBlender({
      blend: 'house.blend',
      script: 'y.py',
      args: ['--check'],
      scriptsDir: dir,
    });
    expect(withBlend.stdout.split('\n')).toEqual([
      '-b',
      '--factory-startup',
      '--python-exit-code',
      '1',
      'house.blend',
      '-P',
      join(dir, 'y.py'),
      '--',
      '--check',
    ]);
    const generator = await runBlender({ script: 'y.py', args: ['--force'], scriptsDir: dir });
    expect(generator.stdout.split('\n')).toEqual([
      '-b',
      '--factory-startup',
      '--python-exit-code',
      '1',
      '-P',
      join(dir, 'y.py'),
      '--',
      '--force',
    ]);
  });
});
