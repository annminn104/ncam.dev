import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: HeaderRule[];
  rewrites: { source: string; destination: string }[];
  git: { deploymentEnabled: Record<string, boolean> };
};

/** The values of header `key` Vercel would send for `path` (its `source` patterns read as regexps). */
function header(path: string, key: string): string[] {
  return config.headers
    .filter((rule) => new RegExp(`^${rule.source}$`).test(path))
    .flatMap((rule) => rule.headers)
    .filter((h) => h.key.toLowerCase() === key.toLowerCase())
    .map((h) => h.value);
}

describe('vercel.json', () => {
  it('lets the host page fetch the scene, the modules and the transcoder cross-origin', () => {
    for (const path of [
      '/assets/scene.json',
      '/assets/modules/house.high.glb',
      '/basis/basis_transcoder.wasm',
    ]) {
      expect(header(path, 'Access-Control-Allow-Origin'), path).toEqual(['*']);
    }
  });

  it('has browsers revalidate the files whose names never change', () => {
    // scene.json, the module GLBs and the Basis transcoder keep their names across releases:
    // cached as immutable, a returning visitor would keep an old scene or transcoder.
    for (const path of [
      '/assets/scene.json',
      '/assets/modules/house.high.glb',
      '/basis/basis_transcoder.js',
    ]) {
      const values = header(path, 'Cache-Control');
      expect(values, path).not.toHaveLength(0);
      for (const value of values) {
        expect(value, path).not.toMatch(/immutable/);
        expect(value, path).toMatch(/max-age=0\b[^]*must-revalidate/);
      }
    }
  });

  it('serves the wallpaper page and skips Dependabot branches', () => {
    expect(config.rewrites).toContainEqual({ source: '/wallpaper', destination: '/index.html' });
    expect(config.git.deploymentEnabled['dependabot/**']).toBe(false);
  });
});
