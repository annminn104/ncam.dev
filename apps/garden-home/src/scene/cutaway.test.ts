import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  DoubleSide,
  FrontSide,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import basementPy from '../../art/blender/scripts/basement/basement_layout.py?raw';
import commonPy from '../../art/blender/scripts/houses/house_parts/common.py?raw';
import { applyWind } from '../systems/wind';
import { createWaterMaterial } from '../systems/water';
import {
  applyCut,
  bury,
  CUT_ABOVE_FLOOR,
  CUT_CAMERA_CLEAR,
  CUT_CAMERA_HYSTERESIS,
  CUT_DISTANCES,
  CUTAWAY_MODULES,
  cutHeight,
  cutLevel,
  type CutLevel,
  cutLevelFor,
  cutOnlyByButton,
  findOpenings,
  forcedCut,
  HIDDEN_LAYER,
  HOUSE_LEVELS,
  leaveOutDetails,
  moduleCut,
  nearHouse,
  prepareCutaway,
  showThroughOpenings,
  UNDER_LAWN_ORDER,
  UNDERGROUND,
  voidCutHeight,
  warmCut,
} from './cutaway';

/** A number assigned at the start of a line of common.py, e.g. `PLINTH = 0.45`, `BASEMENT_FLOOR = -3.62`. */
function pyConstant(name: string): number {
  const match = new RegExp(`^${name} = (-?[0-9.]+)`, 'm').exec(commonPy);
  if (!match) throw new Error(`${name} not found in house_parts/common.py`);
  return Number(match[1]);
}

const HIGH = 30; // a camera well above every cut

describe('house heights', () => {
  it('match houses/house_parts/common.py', () => {
    expect(HOUSE_LEVELS.plinth).toBe(pyConstant('PLINTH'));
    expect(HOUSE_LEVELS.upperFloor).toBe(pyConstant('UPPER_FLOOR'));
  });

  it('cut where houses/house_parts/common.py puts it: the wall switches are checked against it', () => {
    expect(CUT_ABOVE_FLOOR).toBe(pyConstant('CUT_ABOVE_FLOOR'));
    expect(cutHeight('ground')).toBeCloseTo(
      pyConstant('PLINTH') + pyConstant('CUT_ABOVE_FLOOR'),
      9,
    );
    expect(cutHeight('upper')).toBeCloseTo(
      pyConstant('UPPER_FLOOR') + pyConstant('CUT_ABOVE_FLOOR'),
      9,
    );
  });
});

describe('cutHeight', () => {
  it('cuts 1.6 m above the floor of the storey on show (AGENTS.md, Controls)', () => {
    expect(CUT_ABOVE_FLOOR).toBe(1.6);
    expect(cutHeight('upper')).toBeCloseTo(6.86, 9); // the tall house's upper floor, 5.26 m
    expect(cutHeight('ground')).toBeCloseTo(2.05, 9);
    expect(cutHeight('none')).toBeNull();
  });
});

describe('cutLevel', () => {
  it('shows the whole house beyond 45 m, the upper floor from 28 m and the ground floor closer', () => {
    expect(cutLevel(80, HIGH, 'none')).toBe('none');
    expect(cutLevel(36, HIGH, 'upper')).toBe('upper');
    expect(cutLevel(15, HIGH, 'ground')).toBe('ground');
    expect(CUT_DISTANCES).toEqual({ upper: 45, ground: 28, hysteresis: 3 });
  });

  it('holds the previous level within 3 m of a threshold, so a zoom near it does not flicker', () => {
    const walk = (distances: number[], start: CutLevel = 'none') => {
      let level = start;
      return distances.map((d) => (level = cutLevel(d, HIGH, level)));
    };
    // zooming in: each cut waits until 3 m past its threshold
    expect(walk([50, 43, 42.1, 41.9, 30, 25.1, 24.9])).toEqual([
      'none',
      'none',
      'none',
      'upper',
      'upper',
      'upper',
      'ground',
    ]);
    // zooming out: each cut stays until 3 m past its threshold
    expect(walk([20, 30, 30.9, 31.1, 47.9, 48.1], 'ground')).toEqual([
      'ground',
      'ground',
      'ground',
      'upper',
      'upper',
      'none',
    ]);
    // a jump across both thresholds lands on the right level at once
    expect(cutLevel(10, HIGH, 'none')).toBe('ground');
    expect(cutLevel(100, HIGH, 'ground')).toBe('none');
  });

  it('only starts a cut while the camera is more than 2 m above it: from below the island the house stays whole', () => {
    expect(CUT_CAMERA_CLEAR).toBe(2);
    expect(cutLevel(36, 6.86 + 2.01, 'none')).toBe('upper');
    // too low for the upper floor's cut, the camera sees the ground floor's, until it is too low for that too
    expect(cutLevel(36, 6.86 + 1.99, 'none')).toBe('ground');
    expect(cutLevel(36, 2.05 + 1.99, 'none')).toBe('none');
    expect(cutLevel(20, 2.05 + 2.01, 'none')).toBe('ground');
    expect(cutLevel(20, 2.05 + 1.99, 'none')).toBe('none');
    expect(cutLevel(20, -12, 'none')).toBe('none');
    expect(cutLevel(20, -12, 'ground')).toBe('none');
  });

  it('keeps a cut until the camera is 0.75 m lower, so grazing the limit does not pop the roof back and recompile', () => {
    expect(CUT_CAMERA_HYSTERESIS).toBe(0.75);
    // the upper cut at 6.86 m starts above 8.86 m and holds down to 8.11 m, under which the ground floor's cut shows
    expect(cutLevel(36, 6.86 + 1.3, 'upper')).toBe('upper');
    expect(cutLevel(36, 6.86 + 1.2, 'upper')).toBe('ground');
    expect(cutLevel(36, 6.86 + 1.3, 'none')).toBe('ground');
    // the ground cut at 2.05 m: 4.05 m to start, 3.3 m to hold
    expect(cutLevel(20, 2.05 + 1.3, 'ground')).toBe('ground');
    expect(cutLevel(20, 2.05 + 1.2, 'ground')).toBe('none');
    const walk = (heights: number[], start: CutLevel = 'none') => {
      let level = start;
      return heights.map((y) => (level = cutLevel(36, y, level)));
    };
    // a camera bobbing about the starting height: one change each way, not one per crossing
    expect(walk([8.81, 8.91, 8.41, 8.16, 8.87, 8.31, 8.01, 8.41, 8.81, 8.91])).toEqual([
      'ground',
      'upper',
      'upper',
      'upper',
      'upper',
      'upper',
      'ground',
      'ground',
      'ground',
      'upper',
    ]);
  });

  it('moves a cut on down while the camera holds the lower limit, and up only once it is clear of the higher cut', () => {
    expect(cutLevel(20, 3.4, 'upper')).toBe('ground'); // zooming in out of the upper cut: 3.4 holds the 2.05 m cut
    expect(cutLevel(36, 8.31, 'ground')).toBe('ground'); // zooming out of the ground cut: too low to start the upper
    expect(cutLevel(36, 8.9, 'ground')).toBe('upper');
    expect(cutLevel(36, 8.31, 'none')).toBe('ground');
  });

  it('never brings the roof back while a zoom goes straight in from a low view, nor on the way out', () => {
    // the site route's first view looks at the house 13.8 degrees down: along that line the camera is too low for the
    // tall house's upper cut (8.86 m to start, 8.11 m to hold) from 34 m in, before the ground cut's 25 m
    const height = (d: number) => d * Math.sin((13.8 * Math.PI) / 180);
    const rank = { none: 0, upper: 1, ground: 2, basement: 3 } as const;
    let level: CutLevel = 'none';
    const seen: CutLevel[] = [];
    for (let d = 60; d >= 15; d -= 0.25) seen.push((level = cutLevel(d, height(d), level)));
    for (let i = 1; i < seen.length; i++)
      expect(rank[seen[i]]).toBeGreaterThanOrEqual(rank[seen[i - 1]]);
    expect(seen).toContain('upper');
    expect(seen.at(-1)).toBe('ground');
    const out: CutLevel[] = [];
    for (let d = 15; d <= 60; d += 0.25) out.push((level = cutLevel(d, height(d), level)));
    for (let i = 1; i < out.length; i++) expect(rank[out[i]]).toBeLessThanOrEqual(rank[out[i - 1]]);
    expect(out.at(-1)).toBe('none');
  });
});

