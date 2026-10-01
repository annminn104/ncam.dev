import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = path.dirname(fileURLToPath(import.meta.url));
// Static `import … from '…'` / `export … from '…'` only; `import('…')` is lazy and allowed.
const STATIC = /^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm;
const BARE_SIDE_EFFECT = /^\s*import\s+['"]([^'"]+)['"]/gm;

function resolve(from: string, spec: string): string | null {
  const base = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext) && !(base + ext).endsWith('/')) {
      if (/\.(tsx?|css)$/.test(base + ext)) return base + ext;
    }
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

describe('SSR import graph', () => {
  it('never statically reaches three, R3F or the battle chunk', () => {
    const { files, bare } = graph(path.join(SRC, 'ssr.tsx'));
    expect(
      [...bare].filter(
        (s) => s === 'three' || s.startsWith('three/') || s.startsWith('@react-three/'),
      ),
    ).toEqual([]);
    expect([...files].filter((f) => f.includes(`${path.sep}battle${path.sep}`))).toEqual([]);
    expect(files.has(path.join(SRC, 'lobby', 'Lobby.tsx'))).toBe(true);
  });

  it('walks the whole lobby graph, so the check above cannot pass vacuously', () => {
    const { files } = graph(path.join(SRC, 'ssr.tsx'));
    // Down a level (lobby/ArenaCard) and up and across again (../settings, ../engine, ../lib).
    for (const rel of [
      'App.tsx',
      'lobby/ArenaCard.tsx',
      'settings.ts',
      'arenas-meta.ts',
      'engine/levels.ts',
      'lib/asset-url.ts',
    ]) {
      expect(files.has(path.join(SRC, ...rel.split('/')))).toBe(true);
    }
  });
});
