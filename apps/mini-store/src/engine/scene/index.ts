// Assembles the whole diorama. The atlas must exist first: meshes look up their UV rects in it.
import { buildAtlas } from '../atlas';
import { Mesh } from '../mesh';
import { buildHouses } from './houses';
import { buildInterior } from './interior';
import { buildStorefront } from './storefront';
import { buildStreet } from './street';
import type { Ctx, SceneData } from './types';

export type { DoorDef, Light, SceneData, Spot } from './types';

// Built once per mount and released on dispose (`releaseScene`, called by `Engine.dispose`): the
// atlas canvas and the geometry would otherwise outlive the project inside the host. StrictMode's
// double effect never constructs two engines, because SceneCanvas cancels the first boot before it
// constructs.
let cached: { scene: SceneData; atlas: HTMLCanvasElement } | null = null;

/** Drops the cached atlas and geometry; the next `getScene()` builds them again. */
export function releaseScene(): void {
  cached = null;
}

/** Builds atlas + geometry once per mount: the first call builds, later calls reuse. */
export function getScene(): { scene: SceneData; atlas: HTMLCanvasElement } {
  if (cached) return cached;
  const atlas = buildAtlas();
  const S: SceneData = {
    op: new Mesh(),
    gl: new Mesh(),
    lights: [],
    spots: [],
    dyn: {},
    door: { z: 0, left: 0, right: 0, travel: 0, box: [0, 0, 0, 0, 0, 0] },
  };
  const ctx: Ctx = {
    S,
    O: S.op,
    G: S.gl,
    L: (x, y, z, rad, col, k = 1, fl = 0) => {
      S.lights.push([x, y, z, rad, col[0] * k, col[1] * k, col[2] * k, fl]);
    },
    SPOT: (p, d, inner, outer, rad, col, k) => {
      S.spots.push({ p, d, inner, outer, rad, col, k });
    },
  };
  // order matters: parts share the seeded RNG stream
  buildStorefront(ctx);
  buildInterior(ctx);
  buildHouses(ctx);
  buildStreet(ctx);
  cached = { scene: S, atlas };
  return cached;
}