function mesh(material: Material | Material[]): Mesh {
  return new Mesh(new BoxGeometry(), material);
}

describe('prepareCutaway', () => {
  function scene() {
    const white = new MeshStandardMaterial({ name: 'M_white' });
    const glass = new MeshStandardMaterial({
      name: 'GLASS_clear',
      transparent: true,
      opacity: 0.2,
      side: DoubleSide,
    });
    const led = new MeshStandardMaterial({ name: 'M_led' });
    const water = createWaterMaterial();
    const house = new Group();
    house.add(mesh(white), mesh(white), mesh([glass, led]), mesh(water));
    const poolStone = new MeshStandardMaterial({ name: 'M_stone' });
    const pool = new Group();
    pool.add(mesh(poolStone));
    return { house, pool, white, glass, led, water, poolStone };
  }

  it('puts one shared clipping plane on every material of the house and none elsewhere', () => {
    const { house, white, glass, led, water, poolStone } = scene();
    const cut = prepareCutaway(house);
    for (const material of [white, glass, led, water]) {
      expect(material.clippingPlanes).toEqual([cut.plane]);
      expect(material.clipShadows).toBe(true);
    }
    expect(water.clipping).toBe(true); // a ShaderMaterial only clips when it says so
    expect(poolStone.clippingPlanes ?? []).toEqual([]);
    expect(cut.plane.normal.toArray()).toEqual([0, -1, 0]);
  });

  it('starts whole: the plane lies far above everything', () => {
    const cut = prepareCutaway(scene().house);
    expect(cut.plane.distanceToPoint(new Vector3(0, 100, 0))).toBeGreaterThan(0);
  });
});

describe('prepareCutaway and what the house tags uncut', () => {
  /** A glTF node the way GLTFLoader builds a multi-material mesh: a named group holding a mesh per material. */
  function chandelier(extras: Record<string, unknown> = {}) {
    const brass = new MeshStandardMaterial({ name: 'M_brass', side: FrontSide });
    const crystal = new MeshStandardMaterial({ name: 'M_crystal', side: FrontSide });
    const node = new Group();
    node.userData = { name: 'Chandelier', uncut: true, night_light: true, ...extras };
    node.add(mesh(brass), mesh(crystal));
    return { node, brass, crystal };
  }

  it("cuts it at the void's plane, where the upper storey is cut: under the ground floor's cut the chandelier in the double-height void still shows", () => {
    const white = new MeshStandardMaterial({ name: 'M_white' });
    const { node, brass, crystal } = chandelier();
    const house = new Group();
    house.add(mesh(white), node);
    const cut = prepareCutaway(house);
    expect(white.clippingPlanes).toEqual([cut.plane]);
    for (const material of [brass, crystal]) {
      expect(material.clippingPlanes).toEqual([cut.voidPlane]);
      expect(cut.opaque.has(material)).toBe(false);
    }
    expect(cut.voidPlane.normal.toArray()).toEqual([0, -1, 0]);
    applyCut(cut, 'ground', 0.5);
    // the house at 2.05 m, the void at 6.86 m: its body (3.5-5.2 m) shows, its cord stops with the upper floor's walls
    expect(cut.plane.distanceToPoint(new Vector3(0, 0.5 + 2.1, 0))).toBeLessThan(0);
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 0.5 + 6.8, 0))).toBeGreaterThan(0);
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 0.5 + 6.9, 0))).toBeLessThan(0);
    applyCut(cut, 'upper', 0.5);
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 0.5 + 6.9, 0))).toBeLessThan(0);
    expect([brass.side, crystal.side]).toEqual([FrontSide, FrontSide]); // nothing of it is cut open
    expect(white.side).toBe(DoubleSide);
    applyCut(cut, 'none', 0.5);
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 50, 0))).toBeGreaterThan(0);
    expect(cut.voidTop).toBeNull(); // no cut_top: the upper floor's cut under both cuts
  });

  it("under the ground floor's cut brings the void's plane down to its cut_top: the chandelier ends at its crown, no cord rises over the cut house", () => {
    const { node } = chandelier({ cut_top: 5.72 });
    const house = new Group();
    house.add(mesh(new MeshStandardMaterial()), node);
    const cut = prepareCutaway(house);
    expect(cut.voidTop).toBe(5.72);
    applyCut(cut, 'ground', 0.5);
    // its crown (5.67 m) shows, its cord stops 5 cm over it, not at the upper floor's cut (6.86 m) nor the void's ceiling
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 0.5 + 5.7, 0))).toBeGreaterThan(0);
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 0.5 + 5.75, 0))).toBeLessThan(0);
    applyCut(cut, 'upper', 0.5); // the upper floor's walls stand to 6.86 m: its cord goes up with them
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 0.5 + 6.8, 0))).toBeGreaterThan(0);
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 0.5 + 6.9, 0))).toBeLessThan(0);
    applyCut(cut, 'none', 0.5);
    expect(cut.voidPlane.distanceToPoint(new Vector3(0, 50, 0))).toBeGreaterThan(0);
  });

  it("never lifts the void's plane over the upper floor's cut, and keeps the highest cut_top of several", () => {
    expect(voidCutHeight({ voidTop: 5.72 }, 'ground')).toBe(5.72);
    expect(voidCutHeight({ voidTop: 8.5 }, 'ground')).toBeCloseTo(cutHeight('upper')!, 9);
    expect(voidCutHeight({ voidTop: 5.72 }, 'upper')).toBeCloseTo(cutHeight('upper')!, 9);
    expect(voidCutHeight({ voidTop: null }, 'ground')).toBeCloseTo(cutHeight('upper')!, 9);
    expect(voidCutHeight({ voidTop: 5.72 }, 'none')).toBeNull();
    const house = new Group();
    house.add(
      chandelier({ cut_top: 5.2 }).node,
      chandelier({ cut_top: 5.72 }).node,
      chandelier().node,
    );
    expect(prepareCutaway(house).voidTop).toBe(5.72);
  });
});

