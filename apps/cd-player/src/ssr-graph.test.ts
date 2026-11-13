import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = path.dirname(fileURLToPath(import.meta.url));
// Static `import … from '…'` / `export … from '…'` only (`import type` included); `import('…')` is lazy.
const STATIC = /^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm;
const BARE_SIDE_EFFECT = /^\s*import\s+['"]([^'"]+)['"]/gm;
const THREE = /^(three|three\/.*|@react-three\/.*)$/;
const ZOD = /^zod(\/.*)?$/;

function resolve(from: string, specifier: string): string | null {
  // `./schema.js` names the TypeScript file `./schema.ts`: the server code imports that way.
  const base = path.resolve(
    path.dirname(from),
    specifier.replace(/\?.*$/, '').replace(/\.js$/, ''),
  );
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
      for (const [, specifier] of text.matchAll(re)) {
        if (specifier.startsWith('.')) {
          const next = resolve(file, specifier);
          if (next) visit(next);
        } else bare.add(specifier);
      }
    }
  };
  visit(entry);
  return { files, bare };
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/');
const inScene = (file: string) => rel(file).startsWith('scene/');

describe('import graphs', () => {
  it('the server render never reaches three, R3F or the scene', () => {
    const { files, bare } = graph(path.join(SRC, 'ssr.tsx'));
    expect([...bare].filter((s) => THREE.test(s))).toEqual([]);
    expect([...files].filter(inScene).map(rel)).toEqual([]);
  });

  it('the client entries reach neither three nor zod nor the server code', () => {
    for (const entry of ['mount.tsx', 'hydrate.tsx']) {
      const { files, bare } = graph(path.join(SRC, entry));
      expect(
        [...bare].filter((s) => THREE.test(s) || ZOD.test(s)),
        entry,
      ).toEqual([]);
      expect(
        [...files]
          .map(rel)
          .filter(
            (f) =>
              f.startsWith('scene/') ||
              f.startsWith('server/') ||
              f === 'spotify/embed.ts' ||
              f === 'spotify/schema.ts',
          ),
        entry,
      ).toEqual([]);
    }
  });

  it('keeps the scene’s three-free modules off three and R3F', () => {
    for (const entry of [
      'scene/tonearm.ts',
      'scene/playhead.ts',
      'scene/grip.ts',
      'scene/arm-drag.ts',
    ]) {
      const { bare } = graph(path.join(SRC, ...entry.split('/')));
      expect(
        [...bare].filter((s) => THREE.test(s)),
        entry,
      ).toEqual([]);
    }
  });

  it('walks the whole shell, so the checks above cannot pass vacuously', () => {
    const { files } = graph(path.join(SRC, 'ssr.tsx'));
    for (const file of [
      'App.tsx',
      'shell/Loader.tsx',
      'shell/EnterButton.tsx',
      'shell/SceneHost.tsx',
      'shell/NowPlaying.tsx',
      'shell/LookPicker.tsx',
      'skins.ts',
      'luxe-looks.ts',
      'playback/engine.ts',
      'server/initial.ts',
      'spotify/embed.ts',
      'spotify/schema.ts',
      'boot.ts',
      'autoplay.ts',
    ]) {
      expect(files.has(path.join(SRC, ...file.split('/'))), file).toBe(true);
    }
  });

  it('names the scene chunk only behind import.meta.env.SSR', () => {
    const host = readFileSync(path.join(SRC, 'shell', 'SceneHost.tsx'), 'utf8');
    expect(host.match(/import\(\s*['"]\.\.\/scene\/PlayerScene['"]\s*\)/g) ?? []).toHaveLength(1);
    expect(host).toMatch(
      /import\.meta\.env\.SSR\s*\?[\s\S]*?:\s*import\(\s*['"]\.\.\/scene\/PlayerScene['"]\s*\)/,
    );
  });
});
