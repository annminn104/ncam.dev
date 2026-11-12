import { describe, expect, it } from 'vitest';
import { DECK_ATLAS, pxPerMm, type AtlasRegion, type RegionKind } from './deck-atlas';

const KINDS: readonly RegionKind[] = ['plate', 'ring', 'panel', 'band', 'nameplate'];
const { width, height, regions } = DECK_ATLAS;

/** How far apart two regions stand: the larger of their gaps across and down (< 0: overlap). */
function apart(a: AtlasRegion, b: AtlasRegion): number {
  return Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
}

describe('DECK_ATLAS (deck-atlas.json, as the Blender build writes it)', () => {
  it('lays every region inside the canvas, no two closer than 4 px', () => {
    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) {
      expect(region.x, region.id).toBeGreaterThanOrEqual(0);
      expect(region.y, region.id).toBeGreaterThanOrEqual(0);
      expect(region.x + region.w, region.id).toBeLessThanOrEqual(width);
      expect(region.y + region.h, region.id).toBeLessThanOrEqual(height);
      for (const other of regions) {
        if (other !== region) {
          expect(apart(region, other), `${region.id} and ${other.id}`).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('gives each region the same pixels per mm across and down, within 2 %', () => {
    for (const region of regions) {
      const across = region.w / region.mmW;
      const down = region.h / region.mmH;
      expect(Math.abs(across - down) / Math.max(across, down), region.id).toBeLessThanOrEqual(0.02);
    }
  });

  it('gives the top plate and the stencil 2 px per mm at least, and every other region 1.5', () => {
    for (const region of regions) {
      const least = region.kind === 'plate' || region.stencil ? 2 : 1.5;
      expect(
        Math.min(region.w / region.mmW, region.h / region.mmH),
        region.id,
      ).toBeGreaterThanOrEqual(least);
    }
  });

  it('has one nameplate, one stencil on a case panel, and a region of every kind', () => {
    expect(regions.filter((region) => region.kind === 'nameplate')).toHaveLength(1);
    const stencils = regions.filter((region) => region.stencil);
    expect(stencils).toHaveLength(1);
    expect(stencils[0]).toMatchObject({ kind: 'panel', ground: 'case' });
    for (const kind of KINDS) {
      expect(
        regions.some((region) => region.kind === kind),
        kind,
      ).toBe(true);
    }
  });

  it("puts the top plate's centre inside it, and a centre on no other region", () => {
    for (const region of regions) {
      if (region.kind !== 'plate') {
        expect(region.centre, region.id).toBeUndefined();
        continue;
      }
      const [cx, cy] = region.centre ?? [-1, -1];
      expect(cx).toBeGreaterThan(0);
      expect(cx).toBeLessThan(region.w);
      expect(cy).toBeGreaterThan(0);
      expect(cy).toBeLessThan(region.h);
    }
  });
});

describe('pxPerMm', () => {
  it("is a region's width in pixels over its width in mm", () => {
    for (const region of regions) expect(pxPerMm(region), region.id).toBe(region.w / region.mmW);
  });
});