describe('applyCut', () => {
  it('moves the plane to the cut height plus the slot height, clipping what lies above it', () => {
    const house = new Group();
    house.add(mesh(new MeshStandardMaterial()));
    const cut = prepareCutaway(house);
    applyCut(cut, 'ground', 0.5);
    expect(cut.plane.distanceToPoint(new Vector3(3, 2.05 + 0.5 - 0.01, -2))).toBeGreaterThan(0); // kept
    expect(cut.plane.distanceToPoint(new Vector3(3, 2.05 + 0.5 + 0.01, -2))).toBeLessThan(0); // clipped
    applyCut(cut, 'upper', 0);
    expect(cut.plane.distanceToPoint(new Vector3(0, 6.8, 0))).toBeGreaterThan(0);
    expect(cut.plane.distanceToPoint(new Vector3(0, 6.9, 0))).toBeLessThan(0);
    applyCut(cut, 'none', 0);
    expect(cut.plane.distanceToPoint(new Vector3(0, 50, 0))).toBeGreaterThan(0);
  });

  it('draws the opaque materials double-sided while cut, so a cut wall is not hollow, and restores them when whole', () => {
    const white = new MeshStandardMaterial({ side: FrontSide });
    const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.2, side: DoubleSide });
    const water = createWaterMaterial();
    const house = new Group();
    house.add(mesh(white), mesh(glass), mesh(water));
    const cut = prepareCutaway(house);
    const versions = () => [white.version, glass.version];
    const before = versions();
    applyCut(cut, 'upper', 0);
    expect([white.side, glass.side, water.side]).toEqual([DoubleSide, DoubleSide, FrontSide]);
    expect(white.version).toBeGreaterThan(before[0]); // recompiled for the side change
    expect(glass.version).toBe(before[1]); // transparent ones are left alone
    const cutVersion = white.version;
    applyCut(cut, 'ground', 0);
    expect(white.version).toBe(cutVersion); // another cut height needs no recompile
    applyCut(cut, 'none', 0);
    expect(white.side).toBe(FrontSide);
    expect(glass.side).toBe(DoubleSide);
  });

  it("restores a material's original side whatever it was, however often the house is prepared", () => {
    const back = new MeshStandardMaterial({ side: BackSide });
    const house = new Group();
    house.add(mesh(back));
    const cut = prepareCutaway(house);
    applyCut(cut, 'ground', 0);
    expect(back.side).toBe(DoubleSide);
    applyCut(cut, 'none', 0);
    expect(back.side).toBe(BackSide);
  });

  it('survives a remount while cut: the materials are shared with the clone it replaces and are double-sided now', () => {
    const white = new MeshStandardMaterial({ side: FrontSide });
    const first = new Group();
    first.add(mesh(white));
    applyCut(prepareCutaway(first), 'upper', 0);
    expect(white.side).toBe(DoubleSide);
    const second = new Group();
    second.add(mesh(white));
    const again = prepareCutaway(second); // must not take DoubleSide for the original
    applyCut(again, 'upper', 0);
    applyCut(again, 'none', 0);
    expect(white.side).toBe(FrontSide);
  });

  it('puts the sides right on the first apply too: a fresh cutaway over materials a previous mount left cut', () => {
    const white = new MeshStandardMaterial({ side: FrontSide });
    const first = new Group();
    first.add(mesh(white));
    applyCut(prepareCutaway(first), 'ground', 0);
    const second = new Group();
    second.add(mesh(white));
    applyCut(prepareCutaway(second), 'none', 0);
    expect(white.side).toBe(FrontSide);
  });
});

describe('the basement (art/README.md, Basement)', () => {
  it('is cut 1.6 m over its floor, which houses/house_parts/common.py puts under the ground slab', () => {
    expect(HOUSE_LEVELS.basementFloor).toBe(pyConstant('BASEMENT_FLOOR'));
    expect(cutHeight('basement')).toBeCloseTo(
      pyConstant('BASEMENT_FLOOR') + pyConstant('CUT_ABOVE_FLOOR'),
      9,
    );
    expect(cutHeight('basement')).toBeCloseTo(-2.02, 9);
  });

  it("is never what the camera's distance calls for: auto shows the whole house, the upper floor or the ground floor", () => {
    for (let d = 5; d <= 120; d += 0.5) {
      for (const previous of ['none', 'upper', 'ground', 'basement'] as const) {
        expect(cutLevel(d, HIGH, previous)).not.toBe('basement');
      }
    }
    // leaving the basement for auto close to the house lands on the ground floor's cut, far off on the whole house
    expect(cutLevel(20, HIGH, 'basement')).toBe('ground');
    expect(cutLevel(90, HIGH, 'basement')).toBe('none');
  });

  it('cuts the house, the basement and the interior, each at the levels it has, and no other module', () => {
    expect(Object.keys(CUTAWAY_MODULES).sort()).toEqual(['basement', 'house', 'interior']);
    for (const level of ['none', 'upper', 'ground', 'basement'] as const)
      expect(moduleCut('house', level)).toBe(level);
    expect(moduleCut('basement', 'basement')).toBe('basement');
    // the basement lies under the ground slab: the storeys' cuts leave it whole (and its materials single-sided)
    for (const level of ['none', 'upper', 'ground'] as const)
      expect(moduleCut('basement', level)).toBe('none');
    expect(moduleCut('pool', 'ground')).toBe('none');
  });

  it("runs the void plane at the ground floor's cut, no higher than the top of what stands whole", () => {
    // the house's chandelier is cut away with the ground floor; the basement's light well and walls stand whole
    expect(voidCutHeight({ voidTop: 5.72 }, 'basement')).toBeCloseTo(cutHeight('ground')!, 9);
    expect(voidCutHeight({ voidTop: 1.45 }, 'basement')).toBe(1.45);
    expect(voidCutHeight({ voidTop: null }, 'basement')).toBeCloseTo(cutHeight('ground')!, 9);
  });
});

