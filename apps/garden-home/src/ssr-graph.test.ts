import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = path.dirname(fileURLToPath(import.meta.url));
// Static `import … from '…'` / `export … from '…'` only (`import type` included: it names a file
// the graph would reach); `import('…')` is lazy and allowed.
const STATIC = /^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm;
const BARE_SIDE_EFFECT = /^\s*import\s+['"]([^'"]+)['"]/gm;
/** The lazy chunk's directories: three, R3F, zustand and zod live only there. */
const CHUNK_DIRS = ['scene', 'camera', 'systems', 'interact', 'state', 'ui'];
const CHUNK_BARE = /^(three|three\/.*|@react-three\/.*|zustand(\/.*)?|zod(\/.*)?)$/;

function resolve(from: string, spec: string): string | null {
  const base = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const file = base + ext;
    if (existsSync(file) && /\.(tsx?|css)$/.test(file)) return file;
  }
  return null;
}

function graph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file) || file.endsWith('.css')) return;
    files.add(file);
    const text = readFileSync(file, 'utf8');
    for (const re of [STATIC, BARE_SIDE_EFFECT]) {
      for (const [, spec] of text.matchAll(re)) {
        if (spec.startsWith('.')) {
          const next = resolve(file, spec);
          if (next) visit(next);
        } else bare.add(spec);
      }
    }
  };
  visit(entry);
  return { files, bare };
}

const inChunk = (file: string) =>
  CHUNK_DIRS.some((dir) => path.relative(SRC, file).split(path.sep)[0] === dir);

describe('SSR import graph', () => {
  it('never statically reaches three, R3F, zustand, zod or the scene chunk', () => {
    const { files, bare } = graph(path.join(SRC, 'ssr.tsx'));
    expect([...bare].filter((spec) => CHUNK_BARE.test(spec))).toEqual([]);
    expect([...files].filter(inChunk)).toEqual([]);
  });

  it('walks the whole shell, so the check above cannot pass vacuously', () => {
    const { files } = graph(path.join(SRC, 'ssr.tsx'));
    for (const rel of [
      'App.tsx',
      'shell/Poster.tsx',
      'shell/Hud.tsx',
      'shell/EnterButton.tsx',
      'shell/SceneHost.tsx',
      'boot.ts',
      'autoplay.ts',
      'failure.ts',
      'scene-props.ts',
      'runtime.ts',
      'assets/poster/index.ts',
    ]) {
      expect(files.has(path.join(SRC, ...rel.split('/'))), rel).toBe(true);
    }
  });

  it('leaves the scene chunk out of the server build', () => {
    // A server build still bundles what a lazy import names: a dead copy of three, R3F and the
    // scene. SceneHost names the chunk only when import.meta.env.SSR is false.
    const host = readFileSync(path.join(SRC, 'shell', 'SceneHost.tsx'), 'utf8');
    const imports = host.match(/import\(\s*['"]\.\.\/scene\/GardenScene['"]\s*\)/g) ?? [];
    expect(imports).toHaveLength(1);
    expect(host).toMatch(
      /import\.meta\.env\.SSR\s*\?[\s\S]*?:\s*import\(\s*['"]\.\.\/scene\/GardenScene['"]\s*\)/,
    );
  });

  it('the federated mount and hydrate reach no more than the shell (three stays a lazy chunk)', () => {
    for (const entry of ['mount.tsx', 'hydrate.tsx']) {
      const { files, bare } = graph(path.join(SRC, entry));
      expect(
        [...bare].filter((spec) => CHUNK_BARE.test(spec)),
        entry,
      ).toEqual([]);
      expect([...files].filter(inChunk), entry).toEqual([]);
    }
  });
});
