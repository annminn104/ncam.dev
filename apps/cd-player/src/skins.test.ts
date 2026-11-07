import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN, SKINS, skinById, type SkinRole } from './skins';
import { BLACK, WHITE, contrast, cssNumber, cssToken, inkOf, mix, rgb } from './testing/contrast';

// Every role, held to the type by the compiler: a role added to SkinRole and missing here (or the
// other way round) fails the typecheck.
const ROLE_SET: Record<SkinRole, true> = {
  leather: true,
  trim: true,
  thread: true,
  lining: true,
  hardware: true,
  deck: true,
  grille: true,
};
const ROLES = Object.keys(ROLE_SET).sort();
const HEX = /^#[0-9a-f]{6}$/;

describe('skins', () => {
  it('offers Blush, Sage, Cream and Cherry in that order', () => {
    expect(SKINS.map((skin) => skin.id)).toEqual(['blush', 'sage', 'cream', 'cherry']);
    expect(SKINS.map((skin) => skin.name)).toEqual(['Blush', 'Sage', 'Cream', 'Cherry']);
  });

  it('gives every role a colour in every skin, and no other key', () => {
    for (const skin of SKINS) expect(Object.keys(skin.palette).sort(), skin.id).toEqual(ROLES);
  });

  it('writes every colour as a six-digit lower-case sRGB hex', () => {
    for (const skin of SKINS) {
      for (const value of [skin.accent, skin.onAccent, ...Object.values(skin.palette)]) {
        expect(value, skin.id).toMatch(HEX);
      }
    }
  });

  it('measures contrast as WCAG does', () => {
    expect(contrast(WHITE, BLACK)).toBeCloseTo(21, 5);
    expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrast(rgb('#777777'), WHITE)).toBeCloseTo(4.48, 2);
    // Each channel halved, as Chrome computes the ink for Blush.
    expect(inkOf(rgb('#e8a3b0'))).toEqual([116, 81.5, 88]);
  });

  it('keeps the text on every accent at 4.5:1, on its fill hovered and pressed too', () => {
    const ink = cssToken('ink').colour;
    // The fills of Load and Play: mixed with the ink on hover, with black while pressed.
    const hover = cssNumber(
      /\.cdp-button--primary:hover:not\(:disabled\)\s*\{\s*background:\s*color-mix\(in srgb, var\(--cdp-accent\) (\d+)%, var\(--cdp-ink\)\);/,
    );
    const press = cssNumber(
      /\.cdp-button--primary:active:not\(:disabled\)\s*\{\s*background:\s*color-mix\(in srgb, var\(--cdp-accent\) (\d+)%, rgb\(0 0 0\)\);/,
    );
    for (const skin of SKINS) {
      const accent = rgb(skin.accent);
      const text = rgb(skin.onAccent);
      expect(contrast(text, accent), `${skin.id}: on the accent`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(text, mix(accent, hover / 100, ink)),
        `${skin.id}: hovered`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(text, mix(accent, press / 100, BLACK)),
        `${skin.id}: pressed`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  // The page at its darkest: the skin's wash with a black cover multiplied in at the art's opacity,
  // which keeps (1 - opacity) of it. A panel is --cdp-panel over that page (its blur only averages
  // the page behind it). The glows are left out: only the warm one reaches the stage's foot, and
  // faintly; on the live page the help line measured 4.66:1 at its worst, over 12 covers and black.
  it('keeps the shell readable on the glass and on the page over the darkest art', () => {
    const wash = cssNumber(
      /--cdp-wash:\s*color-mix\(in srgb, var\(--cdp-accent\) (\d+)%, rgb\(255 255 255\)\);/,
    );
    const art = cssNumber(/\.cdp-backdrop__layer::before\s*\{[^}]*opacity:\s*([\d.]+);/);
    const [ink, faint, error, panel] = ['ink', 'ink-faint', 'error', 'panel'].map(cssToken);
    for (const skin of SKINS) {
      const accent = rgb(skin.accent);
      const page = mix(mix(accent, wash / 100, WHITE), 1 - art, BLACK);
      const glass = mix(panel.colour, panel.alpha, page);
      // The help line and the loader's line, and the ring of "Open the player" (3:1 would do).
      expect(contrast(ink.colour, page), `${skin.id}: the ink on the page`).toBeGreaterThanOrEqual(
        4.5,
      );
      // The faintest text on a panel (the tags, the numbers, the eyebrows), and the link's error.
      const faintText = mix(faint.colour, faint.alpha, glass);
      expect(
        contrast(faintText, glass),
        `${skin.id}: the faint ink on the glass`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(error.colour, glass),
        `${skin.id}: the error on the glass`,
      ).toBeGreaterThanOrEqual(4.5);
      // The accent's marks on a panel: the ring, the progress, the playing row, the switches on.
      expect(
        contrast(inkOf(accent), glass),
        `${skin.id}: the accent's ink on the glass`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('answers the default for an id it does not know', () => {
    expect(DEFAULT_SKIN).toBe('blush');
    expect(skinById('sage').id).toBe('sage');
    for (const id of ['midnight', '', null, undefined, 'toString', '__proto__']) {
      expect(skinById(id).id, String(id)).toBe(DEFAULT_SKIN);
    }
  });

  it('reads every colour from src/skins.json, the one file that holds them', () => {
    const file = JSON.parse(readFileSync(new URL('./skins.json', import.meta.url), 'utf8')) as {
      skins: unknown;
    };
    expect(file.skins).toEqual(SKINS);
  });
});