describe('the interior (art/README.md, Interior)', () => {
  /** A mesh from `bottom` to `top` metres over the slot (module space), standing at the house's middle. */
  function slab(bottom: number, top: number, name: string): Mesh {
    const mesh = new Mesh(new BoxGeometry(2, top - bottom, 2), new MeshStandardMaterial());
    mesh.position.y = (bottom + top) / 2;
    mesh.name = name;
    return mesh;
  }

  it("is cut with the house at every level, by the camera's distance as much as by a floor button", () => {
    for (const level of ['none', 'upper', 'ground', 'basement'] as const)
      expect(moduleCut('interior', level)).toBe(level);
    expect(cutOnlyByButton('interior')).toBe(false);
    expect(cutOnlyByButton('house')).toBe(false);
    expect(cutOnlyByButton('basement')).toBe(true); // only "Basement" cuts the basement: whole, its shaders go unclipped
    expect(cutOnlyByButton('pool')).toBe(false);
  });

  it('clips its decor at the storey\'s cut, leaves out what hangs wholly over it and hides with the house under "Basement"', () => {
    // the decor (curtains up the void to 9.25 m, accessories on both floors) and a bedroom's lamp shades upstairs
    const decor = slab(0.47, 9.25, 'Interior_decor');
    const lamp = slab(5.9, 6.4, 'LT_lamp_bedroom2');
    const root = new Group();
    root.add(decor, lamp);
    const cut = prepareCutaway(root, { unclipWhole: cutOnlyByButton('interior') });
    const material = decor.material as MeshStandardMaterial;
    expect(material.clippingPlanes).toEqual([cut.plane]); // like the house's: the plane stays on, far above while whole
    const drawn = (mesh: Mesh) => mesh.layers.isEnabled(0);

    applyCut(cut, moduleCut('interior', 'none'), 0, 'none');
    expect([drawn(decor), drawn(lamp)]).toEqual([true, true]);
    applyCut(cut, moduleCut('interior', 'upper'), 0, 'upper');
    expect(cut.plane.constant).toBeCloseTo(cutHeight('upper')!, 9);
    expect([drawn(decor), drawn(lamp)]).toEqual([true, true]);
    applyCut(cut, moduleCut('interior', 'ground'), 0, 'ground');
    expect(cut.plane.constant).toBeCloseTo(cutHeight('ground')!, 9);
    expect([drawn(decor), drawn(lamp)]).toEqual([true, false]); // the lamp upstairs lies wholly over the cut
    expect(material.side).toBe(DoubleSide);
    applyCut(cut, moduleCut('interior', 'basement'), 0, 'basement');
    expect([drawn(decor), drawn(lamp)]).toEqual([false, false]); // with the house, over the basement's cut
    expect(lamp.layers.isEnabled(HIDDEN_LAYER)).toBe(true);
    applyCut(cut, moduleCut('interior', 'none'), 0, 'none');
    expect([drawn(decor), drawn(lamp)]).toEqual([true, true]);
    expect(material.clippingPlanes).toEqual([cut.plane]);
  });
});

