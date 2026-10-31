import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { skinById } from '../skins';
import css from './app.css?inline';

/** The declarations of the first rule whose whole selector is `selector`, at the start of a line. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

/** From the reduced-motion block to the end of the file; the skin picker's rules come after it. */
const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
/** The phone layout's block, which upright tablets share. */
const phone =
  /@media \(max-width: 820px\), \(max-width: 1260px\) and \(max-aspect-ratio: 4\/5\)\s*\{([\s\S]*?)\n\}/.exec(
    css,
  )?.[1] ?? '';
/** The tablets' and small laptops' block. */
const medium = /@media \(max-width: 1260px\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
/** A rule's declarations inside a media block's text. */
function inner(block: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(block)?.[1] ?? '';
}
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

  it("falls back to Blush's own accent pair from src/skins.json, under the inline skin's", () => {
    const blush = skinById('blush');
    expect(token('accent')).toBe(blush.accent);
    expect(token('on-accent')).toBe(blush.onAccent);
  });

  it('names no colour outside the tokens but neutral greys', () => {
    expect(rest.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    // Each channel whole (a whole number, a decimal or a percentage) and compared as written; the
    // third ends at the alpha's `/` or at the `)`, so a form the guard does not read stays unread.
    const channels = /rgb\((\d*\.?\d+%?) (\d*\.?\d+%?) (\d*\.?\d+%?)(?=\s*[/)])/g;
    for (const [, r, g, b] of rest.matchAll(channels)) {
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
    // The preset of the collection in view, tinted and bordered as a switch that is on.
    expect(rule('.cdp-preset.is-current')).toMatch(
      /background:\s*color-mix\(in srgb, var\(--cdp-accent\) 14%, transparent\);\s*border-color:\s*var\(--cdp-accent\);/,
    );
  });

  it('keeps square controls: 4 px keys, rows, fields and buttons, 32 and 28 px keys', () => {
    for (const selector of [
      '.cdp-key',
      '.cdp-button',
      '.cdp-link input',
      '.cdp-track',
      '.cdp-enter',
      '.cdp-preset',
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

describe('app.css: the layout', () => {
  it('lays a wide screen out as the rail, the stage and the side column, in the viewport', () => {
    expect(root).toMatch(/display:\s*grid;/);
    expect(root).toMatch(/grid-template-columns:\s*340px minmax\(0, 1fr\) 360px;/);
    expect(root).toMatch(/grid-template-areas:\s*'bar stage side';/);
    // The padding is inside the 100dvh, or the columns would run under the bottom edge.
    expect(root).toMatch(/box-sizing:\s*border-box;/);
    expect(root).toMatch(/height:\s*100dvh;/);
    expect(rule('.cdp-bar')).toMatch(/grid-area:\s*bar;/);
    expect(rule('.cdp-stage')).toMatch(/grid-area:\s*stage;/);
    expect(rule('.cdp-side')).toMatch(/grid-area:\s*side;/);
  });

  it('puts the header over the stage beside the side column from 1260 px down', () => {
    expect(inner(medium, '.cdp-root')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) 360px;[\s\S]*grid-template-areas:\s*'bar side'\s*'stage side';/,
    );
    expect(inner(medium, '.cdp-hud')).toMatch(/display:\s*none;/);
  });

  it('stacks a phone: the bar, the stage and the card, with the sheet over them', () => {
    expect(inner(phone, '.cdp-root')).toMatch(/grid-template-areas:\s*'bar'\s*'stage'\s*'now';/);
    // The closed sheet's 56 px, and 12 px either side of it, stay clear of the card.
    expect(inner(phone, '.cdp-root')).toMatch(/padding:\s*12px 12px 80px;/);
    expect(inner(phone, '.cdp-side')).toMatch(/display:\s*contents;/);
    expect(inner(phone, '.cdp-now')).toMatch(/grid-area:\s*now;/);
    expect(inner(phone, '.cdp-tracks')).toMatch(/position:\s*absolute;[\s\S]*bottom:\s*12px;/);
  });

  it('centres the loader and the way in on the stage, the help line at its foot', () => {
    expect(rule('.cdp-stage')).toMatch(/position:\s*relative;/);
    expect(rule('.cdp-scene')).toMatch(/position:\s*absolute;\s*inset:\s*0;/);
    for (const selector of ['.cdp-loader', '.cdp-gate']) {
      expect(rule(selector), selector).toMatch(/left:\s*50%;\s*top:\s*50%;/);
    }
    expect(rule('.cdp-hud')).toMatch(/bottom:\s*0;/);
  });

  it('gives the tracklist what the card leaves of the side column', () => {
    expect(rule('.cdp-side')).toMatch(/flex-direction:\s*column;/);
    // `rule` would find the panels' shared rule, whose selector list ends with `.cdp-now {`.
    expect(css).toMatch(/\n\.cdp-now \{\s*flex:\s*none;/);
    expect(rule('.cdp-tracks')).toMatch(/flex:\s*1;\s*min-height:\s*0;/);
  });
});

describe('app.css: Popular on Spotify', () => {
  it('lists the presets as rows that scroll in what the rail leaves them', () => {
    expect(rule('.cdp-presets')).toMatch(/flex:\s*1;[\s\S]*min-height:\s*0;/);
    expect(rule('.cdp-presets__list')).toMatch(/display:\s*grid;[\s\S]*overflow-y:\s*auto;/);
    expect(rule('.cdp-preset')).toMatch(/grid-template-columns:\s*44px minmax\(0, 1fr\);/);
    expect(rule('.cdp-preset__cover')).toMatch(/width:\s*44px;\s*height:\s*44px;/);
  });

  it('makes them a row of cards that scrolls sideways in the header, fading at its end', () => {
    expect(inner(medium, '.cdp-presets__list')).toMatch(
      /display:\s*flex;[\s\S]*overflow-x:\s*auto;[\s\S]*mask-image:\s*linear-gradient/,
    );
    expect(inner(medium, '.cdp-presets__list li')).toMatch(/flex:\s*0 0 184px;/);
    expect(inner(medium, '.cdp-preset__cover')).toMatch(/width:\s*48px;\s*height:\s*48px;/);
  });

  it('makes them chips on a phone, the tag kept for a screen reader', () => {
    expect(inner(phone, '.cdp-preset')).toMatch(/display:\s*flex;[\s\S]*height:\s*44px;/);
    expect(inner(phone, '.cdp-preset__cover')).toMatch(/width:\s*36px;\s*height:\s*36px;/);
    expect(inner(phone, '.cdp-preset__tag')).toMatch(/clip-path:\s*inset\(50%\);/);
    expect(inner(phone, '.cdp-preset__tag')).not.toMatch(/display:\s*none/);
  });

  it('draws the focus ring inside the scrolling list, which would cut it', () => {
    expect(rule('.cdp-presets :focus-visible')).toMatch(/outline-offset:\s*-2px;/);
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
