import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN, SKINS, skinById, type SkinRole } from './skins';

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
/** The shell's panels, --cdp-panel in src/styles/app.css, taken opaque. */
const PANEL = '#100c0e';

/** WCAG 2's relative luminance of an sRGB hex colour. */
function luminance(hex: string): number {
  const channel = (at: number) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2's contrast ratio of two sRGB hex colours, the lighter over the darker. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('skins', () => {
  it('offers Blush, Sage, Cream and Cherry in that order, all on the one GLB', () => {
    expect(SKINS.map((skin) => skin.id)).toEqual(['blush', 'sage', 'cream', 'cherry']);
    expect(SKINS.map((skin) => skin.name)).toEqual(['Blush', 'Sage', 'Cream', 'Cherry']);
    for (const skin of SKINS) expect(skin.model, skin.id).toBe('assets/cd-player.glb');
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
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('keeps every accent readable: text on it at 4.5:1, it on a panel at 3:1', () => {
    for (const skin of SKINS) {
      const text = contrast(skin.onAccent, skin.accent);
      const mark = contrast(skin.accent, PANEL);
      expect(text, `${skin.id}: onAccent on accent`).toBeGreaterThanOrEqual(4.5);
      expect(mark, `${skin.id}: accent on a panel`).toBeGreaterThanOrEqual(3);
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