describe("the interior's details: drawn only while the camera is near the house", () => {
  /** A mesh from `bottom` to `top` metres over the slot, its glTF node tagged detail or not. */
  function piece(bottom: number, top: number, detail: boolean): Mesh {
    const mesh = new Mesh(new BoxGeometry(2, top - bottom, 2), new MeshStandardMaterial());
    mesh.position.y = (bottom + top) / 2;
    if (detail) mesh.userData.detail = true;
    return mesh;
  }
  const drawn = (mesh: Mesh) => mesh.layers.isEnabled(0);

  it('nearHouse: within CUT_DISTANCES.upper of the house focus, held CUT_DISTANCES.hysteresis either side of it', () => {
    expect(nearHouse(80, false)).toBe(false);
    expect(nearHouse(43, false)).toBe(false); // 3 m inside the threshold: not yet
    expect(nearHouse(41.9, false)).toBe(true);
    expect(nearHouse(14.5, false)).toBe(true); // as close as the orbit goes
    expect(nearHouse(47.9, true)).toBe(true); // zooming out: held 3 m past it
    expect(nearHouse(48.1, true)).toBe(false);
    const walk = (distances: number[]) => {
      let near = false;
      return distances.map((d) => (near = nearHouse(d, near)));
    };
    expect(walk([60, 44, 41, 20, 46, 47.5, 49, 44])).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('leaves the small things out from afar, whole or cut, and draws them near, the house whole ("Roof") or cut', () => {
    // the decor (curtains, chairs, trees) and the details (books, cushions, the table laid), both floors
    const decor = piece(0.47, 9.25, false);
    const details = piece(0.9, 6.4, true);
    const root = new Group();
    root.add(decor, details);
    const cut = prepareCutaway(root, { unclipWhole: cutOnlyByButton('interior') });
    applyCut(cut, moduleCut('interior', 'none'), 0, 'none', false); // the site's first view
    expect([drawn(decor), drawn(details)]).toEqual([true, false]);
    expect(details.layers.isEnabled(HIDDEN_LAYER)).toBe(true);
    // "Roof" at 20 m, or close by on auto with the camera too low for a cut: the house whole, its rooms near
    applyCut(cut, moduleCut('interior', 'none'), 0, 'none', true);
    expect([drawn(decor), drawn(details)]).toEqual([true, true]);
    for (const level of ['upper', 'ground'] as const) {
      applyCut(cut, moduleCut('interior', level), 0, level, true);
      expect([drawn(decor), drawn(details)], level).toEqual([true, true]);
      applyCut(cut, moduleCut('interior', level), 0, level, false); // a floor button holding the cut from afar
      expect([drawn(decor), drawn(details)], level).toEqual([true, false]);
    }
    applyCut(cut, moduleCut('interior', 'basement'), 0, 'basement', true);
    expect([drawn(decor), drawn(details)]).toEqual([false, false]); // with the house, over the basement's cut
    applyCut(cut, moduleCut('interior', 'none'), 0, 'none', true);
    expect([drawn(decor), drawn(details)]).toEqual([true, true]);
    applyCut(cut, moduleCut('interior', 'none'), 0, 'none');
    expect([drawn(decor), drawn(details)]).toEqual([true, false]); // near unsaid: as from afar
  });

  it('still leaves out, near the house, a detail lying wholly over the cut', () => {
    const upstairs = piece(5.9, 6.4, true); // books on a bedroom's nightstand
    const root = new Group();
    root.add(upstairs);
    const cut = prepareCutaway(root, { unclipWhole: cutOnlyByButton('interior') });
    applyCut(cut, moduleCut('interior', 'ground'), 0, 'ground', true);
    expect(drawn(upstairs)).toBe(false);
    applyCut(cut, moduleCut('interior', 'upper'), 0, 'upper', true);
    expect(drawn(upstairs)).toBe(true);
  });

  it('never draws them where nothing cuts the house (the wallpaper)', () => {
    const decor = piece(0.47, 9.25, false);
    const details = piece(0.9, 6.4, true);
    const root = new Group();
    root.add(decor, details);
    leaveOutDetails(root);
    expect([drawn(decor), drawn(details)]).toEqual([true, false]);
    leaveOutDetails(root); // again: still out, nothing else touched
    expect([drawn(decor), drawn(details)]).toEqual([true, false]);
  });
});

describe('forcedCut and cutLevelFor: the floor buttons (AGENTS.md, Controls)', () => {
  it('holds the level picked whatever the distance, but never cuts while the camera is under the cut and its clearance', () => {
    expect(forcedCut('upper', HIGH, 'none')).toBe('upper');
    expect(forcedCut('upper', 6.86 + 2.01, 'none')).toBe('upper');
    expect(forcedCut('upper', 6.86 + 1.99, 'none')).toBe('none');
    // a cut that is on holds CUT_CAMERA_HYSTERESIS lower, so grazing the limit does not flicker
    expect(forcedCut('upper', 6.86 + 1.3, 'upper')).toBe('upper');
    expect(forcedCut('upper', 6.86 + 1.2, 'upper')).toBe('none');
    expect(forcedCut('ground', 2.05 + 2.01, 'none')).toBe('ground');
    expect(forcedCut('ground', 2.05 + 1.99, 'none')).toBe('none');
    // the basement's cut lies under the lawn: a camera over the island always clears it
    expect(forcedCut('basement', 0.5, 'none')).toBe('basement');
    expect(forcedCut('basement', -1.0, 'none')).toBe('none');
    expect(forcedCut('none', HIGH, 'ground')).toBe('none');
  });

  it('is cutLevel on auto and forcedCut for a level', () => {
    expect(cutLevelFor('auto', 80, HIGH, 'none')).toBe('none');
    expect(cutLevelFor('auto', 15, HIGH, 'none')).toBe('ground');
    expect(cutLevelFor('basement', 80, HIGH, 'none')).toBe('basement');
    expect(cutLevelFor('upper', 15, HIGH, 'ground')).toBe('upper');
    expect(cutLevelFor('none', 15, HIGH, 'ground')).toBe('none');
  });
});

describe('prepareCutaway and an uncut mesh sharing a material with cut ones', () => {
  it("gives the uncut mesh its own copy of the material, so it clips at the void's plane and the rest at the cut", () => {
    const white = new MeshStandardMaterial({ name: 'M_white' });
    const walls = mesh(white);
    walls.userData = { name: 'Basement_walls', uncut: true, cut_top: -0.35 };
    const partitions = mesh(white);
    const root = new Group();
    root.add(partitions, walls);
    const cut = prepareCutaway(root);
    expect(partitions.material).toBe(white);
    expect(white.clippingPlanes).toEqual([cut.plane]);
    const own = walls.material as MeshStandardMaterial;
    expect(own).not.toBe(white);
    expect(own.name).toBe('M_white');
    expect(own.clippingPlanes).toEqual([cut.voidPlane]);
  });

  it("keeps the wind of a swaying uncut mesh (the light well's palm) on its copy", () => {
    const leaf = new MeshStandardMaterial({ name: 'M_leaf' });
    applyWind(leaf);
    const palm = mesh(leaf);
    palm.geometry.setAttribute(
      'windWeight',
      new BufferAttribute(new Float32Array(palm.geometry.attributes.position.count), 1),
    );
    palm.userData = { name: 'Light_well_plants', uncut: true, cut_top: 1.45 };
    const root = new Group();
    root.add(mesh(leaf), palm);
    prepareCutaway(root);
    const own = palm.material as MeshStandardMaterial;
    expect(own).not.toBe(leaf);
    expect(own.userData.windPatched).toBe(true);
    expect(own.customProgramCacheKey()).toBe('wind');
  });
});

describe('applyCut and what the cut takes away whole', () => {
  function at(y0: number, y1: number, material: Material = new MeshStandardMaterial()) {
    const box = new Mesh(new BoxGeometry(1, y1 - y0, 1), material);
    box.position.set(0, (y0 + y1) / 2, 0);
    return box;
  }

  it('leaves a mesh wholly over the plane out of the drawing (a layer the camera does not draw) and brings it back', () => {
    const roof = at(9.7, 10.2);
    const walls = at(0.5, 4.9);
    const house = new Group();
    house.add(roof, walls);
    house.updateMatrixWorld(true);
    const cut = prepareCutaway(house);
    applyCut(cut, 'ground', 0);
    expect(roof.layers.isEnabled(0)).toBe(false);
    expect(roof.layers.isEnabled(HIDDEN_LAYER)).toBe(true);
    expect(walls.layers.isEnabled(0)).toBe(true);
    applyCut(cut, 'basement', 0); // the whole house lies over the basement's cut
    expect(walls.layers.isEnabled(0)).toBe(false);
    applyCut(cut, 'none', 0);
    expect([roof.layers.isEnabled(0), walls.layers.isEnabled(0)]).toEqual([true, true]);
  });

  it("measures an uncut mesh against the void's plane and keeps the lights where they are", () => {
    const chandelier = at(3.5, 5.6);
    chandelier.userData = { name: 'Chandelier', uncut: true, cut_top: 5.72 };
    const light = new PointLight();
    light.position.set(0, 4, 0);
    const house = new Group();
    house.add(chandelier, light);
    house.updateMatrixWorld(true);
    const cut = prepareCutaway(house);
    applyCut(cut, 'ground', 0);
    expect(chandelier.layers.isEnabled(0)).toBe(true); // under the void's plane, over the ground floor's cut
    applyCut(cut, 'basement', 0);
    expect(chandelier.layers.isEnabled(0)).toBe(false);
    expect(light.layers.isEnabled(0)).toBe(true); // a light count change would recompile every shader
  });

  it("draws what the basement tags buried only under the basement's cut", () => {
    const cellar = at(-3.6, -1.4);
    cellar.userData = { name: 'Basement_rooms', buried: true };
    const spa = at(-3.6, -1.4);
    const basement = new Group();
    basement.add(cellar, spa);
    basement.updateMatrixWorld(true);
    const cut = prepareCutaway(basement);
    applyCut(cut, 'none', 0);
    expect([cellar.layers.isEnabled(0), spa.layers.isEnabled(0)]).toEqual([false, true]);
    applyCut(cut, 'basement', 0);
    expect([cellar.layers.isEnabled(0), spa.layers.isEnabled(0)]).toEqual([true, true]);
    applyCut(cut, 'none', 0);
    expect(cellar.layers.isEnabled(0)).toBe(false);
  });

  it("lets what lies under the lawn cast its shadow only under the basement's cut, where the sun reaches into the pit", () => {
    // under the plinth the shadow pass would draw the spa and the basement's walls every frame for nothing
    const spa = at(-3.6, -2.9);
    const palm = at(-3.6, 1.9); // the light well's, whose crown shows over the lawn
    palm.userData = { name: 'Light_well_plants', uncut: true, cut_top: 1.95 };
    const floor = at(-3.62, -3.6);
    for (const mesh of [spa, palm]) mesh.castShadow = true;
    floor.castShadow = false; // exported cast_shadow = False
    const basement = new Group();
    basement.add(spa, palm, floor);
    basement.updateMatrixWorld(true);
    const cut = prepareCutaway(basement);
    applyCut(cut, 'none', 0);
    expect([spa.castShadow, palm.castShadow, floor.castShadow]).toEqual([false, true, false]);
    applyCut(cut, 'basement', 0);
    expect([spa.castShadow, palm.castShadow, floor.castShadow]).toEqual([true, true, false]);
    applyCut(cut, 'none', 0);
    expect(spa.castShadow).toBe(false);
  });

  it('buries them on the wallpaper too, where nothing is cut', () => {
    const cellar = at(-3.6, -1.4);
    const node = new Group();
    node.userData = { name: 'Basement_rooms', buried: true };
    node.add(cellar);
    const spa = at(-3.6, -1.4);
    const basement = new Group();
    basement.add(node, spa);
    spa.castShadow = true;
    bury(basement);
    expect([cellar.layers.isEnabled(0), spa.layers.isEnabled(0)]).toEqual([false, true]);
    expect(spa.castShadow).toBe(false); // under the lawn: no shadow worth a pass where nothing is ever cut
    // a module that buries nothing (the yard's lawn, the koi pond's floor) keeps its shadows
    const lawn = at(-0.01, 0);
    lawn.castShadow = true;
    const yard = new Group();
    yard.add(lawn);
    bury(yard);
    expect([lawn.castShadow, lawn.layers.isEnabled(0)]).toEqual([true, true]);
  });
});

describe('a module cut only by a floor button (the basement)', () => {
  it('goes without its clipping planes while whole, so its shaders have no discard, and takes them back under its cut', () => {
    const white = new MeshStandardMaterial({ name: 'M_white' });
    const walls = mesh(white);
    walls.position.y = -0.9; // up to the ground slab's underside, -0.4 m
    walls.userData = { name: 'Basement_walls', uncut: true, cut_top: -0.35 };
    const partitions = mesh(white);
    const basement = new Group();
    basement.add(partitions, walls);
    const cut = prepareCutaway(basement, { unclipWhole: true });
    const own = walls.material as MeshStandardMaterial;
    applyCut(cut, 'none', 0);
    expect(white.clippingPlanes ?? []).toEqual([]);
    expect(own.clippingPlanes ?? []).toEqual([]);
    const version = white.version;
    applyCut(cut, 'basement', 0);
    expect(white.clippingPlanes).toEqual([cut.plane]);
    expect(white.version).toBeGreaterThan(version); // the shader takes its plane back
    // the walls stand whole under the void's plane, which never comes down to them: their shader never needs it
    expect(own.clippingPlanes ?? []).toEqual([]);
    applyCut(cut, 'none', 0);
    expect(white.clippingPlanes ?? []).toEqual([]);
  });

  it("leaves without planes for good what it tags uncut and the void's plane never reaches, but not what it can reach", () => {
    const stone = new MeshStandardMaterial({ name: 'M_stone' });
    const well = mesh(stone); // the light well's walls up to their coping, 5 cm over the lawn
    well.position.y = -1.75;
    well.scale.y = 3.6;
    well.userData = { name: 'Light_well', uncut: true, cut_top: 0.1 };
    const palm = mesh(new MeshStandardMaterial({ name: 'M_leaf' })); // its palm's crown, up to 1.9 m
    palm.position.y = -0.85;
    palm.scale.y = 5.5;
    palm.userData = { name: 'Light_well_plants', uncut: true, cut_top: 1.95 };
    const mast = mesh(new MeshStandardMaterial({ name: 'M_metal' })); // uncut but with no top of its own, up to 3 m
    mast.position.y = 1;
    mast.scale.y = 4;
    mast.userData = { name: 'Mast', uncut: true };
    const floor = mesh(stone);
    floor.position.y = -3.61;
    floor.scale.y = 0.02;
    const basement = new Group();
    basement.add(well, palm, mast, floor);
    const cut = prepareCutaway(basement, { unclipWhole: true });
    for (const level of ['none', 'basement', 'none'] as const) {
      applyCut(cut, level, 0);
      expect((well.material as Material).clippingPlanes ?? [], level).toEqual([]);
      expect((palm.material as Material).clippingPlanes ?? [], level).toEqual([]);
    }
    applyCut(cut, 'basement', 0);
    expect((mast.material as Material).clippingPlanes).toEqual([cut.voidPlane]); // over the void's plane at 1.95 m
    expect(stone.clippingPlanes).toEqual([cut.plane]); // the floor is cut like the rest
  });

  it('while the house keeps its planes far above it when whole, so a cut by distance never changes its shaders', () => {
    const white = new MeshStandardMaterial({ name: 'M_white' });
    const house = new Group();
    house.add(mesh(white));
    const cut = prepareCutaway(house);
    applyCut(cut, 'none', 0);
    expect(white.clippingPlanes).toEqual([cut.plane]);
  });
});

/** A number assigned at the start of a line of basement/basement_layout.py, e.g. `COPING = 0.05`. */
function layoutConstant(name: string): number {
  const match = new RegExp(`^${name} = (-?[0-9.]+)`, 'm').exec(basementPy);
  if (!match) throw new Error(`${name} not found in basement/basement_layout.py`);
  return Number(match[1]);
}

describe("what the basement costs while its cut is off (the site route's frame)", () => {
  /** A unit box from y0 to y1 in module space, as prepareCutaway measures it. */
  function box(
    y0: number,
    y1: number,
    material: Material = new MeshStandardMaterial(),
    extras: Record<string, unknown> = {},
  ) {
    const part = new Mesh(new BoxGeometry(1, y1 - y0, 1), material);
    part.position.set(0, (y0 + y1) / 2, 0);
    part.userData = { ...extras };
    return part;
  }
  function group(...parts: (Mesh | PointLight)[]) {
    const root = new Group();
    root.add(...parts);
    root.updateMatrixWorld(true);
    return root;
  }

  it('draws its opaque meshes after the rest while its cut is off, so the lawn and the plinth over them hide them before they are shaded', () => {
    expect(UNDER_LAWN_ORDER).toBe(1);
    const floor = box(-3.62, -3.6, new MeshStandardMaterial({ name: 'M_stone' }), {
      name: 'Basement_floor',
    });
    const spa = box(-3.6, -1.4, new MeshStandardMaterial({ name: 'M_rattan' }), { name: 'Spa' });
    const glass = box(
      -3.6,
      -0.4,
      new MeshStandardMaterial({ name: 'GLASS_clear', transparent: true }),
      { name: 'Glass_spa' },
    );
    glass.renderOrder = 1; // GLASS_RENDER_ORDER (prepareModule): in the transparent pass, which sorts on its own
    const rooms = box(-3.6, -0.4, new MeshStandardMaterial(), {
      name: 'Basement_rooms',
      buried: true,
    });
    const cut = prepareCutaway(group(floor, spa, glass, rooms), { unclipWhole: true });
    applyCut(cut, 'none', 0);
    expect([floor.renderOrder, spa.renderOrder, glass.renderOrder]).toEqual([
      UNDER_LAWN_ORDER,
      UNDER_LAWN_ORDER,
      1,
    ]);
    applyCut(cut, 'basement', 0); // the pit open to the sky: drawn in their turn
    expect([floor.renderOrder, spa.renderOrder, glass.renderOrder, rooms.renderOrder]).toEqual([
      0, 0, 1, 0,
    ]);
    applyCut(cut, 'none', 0);
    expect(floor.renderOrder).toBe(UNDER_LAWN_ORDER);
    // on the wallpaper too, where nothing is cut
    const wallFloor = box(-3.62, -3.6);
    bury(
      group(
        wallFloor,
        box(-3.6, -0.4, new MeshStandardMaterial(), { name: 'Basement_rooms', buried: true }),
      ),
    );
    expect(wallFloor.renderOrder).toBe(UNDER_LAWN_ORDER);
    // the house buries nothing: its order stays the default under every cut
    const walls = box(0.45, 4.87);
    const house = prepareCutaway(group(walls));
    for (const level of ['none', 'upper', 'ground', 'basement'] as const) {
      applyCut(house, level, 0);
      expect(walls.renderOrder, level).toBe(0);
    }
  });

  it("lets its stair, which rises through the living room's hole, cast a shadow only once the house is cut to the ground floor or lower", () => {
    // up to the ground floor's balustrade, over the lawn: the UNDERGROUND rule never takes its shadow away
    const stair = box(-3.6, 1.42, new MeshStandardMaterial(), { name: 'Stair_basement' });
    const palm = box(-3.6, 1.9, new MeshStandardMaterial(), {
      name: 'Light_well_plants',
      uncut: true,
      cut_top: 1.95,
    });
    const rooms = box(-3.6, -0.4, new MeshStandardMaterial(), {
      name: 'Basement_rooms',
      buried: true,
    });
    for (const part of [stair, palm, rooms]) part.castShadow = true;
    const cut = prepareCutaway(group(stair, palm, rooms), { unclipWhole: true });
    for (const [shown, casts] of [
      ['none', false],
      ['upper', false],
      ['ground', true],
      ['basement', true],
      ['none', false],
    ] as const) {
      applyCut(cut, moduleCut('basement', shown), 0, shown);
      expect(stair.castShadow, shown).toBe(casts);
      expect(palm.castShadow, shown).toBe(true); // the light well's palm stands in the open
    }
    const wallStair = box(-3.6, 1.42);
    wallStair.castShadow = true;
    bury(
      group(
        wallStair,
        box(-3.6, -0.4, new MeshStandardMaterial(), { name: 'Basement_rooms', buried: true }),
      ),
    );
    expect(wallStair.castShadow).toBe(false); // the wallpaper never cuts the house open over it
  });

  it('lets the light well keep its shadow: its coping rises over the lawn, and its walls shade its floor as a sunken court', () => {
    const coping = layoutConstant('COPING');
    expect(UNDERGROUND).toBeLessThan(coping);
    const well = box(-3.62, coping, new MeshStandardMaterial(), {
      name: 'Light_well',
      uncut: true,
      cut_top: 0.1,
    });
    const walls = box(-3.62, -0.4, new MeshStandardMaterial(), {
      name: 'Basement_walls',
      uncut: true,
      cut_top: -0.35,
    });
    const rooms = box(-3.6, -0.4, new MeshStandardMaterial(), {
      name: 'Basement_rooms',
      buried: true,
    });
    for (const part of [well, walls]) part.castShadow = true;
    const cut = prepareCutaway(group(well, walls, rooms), { unclipWhole: true });
    applyCut(cut, 'none', 0, 'none');
    expect([well.castShadow, walls.castShadow]).toEqual([true, false]);
    const wallWell = box(-3.62, coping, new MeshStandardMaterial(), {
      name: 'Light_well',
      uncut: true,
      cut_top: 0.1,
    });
    wallWell.castShadow = true;
    bury(
      group(
        wallWell,
        box(-3.6, -0.4, new MeshStandardMaterial(), { name: 'Basement_rooms', buried: true }),
      ),
    );
    expect(wallWell.castShadow).toBe(true);
  });

  it("turns the house's lights off under the basement's cut, which takes the house away, without a light count change", () => {
    const lamp = new PointLight(0xffaa66, 40);
    lamp.position.set(0, 4.2, 0);
    lamp.userData.lit = 25; // what the toggles give it now (interact/effects applyToggles)
    lamp.intensity = 25;
    const cut = prepareCutaway(group(box(0.45, 4.87), lamp));
    applyCut(cut, 'ground', 0);
    expect(lamp.intensity).toBe(25);
    applyCut(cut, 'basement', 0);
    expect([lamp.intensity, lamp.visible, lamp.userData.cutDark]).toEqual([0, true, true]); // no shader recompiles
    lamp.userData.lit = 30; // the night deepened meanwhile
    applyCut(cut, 'none', 0);
    expect([lamp.intensity, lamp.userData.cutDark]).toEqual([30, false]);
    // the basement's own lights, under the lawn, light its rooms under its cut
    const cellar = new PointLight(0xffaa66, 10);
    cellar.position.set(0, -1, 0);
    const basement = prepareCutaway(group(box(-3.6, -0.4), cellar), { unclipWhole: true });
    applyCut(basement, 'basement', 0);
    expect(cellar.intensity).toBe(10);
  });

  it('compiles its cut look ahead (warmCut): the planes and sides its cut gives, then puts its whole look back as it was', () => {
    const white = new MeshStandardMaterial({ name: 'M_white' });
    const velvet = new MeshStandardMaterial({ name: 'M_velvet' });
    const partitions = box(-3.6, -0.4, white, { name: 'Basement_partitions' });
    const rooms = box(-3.6, -0.4, velvet, { name: 'Basement_rooms', buried: true });
    const cut = prepareCutaway(group(partitions, rooms), { unclipWhole: true });
    applyCut(cut, 'none', 0);
    const seen: unknown[] = [];
    warmCut(cut, 'basement', () => {
      seen.push(
        white.clippingPlanes,
        white.side,
        velvet.clippingPlanes,
        velvet.side,
        rooms.layers.isEnabled(0),
      );
    });
    expect(seen).toEqual([[cut.plane], DoubleSide, [cut.plane], DoubleSide, false]); // compiled whatever it draws
    expect([
      white.clippingPlanes ?? [],
      white.side,
      velvet.clippingPlanes ?? [],
      velvet.side,
    ]).toEqual([[], FrontSide, [], FrontSide]);
    expect(rooms.layers.isEnabled(0)).toBe(false);
    applyCut(cut, 'basement', 0); // and the cut still applies as before
    expect([white.clippingPlanes, white.side]).toEqual([[cut.plane], DoubleSide]);
  });

  it('lets a compile that fails go (warmCut): its whole look put back, the failure logged once, nothing thrown', async () => {
    const white = new MeshStandardMaterial({ name: 'M_white' });
    const cut = prepareCutaway(group(box(-3.6, -0.4, white, { name: 'Basement_partitions' })), {
      unclipWhole: true,
    });
    applyCut(cut, 'none', 0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // a lost context throws at once; KHR_parallel_shader_compile's wait can reject later
      expect(() =>
        warmCut(cut, 'basement', () => {
          throw new Error('context lost');
        }),
      ).not.toThrow();
      expect([white.clippingPlanes ?? [], white.side]).toEqual([[], FrontSide]);
      warmCut(cut, 'basement', () => Promise.reject(new Error('context lost')));
      warmCut(cut, 'none', () => {
        throw new Error('context lost');
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect([white.clippingPlanes ?? [], white.side]).toEqual([[], FrontSide]);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('what the basement shows through its openings while its cut is off (showThroughOpenings)', () => {
  /** From the site's first view, low in front: the spa's top behind the light well's glass, not the tub under the line of sight. */
  const LOW = new Vector3(-2.9, 0.05 + 60 * Math.tan((13.8 * Math.PI) / 180), 8.2 + 60);
  /** Whether the renderer draws `mesh`: visible (the effects' to set) and on the camera's layer (0). */
  const drawn = (mesh: Mesh) => mesh.visible && mesh.layers.isEnabled(0);
  /** Whether `mesh` is on the camera's layer: what the cut and showThroughOpenings set. */
  const onLayer = (mesh: Mesh) => mesh.layers.isEnabled(0);
  /** A box over glTF x0..x1, y0..y1, z0..z1 (Blender x, z, -y), with the extras of its glTF node. */
  function box(
    min: [number, number, number],
    max: [number, number, number],
    extras: Record<string, unknown> = {},
  ) {
    const part = new Mesh(
      new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
      new MeshStandardMaterial(),
    );
    part.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    part.userData = { ...extras };
    return part;
  }
  function basement() {
    // the light well's top in Blender module space (x0, y0, x1, y1, z): glTF x -5.3..-0.5, z 5.5..10.9, at 5 cm
    const well = box([-5.5, -3.62, 5.5], [-0.3, 0.05, 11.1], {
      name: 'Light_well',
      uncut: true,
      cut_top: 0.1,
      opening: [-5.3, -10.9, -0.5, -5.5, 0.05],
    });
    // the stair hole over the hall, at the ground floor's 0.45 m
    const stair = box([-11.25, -3.6, -2.7], [-8.85, 1.42, -0.3], {
      name: 'Stair_basement',
      opening: [-11.25, 0.3, -8.85, 2.7, 0.45],
    });
    const spa = box([-7.6, -3.6, 0], [2, -1.4, 5.5], { name: 'Spa' }); // under the plinth behind the well's glass
    const tub = box([-4, -3.6, 4], [-2, -2.9, 5.4], { name: 'Hot_tub' }); // low, just behind the glass
    const hall = box([-11.3, -3.62, -3], [2, -3.6, 0], { name: 'Basement_floor' }); // under the stair hole
    const rooms = box([-11.3, -3.6, -7.3], [11.3, -0.4, 5.3], {
      name: 'Basement_rooms',
      buried: true,
    });
    const root = new Group();
    root.add(well, stair, spa, tub, hall, rooms);
    root.updateMatrixWorld(true);
    return { root, well, stair, spa, tub, hall, rooms };
  }

  it("draws what lies under the lawn only where the light well's top or the stair hole lets the camera see it", () => {
    const { root, well, stair, spa, tub, hall, rooms } = basement();
    const seen = findOpenings(root)!;
    expect(seen.holes).toHaveLength(2);
    expect(seen.meshes.map(({ mesh }) => mesh)).toEqual([spa, tub, hall]); // not the openings', nor what is buried
    showThroughOpenings(seen, LOW, false);
    expect([drawn(spa), drawn(tub)]).toEqual([true, false]);
    expect([drawn(well), drawn(stair), drawn(rooms)]).toEqual([true, true, true]); // left to the cut
    // from high over the house: down the stair hole onto the hall, while the well's sides hide what is under the plinth
    showThroughOpenings(seen, new Vector3(-2.9, 40, 2), false);
    expect([drawn(spa), drawn(tub), drawn(hall)]).toEqual([false, false, true]);
    // looking down into the well from over its front: the tub just behind the glass
    showThroughOpenings(seen, new Vector3(-2.9, 20, 16), false);
    expect(drawn(tub)).toBe(true);
    // the basement's cut opens the whole pit
    showThroughOpenings(seen, LOW, true);
    expect([drawn(spa), drawn(tub), drawn(hall)]).toEqual([true, true, true]);
    // a module with no openings (the house) has nothing to show through them
    expect(findOpenings(group(box([0, 0.45, 0], [1, 4.87, 1])))).toBeNull();
  });

  it("places the openings with the module's slot", () => {
    const { root, spa } = basement();
    const slot = new Group();
    slot.position.set(-1.5, 0, -9.5);
    slot.add(root);
    slot.updateMatrixWorld(true);
    const seen = findOpenings(root)!;
    showThroughOpenings(seen, new Vector3(-2.9 - 1.5, 40, 2 - 9.5), false); // high over the house, moved with it
    expect(drawn(spa)).toBe(false);
    showThroughOpenings(seen, new Vector3(-2.9, 40, 2), false); // over the well's front now: down past its glass
    expect(drawn(spa)).toBe(true);
  });

  it('finds the module where its slot is now, though nothing has drawn it since it moved (the first frame)', () => {
    const { root, spa } = basement();
    const slot = new Group();
    slot.add(root);
    slot.updateMatrixWorld(true);
    const seen = findOpenings(root)!;
    slot.position.set(-1.5, 0, -9.5); // three brings matrixWorld up to date when it draws, after the frame's callbacks
    showThroughOpenings(seen, new Vector3(-2.9, 40, 2), false); // over the well's front: down past its glass
    expect(drawn(spa)).toBe(true);
  });

  it('leaves `visible` to the effects: falling water a shower that is off hides stays hidden, wherever the camera is', () => {
    const { root, spa } = basement();
    // a shower's falling water under the plinth behind the well's glass, off (interact/effects applyToggles)
    const flow = box([-4, -3.6, 1], [-3.6, -1.6, 1.4], { name: 'WATER_shower_flow' });
    flow.visible = false;
    root.add(flow);
    root.updateMatrixWorld(true);
    const seen = findOpenings(root)!;
    expect(seen.meshes.map(({ mesh }) => mesh)).toContain(flow);
    showThroughOpenings(seen, LOW, false); // in sight past the glass, like the spa
    expect([drawn(spa), onLayer(flow), flow.visible]).toEqual([true, true, false]);
    showThroughOpenings(seen, LOW, true); // the basement's cut
    expect([onLayer(flow), flow.visible]).toEqual([true, false]);
    showThroughOpenings(seen, new Vector3(-2.9, 40, 2), false); // out of sight, high over the house
    expect([onLayer(flow), flow.visible]).toEqual([false, false]);
    flow.visible = true; // the shower turned on meanwhile
    showThroughOpenings(seen, new Vector3(-2.9, 40, 2), false);
    expect([onLayer(flow), flow.visible]).toEqual([false, true]);
    showThroughOpenings(seen, LOW, false);
    expect([onLayer(flow), flow.visible]).toEqual([true, true]);
  });

  it('keeps what the cut leaves out of the drawing out of it, whatever the openings show, and the other way round', () => {
    const { root } = basement();
    // under the lawn, over the basement's cut: its cut leaves it out (applyCut), the openings may show it while whole
    const ceiling = box([-7.6, -0.4, 0], [2, -0.15, 5.3], { name: 'Ceiling' });
    root.add(ceiling);
    root.updateMatrixWorld(true);
    const cut = prepareCutaway(root, { unclipWhole: true });
    const seen = findOpenings(root)!;
    applyCut(cut, 'basement', 0);
    showThroughOpenings(seen, LOW, true);
    expect([onLayer(ceiling), ceiling.layers.isEnabled(HIDDEN_LAYER)]).toEqual([false, true]);
    showThroughOpenings(seen, new Vector3(-2.9, 40, 2), false); // out of sight too
    applyCut(cut, 'none', 0); // whole again: still out of sight
    expect(drawn(ceiling)).toBe(false);
    showThroughOpenings(seen, LOW, false);
    expect(drawn(ceiling)).toBe(true);
  });

  function group(...parts: Mesh[]) {
    const root = new Group();
    root.add(...parts);
    root.updateMatrixWorld(true);
    return root;
  }
});
