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
/** A media block's text, its query given with single spaces (Prettier may break it over lines). */
function block(query: string): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`@media ${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? '';
}
/** The phone layout's block, which upright tablets share. */
const phone = block(
  '(max-width: 820px) and (max-aspect-ratio: 13/10), (max-width: 1260px) and (max-aspect-ratio: 4/5)',
);
/** The block of phones held sideways and other short screens. */
const short = block(
  '(max-width: 1100px) and (max-height: 600px) and (min-aspect-ratio: 1301/1000)',
);
/** The tablets' and small laptops' block. */
const medium = block('(max-width: 1100px), (max-width: 1260px) and (max-aspect-ratio: 8/5)');
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

describe('app.css: the glass panel', () => {
  it('declares the tokens: white glass, dark type, the pastel page and the accent’s ink', () => {
    expect(token('radius')).toBe('6px');
    expect(token('radius-control')).toBe('4px');
    expect(token('ink')).toBe('rgb(36 22 28)');
    expect(token('panel')).toBe('rgb(255 255 255 / 0.6)');
    expect(token('edge')).toBe('rgb(255 255 255 / 0.75)');
    expect(token('line')).toBe('rgb(36 22 28 / 0.14)');
    expect(token('mono')).toBe('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace');
    expect(token('accent')).toBe('#e8a3b0');
    expect(token('on-accent')).toBe('#2a1a1e');
    // Derived from the skin's accent, so every skin gets its own (src/skins.test.ts checks the ink).
    expect(token('accent-ink')).toBe('color-mix(in srgb, var(--cdp-accent) 50%, rgb(0 0 0))');
    expect(token('wash')).toBe('color-mix(in srgb, var(--cdp-accent) 38%, rgb(255 255 255))');
    // src/skins.test.ts holds it, with the type, at 4.5:1 on the glass over the darkest art.
    expect(token('error')).toBe('#a1211a');
  });

  // The unprefixed property: Chrome and Firefox read no other.
  const frost = /(?<!-webkit-)backdrop-filter:\s*blur\(24px\) saturate\(1\.8\);/;

  it('frosts every panel: the glass, its bright edge, one shadow, a 24 px blur', () => {
    // `rule('.cdp-now')` is the panels' shared rule, whose selector list ends with `.cdp-now {`,
    // and `.cdp-now::before` their glass's.
    expect(rule('.cdp-now')).toMatch(/border:\s*1px solid var\(--cdp-edge\);/);
    expect(rule('.cdp-now')).not.toMatch(/backdrop-filter|background:/);
    const glass = rule('.cdp-now::before');
    expect(glass).toMatch(/z-index:\s*-1;\s*inset:\s*0;\s*border-radius:\s*inherit;/);
    expect(glass).toMatch(/background:\s*var\(--cdp-panel\);/);
    expect(glass).toMatch(frost);
    expect(rule(".cdp-gate[role='alert']")).toMatch(frost);
  });

  it('frosts the picker’s popover too, whiter, so the presets under it never show through', () => {
    // Its frost sees the presets only because no ancestor of it has a backdrop filter (above).
    const menu = rule('.cdp-skin .cdp-skin__menu');
    expect(menu).toMatch(/background:\s*rgb\(255 255 255 \/ 0\.92\);/);
    expect(menu).toMatch(frost);
    // A white hover would not show on it.
    expect(rule('.cdp-skin .cdp-skin__option:hover')).toMatch(
      /background:\s*color-mix\(in srgb, var\(--cdp-ink\) 7%, transparent\);/,
    );
  });

  it('makes the glass all but opaque where the visitor asks for less transparency', () => {
    const opaque = block('(prefers-reduced-transparency: reduce)');
    expect(opaque).toMatch(
      /\.cdp-bar::before,\s*\.cdp-tracks::before,\s*\.cdp-now::before,\s*\.cdp-gate\[role='alert'\]\s*\{\s*background:\s*rgb\(255 255 255 \/ 0\.94\);/,
    );
  });

  it('sets what stands on the page itself, not on a panel, in the full ink', () => {
    // The art can darken the page by 36 %: the soft ink fell under 4.5:1 there, the accent's ink
    // under 3:1 for the ring of "Open the player".
    expect(rule('.cdp-hud')).toMatch(/color:\s*var\(--cdp-ink\);/);
    expect(rule('.cdp-loader__line')).toMatch(/color:\s*var\(--cdp-ink\);/);
    expect(rule('.cdp-root .cdp-enter:focus-visible')).toMatch(
      /outline-color:\s*var\(--cdp-ink\);/,
    );
  });

  it('lays the page in the skin’s pastel, the album art multiplied into it', () => {
    expect(root).toMatch(/background:\s*var\(--cdp-wash\);/);
    expect(rule('.cdp-backdrop__layer')).toMatch(/var\(--cdp-accent\)[\s\S]*var\(--cdp-wash\);/);
    // At 36 %, the darkest the art can take the page, as src/skins.test.ts reckons it.
    expect(rule('.cdp-backdrop__layer::before')).toMatch(
      /opacity:\s*0\.36;\s*mix-blend-mode:\s*multiply;/,
    );
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

  it('has no pills, no italic, no Fraunces, no layered shadows and no blur over 24 px', () => {
    expect(css).not.toContain('999px');
    expect(css).not.toMatch(/border-radius:\s*50%/);
    expect(css).not.toMatch(/font-style:\s*italic/);
    expect(css).not.toContain('Fraunces');
    for (const [, value] of css.matchAll(/box-shadow:\s*([^;]+);/g)) {
      expect(value, value).not.toMatch(/\)\s*,/);
    }
    for (const [, px] of css.matchAll(/backdrop-filter:\s*blur\((\d+)px\)/g)) {
      expect(Number(px)).toBeLessThanOrEqual(24);
    }
  });

  it('fills Load and Play with the accent, and marks the rest with its ink, on white glass', () => {
    expect(rule('.cdp-button--primary')).toMatch(/background:\s*var\(--cdp-accent\)/);
    expect(rule('.cdp-key--main')).toMatch(/background:\s*var\(--cdp-accent\)/);
    expect(rule('.cdp-now__seek::-webkit-slider-runnable-track')).toContain(
      'linear-gradient(var(--cdp-accent-ink), var(--cdp-accent-ink))',
    );
    expect(rule('.cdp-now__seek::-moz-range-progress')).toMatch(
      /background:\s*var\(--cdp-accent-ink\)/,
    );
    expect(rule('.cdp-track.is-current::before')).toMatch(/background:\s*var\(--cdp-accent-ink\)/);
    expect(rule('.cdp-eq span')).toMatch(/background:\s*var\(--cdp-accent-ink\)/);
    expect(rule(".cdp-key--small[aria-pressed='true']")).toMatch(
      /color:\s*var\(--cdp-accent-ink\)/,
    );
    expect(rule(".cdp-key--small[aria-pressed='true']::after")).toMatch(
      /background:\s*currentcolor/,
    );
    expect(rule('.cdp-root :focus-visible')).toMatch(
      /outline:\s*2px solid var\(--cdp-accent-ink\)/,
    );
    // The preset of the collection in view, tinted and bordered as a switch that is on.
    expect(rule('.cdp-preset.is-current')).toMatch(
      /background:\s*color-mix\(in srgb, var\(--cdp-accent\) 14%, transparent\);\s*border-color:\s*var\(--cdp-accent-ink\);/,
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
    expect(medium).not.toBe('');
    expect(phone).not.toBe('');
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

  it('puts the header over the stage beside the side column, but where it would be too short', () => {
    expect(inner(medium, '.cdp-root')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) 360px;[\s\S]*grid-template-areas:\s*'bar side'\s*'stage side';/,
    );
    expect(inner(medium, '.cdp-hud')).toMatch(/display:\s*none;/);
    // One row for the field and its buttons: a wrapped one hung the picker's popover off-screen.
    expect(inner(medium, '.cdp-link')).toMatch(/flex-wrap:\s*nowrap;/);
    expect(inner(medium, '.cdp-link input')).toMatch(/flex:\s*1 1 0;/);
    // The header is never squeezed below its content.
    expect(inner(medium, '.cdp-bar')).toMatch(/min-height:\s*auto;/);
  });

  it('stacks a phone: the bar, the stage and the card, with the sheet over them', () => {
    expect(inner(phone, '.cdp-root')).toMatch(/grid-template-areas:\s*'bar'\s*'stage'\s*'now';/);
    // The stage keeps 220 px: on a small phone the page grows and scrolls rather than lose it.
    expect(inner(phone, '.cdp-root')).toMatch(
      /grid-template-rows:\s*auto minmax\(220px, 1fr\) auto;[\s\S]*height:\s*auto;\s*min-height:\s*100dvh;/,
    );
    // The closed sheet's 56 px, and 12 px either side of it, stay clear of the card; at the top,
    // in the host, the bar clears the host's back button (its --stage-top-inset).
    expect(inner(phone, '.cdp-root')).toMatch(
      /padding:\s*var\(--stage-top-inset, 12px\) 12px 80px;/,
    );
    expect(inner(phone, '.cdp-side')).toMatch(/display:\s*contents;/);
    expect(inner(phone, '.cdp-now')).toMatch(/grid-area:\s*now;/);
    // Fixed: on a small phone whose page scrolls, the closed sheet stays at the screen's foot.
    expect(inner(phone, '.cdp-tracks')).toMatch(/position:\s*fixed;[\s\S]*bottom:\s*12px;/);
  });

  it('holds the stage still beside the scrolling column on a phone held sideways', () => {
    // The root scrolls, not the page, so the sticky stage holds under a host whose wrapper is a
    // scroll container of its own (the portfolio's `.stage`, `overflow-x: hidden`).
    expect(inner(short, '.cdp-root')).toMatch(
      /grid-template-areas:\s*'stage bar'\s*'stage side';[\s\S]*overflow:\s*hidden auto;/,
    );
    expect(inner(short, '.cdp-root')).not.toMatch(/height:/);
    expect(inner(short, '.cdp-root')).toMatch(
      /padding:\s*12px max\(12px, env\(safe-area-inset-right\)\) 12px max\(12px, env\(safe-area-inset-left\)\);/,
    );
    // Sticky to the root's padding edge, 12 px down: `top: 0` (the padding counts).
    expect(inner(short, '.cdp-stage')).toMatch(
      /position:\s*sticky;\s*top:\s*0;[\s\S]*height:\s*calc\(100dvh - 24px\);/,
    );
    expect(inner(short, '.cdp-backdrop')).toMatch(/position:\s*fixed;/);
    expect(inner(short, '.cdp-tracks')).toMatch(/max-height:\s*calc\(100dvh - 24px\);/);
    // The rail's form, at the 16 px iOS Safari zooms under.
    expect(inner(short, '.cdp-link')).toMatch(/flex-wrap:\s*wrap;/);
    expect(inner(short, '.cdp-link input')).toMatch(/flex:\s*1 1 100%;\s*font-size:\s*16px;/);
  });

  it('keeps the sideways block and the phone one apart by aspect: 13:10 and under, or over', () => {
    expect(css).toContain('(max-width: 820px) and (max-aspect-ratio: 13/10)');
    expect(css).toContain('(min-aspect-ratio: 1301/1000)');
  });

  it('clips the page and never scrolls it, `hidden` where `clip` is unknown', () => {
    expect(root).toMatch(/overflow:\s*hidden;\s*overflow:\s*clip;/);
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

  it('marks the one being loaded, its cover dimmed where its tag is out of sight', () => {
    expect(rule(".cdp-preset[aria-busy='true'] .cdp-preset__cover")).toMatch(/opacity:\s*0\.45;/);
  });

  it('makes them chips on a phone, the tag kept for a screen reader', () => {
    // Positioned, so a clipped tag sits in its chip, inside the row's scroll, not past the page.
    expect(rule('.cdp-preset')).toMatch(/position:\s*relative;/);
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

  // The tablet header starts at 821 px, where the labelled button left the paste field little room
  // on the buttons' row: the swatch stands alone up to 920 px, not only 820.
  it('shows only its swatch at 920 px and under, where the header is tight', () => {
    expect(swatchOnly).toMatch(/\.cdp-skin__button\s*\{[^}]*aspect-ratio:\s*1;/);
    expect(swatchOnly).toMatch(/\.cdp-skin__label\s*\{[^}]*clip-path:\s*inset\(50%\);/);
  });

  it('leaves the phone layout block (820 px) to the phone layout alone', () => {
    expect(phone).toContain('.cdp-tracks');
    expect(phone).not.toContain('.cdp-skin');
  });
});
