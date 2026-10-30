import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import css from './app.css?inline';

/** The declarations of the first rule whose whole selector is `selector`, at the start of a line. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

/** From the reduced-motion block to the end of the file; the skin picker's rules come after it. */
const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
/** The phone layout's block. */
const phone = /@media \(max-width: 820px\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
/** The custom properties on .cdp-root, the file's first rule. */
const root = rule('.cdp-root');
const token = (name: string) => new RegExp(`--cdp-${name}:\\s*([^;]+);`).exec(root)?.[1].trim();
/** Everything after .cdp-root's block. */
const rest = css.slice(css.indexOf('}') + 1);
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

describe('app.css: the hi-fi panel', () => {
  it('declares the tokens', () => {
    expect(token('radius')).toBe('6px');
    expect(token('radius-control')).toBe('4px');
    expect(token('panel')).toBe('rgb(16 12 14 / 0.88)');
    expect(token('line')).toBe('rgb(255 255 255 / 0.16)');
    expect(token('mono')).toBe('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace');
    expect(token('accent')).toBe('#e8a3b0');
    expect(token('on-accent')).toBe('#2a1a1e');
  });

  it('names no colour outside the tokens but neutral greys', () => {
    expect(rest.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    for (const [, r, g, b] of rest.matchAll(/rgb\((\d+) (\d+) (\d+)/g)) {
      expect(r === g && g === b, `rgb(${r} ${g} ${b})`).toBe(true);
    }
    expect(css).not.toMatch(/--cdp-(blush|gold|glass|display)/);
  });

  it('has no pills, no italic, no Fraunces, no layered shadows and no blur over 8 px', () => {
    expect(css).not.toContain('999px');
    expect(css).not.toMatch(/border-radius:\s*50%/);
    expect(css).not.toMatch(/font-style:\s*italic/);
    expect(css).not.toContain('Fraunces');
    for (const [, value] of css.matchAll(/box-shadow:\s*([^;]+);/g)) {
      expect(value, value).not.toMatch(/\)\s*,/);
    }
    for (const [, px] of css.matchAll(/backdrop-filter:\s*blur\((\d+)px\)/g)) {
      expect(Number(px)).toBeLessThanOrEqual(8);
    }
  });

  it('marks with the accent: Load, Play, the progress, the playing row, the switches, the ring', () => {
    expect(rule('.cdp-button--primary')).toMatch(/background:\s*var\(--cdp-accent\)/);
    expect(rule('.cdp-key--main')).toMatch(/background:\s*var\(--cdp-accent\)/);
    expect(rule('.cdp-now__seek::-webkit-slider-runnable-track')).toContain(
      'linear-gradient(var(--cdp-accent), var(--cdp-accent))',
    );
    expect(rule('.cdp-now__seek::-moz-range-progress')).toMatch(
      /background:\s*var\(--cdp-accent\)/,
    );
    expect(rule('.cdp-track.is-current::before')).toMatch(/background:\s*var\(--cdp-accent\)/);
    expect(rule('.cdp-eq span')).toMatch(/background:\s*var\(--cdp-accent\)/);
    expect(rule(".cdp-key--small[aria-pressed='true']")).toMatch(/color:\s*var\(--cdp-accent\)/);
    expect(rule(".cdp-key--small[aria-pressed='true']::after")).toMatch(
      /background:\s*currentcolor/,
    );
    expect(rule('.cdp-root :focus-visible')).toMatch(/outline:\s*2px solid var\(--cdp-accent\)/);
  });

  it('keeps square controls: 4 px keys, rows, fields and buttons, 32 and 28 px keys', () => {
    for (const selector of [
      '.cdp-key',
      '.cdp-button',
      '.cdp-link input',
      '.cdp-track',
      '.cdp-enter',
    ]) {
      expect(rule(selector), selector).toMatch(/border-radius:\s*var\(--cdp-radius-control\)/);
    }
    expect(rule('.cdp-key')).toMatch(/width:\s*32px;[\s\S]*height:\s*32px;/);
    expect(rule('.cdp-key--small')).toMatch(/width:\s*28px;[\s\S]*height:\s*28px;/);
    expect(rule('.cdp-now__seek')).toMatch(/height:\s*28px;/);
  });

  it('keeps the breakpoints and the phone rules: the sheet, its list, a 16 px link field', () => {
    expect(css).toContain('@media (max-width: 1260px)');
    expect(css).toContain('@media (hover: none)');
    expect(phone).toMatch(/\.cdp-link input\s*\{\s*font-size:\s*16px;/);
    expect(phone).toMatch(/\.cdp-tracks\s*\{[^}]*max-height:\s*56px/);
    expect(phone).toMatch(
      /\.cdp-tracks:not\(\.is-open\) \.cdp-tracks__list\s*\{[^}]*visibility:\s*hidden/,
    );
    expect(phone).toMatch(
      /\.cdp-tracks__toggle::before\s*\{[^}]*border-radius:\s*var\(--cdp-radius-control\)/,
    );
  });
});

describe('app.css: the skin picker', () => {
  /** The block that cuts the picker's button down to its swatch. */
  const swatchOnly = /@media \(max-width: 920px\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';

  // The bar stacks from 821 px, and with its label the button left the paste field 106 px wide
  // there, and under 200 px until about 915: the swatch stands alone up to 920 px, not only 820.
  it('shows only its swatch at 920 px and under, where the stacked bar is tight', () => {
    expect(swatchOnly).toMatch(/\.cdp-skin__button\s*\{[^}]*aspect-ratio:\s*1;/);
    expect(swatchOnly).toMatch(/\.cdp-skin__label\s*\{[^}]*clip-path:\s*inset\(50%\);/);
  });

  it('leaves the phone layout block (820 px) to the phone layout alone', () => {
    expect(phone).toContain('.cdp-tracks');
    expect(phone).not.toContain('.cdp-skin');
  });
});
