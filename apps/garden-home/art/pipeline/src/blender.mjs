import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';

export function blenderBin() {
  const bin = process.env.BLENDER_BIN ?? DEFAULT_BLENDER;
  if (!existsSync(bin)) throw new Error(`Blender not found at ${bin}; set BLENDER_BIN`);
  return bin;
}

/**
 * Runs a Blender script headless, on `blend` when given (generator scripts start from an empty scene).
 * Resolves with { code, stdout, stderr }; never rejects on a non-zero exit.
 */
export function runBlender({ blend = null, script, args = [], scriptsDir }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      blenderBin(),
      [
        '-b',
        '--factory-startup',
        '--python-exit-code',
        '1',
        ...(blend ? [blend] : []),
        '-P',
        join(scriptsDir, script),
        '--',
        ...args,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8'); // a StringDecoder keeps multi-byte characters intact across chunks
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

/** "CONTRACT pond: ok" -> "pond: ok" */
export function contractLines(stderr) {
  return stderr
    .split('\n')
    .filter((line) => line.startsWith('CONTRACT '))
    .map((line) => line.slice('CONTRACT '.length));
}
