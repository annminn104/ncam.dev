import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import css from './app.css?inline';

/** The declarations of the first rule whose whole selector is `selector`, at the start of a line. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

/** Everything from the reduced-motion block, the last of the file, to the end. */
const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const fadeMs = Number(/const FADE_MS = (\d+);/.exec(app)?.[1]);

describe('app.css: the loader', () => {
  it('is plain from the first paint: no opacity, no entrance, nothing hidden', () => {
    const loader = rule('.cdp-loader');
    expect(loader).not.toBe('');
    expect(loader).not.toMatch(/opacity\s*:/);
    expect(loader).not.toMatch(/animation\s*:/);
    expect(loader).not.toMatch(/visibility\s*:/);
    expect(rule('.cdp-loader__line')).not.toMatch(/opacity\s*:|animation\s*:/);
  });

  it('fades out only once the scene is live, with the canvas, over FADE_MS', () => {
    expect(fadeMs).toBe(600);
    expect(rule('.cdp-scene')).toContain(`transition: opacity ${fadeMs}ms ease`);
    expect(rule('.cdp-loader')).toContain(`transition: opacity ${fadeMs}ms ease`);
    expect(rule('.cdp-scene.is-live ~ .cdp-loader')).toMatch(/opacity:\s*0;/);
  });

  it('spins its disc by CSS, and keeps it still under reduced motion', () => {
    expect(rule('.cdp-loader__disc')).toMatch(/animation:\s*cdp-spin\b[^;]*infinite/);
    expect(css).toMatch(/@keyframes cdp-spin\s*\{\s*to\s*\{\s*transform:\s*rotate\(1turn\);/);
    expect(reduced).toMatch(/\.cdp-loader__disc\s*[,{][^}]*animation:\s*none/);
    expect(reduced).toMatch(/\.cdp-loader\s*[,{][^}]*transition:\s*none/);
  });

  it('has no poster any more', () => {
    expect(css).not.toContain('cdp-poster');
  });
});
