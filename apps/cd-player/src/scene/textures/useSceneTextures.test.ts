import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The hook runs in R3F's frame loop, which a node test cannot drive: these read its source, as
// App.test.ts reads App.tsx.
const source = readFileSync(new URL('./useSceneTextures.ts', import.meta.url), 'utf8');

describe('useSceneTextures', () => {
  it('prints the defaults once per rig, never again for a new display colour', () => {
    // The effect that puts the defaults on the plate and the tag runs for a new rig alone: with the
    // colour among its dependencies, a Clear light change printed "Your playlist" on both until
    // the view next changed.
    expect(source).toMatch(
      /paintCard\(canvases\.card, null\);[\s\S]*?paintTag\(canvases\.tag, null\);[\s\S]*?\}, \[rig, surfaces, screen\]\);/,
    );
    expect(source.match(/paintCard\(canvases\.card, null\)/g)).toHaveLength(1);
  });

  it("prints the deck's screen again when its track changes, not only its number", () => {
    expect(source).toMatch(/lcd\.id === id/);
    expect(source).toMatch(/lcd\.title === title/);
    expect(source).toMatch(/lcd\.artists === artists/);
  });

  it('prints the display again when its colour changes, on the next frame', () => {
    expect(source).toMatch(/lcd\.colour === lcdColour/);
    expect(source).toMatch(/lcd\.colour = lcdColour;/);
  });
});
