import {
  Box3,
  DoubleSide,
  type Material,
  Matrix4,
  type Mesh,
  type Object3D,
  Plane,
  type PointLight,
  type ShaderMaterial,
  type Side,
  type SpotLight,
  Vector3,
} from 'three';
import { applyWind } from '../systems/wind';
import { cutTop, isBuried, isDetail, isPunctualLight, isUncut, openingOf } from './extras';

/**
 * How much of the house shows on the site route (interaction spec §2): all of it, up to the upper floor, the ground
 * floor, or nothing of it over the basement (villa v2 spec §12 "Basement"), which only the floor buttons show.
 */
export type CutLevel = 'none' | 'upper' | 'ground' | 'basement';
/** What the floor buttons pick (ui/FloorSelector): the cut by the camera's distance ('auto'), or a level held. */
export type CutMode = 'auto' | CutLevel;

/**
 * Floor heights of the villa v2 house in module space (metres; Blender Z is glTF Y): PLINTH, UPPER_FLOOR and
 * BASEMENT_FLOOR of houses/house_parts/common.py, which cutaway.test.ts reads to check them.
 */
export const HOUSE_LEVELS = { plinth: 0.45, upperFloor: 5.26, basementFloor: -3.62 } as const;
/** The cut runs this far above the floor of the storey on show: the walls stop at chest height. */
export const CUT_ABOVE_FLOOR = 1.6;
/** Camera-to-house distances (m, to the house focus) below which each cut starts, and the hysteresis either side of them. */
export const CUT_DISTANCES = { upper: 45, ground: 28, hysteresis: 3 } as const;
/** A cut only starts while the camera is more than this above it: looking up from under the island the house is whole. */
export const CUT_CAMERA_CLEAR = 2;
/** A cut that is on holds until the camera is this much lower than it took to start it, so grazing the limit does not flicker. */
export const CUT_CAMERA_HYSTERESIS = 0.75;
/** Where the plane goes while the house is whole: far above it, so nothing clips and no shader has to change. */
const NO_CUT = 1e6;
/**
 * The layer a mesh goes to while the website does not draw it (the camera and the raycasters see layer 0 only): one the
 * cut takes away whole, one the basement tags buried while the basement is not on show. Lights stay where they are,
 * since a light count change would recompile every shader.
 */
export const HIDDEN_LAYER = 1;
/**
 * The layer a mesh under the basement's openings goes to while none of them shows it (showThroughOpenings): off the
 * camera's like HIDDEN_LAYER, on a bit of its own, so the cut's leaving it out and this never undo each other, and
 * `visible` stays the effects' (a shower's falling water, interact/effects applyToggles). A mesh is drawn on layer 0
 * only while neither is set.
 */
export const UNSEEN_LAYER = 2;
/**
 * A mesh whose top lies under this in module space (metres, 2 cm over the lawn) lies under the lawn: the basement's
 * under the plinth. Its shadow shows only once the cut lets the sun into the pit, so it casts one only under the
 * basement's cut: otherwise the site route's shadow pass would draw it every frame for nothing. The light well's walls
 * rise to their coping, 5 cm over the lawn, and keep their shadow: it falls into the sunken court and gives it depth.
 */
export const UNDERGROUND = 0.02;
/**
 * The render order of the opaque meshes a module that buries anything (the basement) draws while its cut is off: after
 * everything else (three sorts the opaque pass by it first), so the lawn and the plinth over them are in the depth
 * buffer already and the depth test throws their fragments away before they are shaded. Under the basement's cut, open
 * to the sky, they draw in their turn (0).
 */
export const UNDER_LAWN_ORDER = 1;

const DEPTH: Record<CutLevel, number> = { none: 0, upper: 1, ground: 2, basement: 3 };

/**
 * The modules the site route cuts away like a dollhouse, with the levels each of them is cut at: the house at every
 * level, and the interior with it (villa v2 spec §12 "Curtains and accessories": the house's curtains and accessories, a module
 * of its own in the house's place), the basement only at its own (under the ground slab the storeys' cuts leave it
 * whole).
 */
export const CUTAWAY_MODULES: Readonly<Record<string, readonly CutLevel[]>> = {
  house: ['upper', 'ground', 'basement'],
  interior: ['upper', 'ground', 'basement'],
  basement: ['basement'],
};

/** The level `module` is cut at while `level` shows: its own levels, 'none' at the others. */
export function moduleCut(module: string, level: CutLevel): CutLevel {
  return CUTAWAY_MODULES[module]?.includes(level) ? level : 'none';
}

/**
 * Whether only a floor button cuts `module` (the basement: none of its levels is one the camera's distance calls for):
 * prepareCutaway's `unclipWhole`, its shaders going without the plane while it is whole. The house and the interior,
 * which a zoom cuts, keep theirs, far above them, so a cut by distance never recompiles a shader.
 */
export function cutOnlyByButton(module: string): boolean {
  const levels = CUTAWAY_MODULES[module];
  return levels !== undefined && !levels.includes('upper') && !levels.includes('ground');
}

/** Height of the cut in module space (metres above the house's ground), null for the whole house. */
export function cutHeight(level: CutLevel): number | null {
  if (level === 'upper') return HOUSE_LEVELS.upperFloor + CUT_ABOVE_FLOOR;
  if (level === 'ground') return HOUSE_LEVELS.plinth + CUT_ABOVE_FLOOR;
  if (level === 'basement') return HOUSE_LEVELS.basementFloor + CUT_ABOVE_FLOOR;
  return null;
}

/**
 * The cut for a camera `distance` metres from the house focus (orbit.ts cutFor) and `cameraY` metres above the house's
 * ground, given the level shown so far: the whole house beyond 45 m, the upper floor from 28 m, the ground floor closer. Each threshold
 * holds the previous level within CUT_DISTANCES.hysteresis of it, so a zoom that stops near it cannot flicker; and no
 * cut applies unless the camera is more than CUT_CAMERA_CLEAR above it, a margin a cut already on (at that level, or a
 * higher one it moves down from) gives up CUT_CAMERA_HYSTERESIS of, so a camera grazing the limit does not pop the roof
 * back and recompile every shader. A camera in the upper floor's band but too low for its cut sees the ground floor's
 * instead: zooming straight in from the site's low first view (13.8 degrees down onto the tall house) the camera drops
 * under the upper cut's 8.86 m from 34 m in, and the roof must not come back before the ground floor's band.
 */
export function cutLevel(distance: number, cameraY: number, previous: CutLevel): CutLevel {
  const { upper, ground, hysteresis } = CUT_DISTANCES;
  const depth = DEPTH[previous];
  const pastGround =
    depth >= DEPTH.ground ? distance <= ground + hysteresis : distance < ground - hysteresis;
  const pastUpper =
    depth >= DEPTH.upper ? distance <= upper + hysteresis : distance < upper - hysteresis;
  const level: CutLevel = pastGround ? 'ground' : pastUpper ? 'upper' : 'none';
  const above = (cut: Exclude<CutLevel, 'none'>) => {
    const held = previous !== 'none' && DEPTH[previous] <= DEPTH[cut];
    return (
      cameraY >
      cutHeight(cut)! + (held ? CUT_CAMERA_CLEAR - CUT_CAMERA_HYSTERESIS : CUT_CAMERA_CLEAR)
    );
  };
  if (level === 'upper' && above('upper')) return 'upper';
  return level !== 'none' && above('ground') ? 'ground' : 'none';
}

/**
 * The level a floor button holds (interaction spec §2), whatever the camera's distance: `level`, but the whole house
 * while the camera is not more than CUT_CAMERA_CLEAR above its cut (CUT_CAMERA_HYSTERESIS less while that cut is on),
 * as cutLevel's camera-height rule. The basement's cut lies under the lawn, so a camera over the island always clears
 * it.
 */
export function forcedCut(level: CutLevel, cameraY: number, previous: CutLevel): CutLevel {
  const height = cutHeight(level);
  if (height === null) return 'none';
  const clear = previous === level ? CUT_CAMERA_CLEAR - CUT_CAMERA_HYSTERESIS : CUT_CAMERA_CLEAR;
  return cameraY > height + clear ? level : 'none';
}

/**
 * Whether a camera `distance` metres from the house focus (orbit.ts nearFor) is near the house, close enough to make out
 * the interior's small things (its details, applyCut), given whether it was so far: within CUT_DISTANCES.upper, starting
 * CUT_DISTANCES.hysteresis inside it and holding as far past it, like the upper cut, so a zoom that stops there cannot
 * flicker. Whatever the cut and the camera's height: on "Roof" at 20 m, or low by the house on auto, the house is whole and
 * its rooms are near.
 */
export function nearHouse(distance: number, wasNear: boolean): boolean {
  const { upper, hysteresis } = CUT_DISTANCES;
  return wasNear ? distance <= upper + hysteresis : distance < upper - hysteresis;
}

/** The cut for `mode`: by the camera's distance on auto (cutLevel), the level held otherwise (forcedCut). */
export function cutLevelFor(
  mode: CutMode,
  distance: number,
  cameraY: number,
  previous: CutLevel,
): CutLevel {
  return mode === 'auto'
    ? cutLevel(distance, cameraY, previous)
    : forcedCut(mode, cameraY, previous);
}

export interface HouseCutaway {
  /** One world-space plane every material of the house clips at: normal (0, -1, 0), so it keeps what lies below it. */
  plane: Plane;
  /**
   * The plane what the house tags uncut clips at (the chandelier in the double-height void) instead of `plane`: the
   * upper floor's cut while that shows, so its cord stops with the upper floor's walls; under the ground floor's cut its
   * own top (voidTop) when that is lower, so it hangs whole over the cut walls without a cord rising out of the house.
   */
  voidPlane: Plane;
  /** The highest cut_top of what the house tags uncut (module space, metres: the chandelier's crown), null if none. */
  voidTop: number | null;
  /** The opaque materials: drawn double-sided while cut, so a cut wall shows its inside. */
  opaque: Set<Material>;
  /**
   * Every mesh with the lowest point of it in module space (metres over the slot) and whether it clips at the void's
   * plane: applyCut leaves out of the drawing (HIDDEN_LAYER) what lies wholly over the plane it clips at. `shade` is the
   * shallowest level the site shows at which its shadow can show (sunlit): 'basement' for what lies under the lawn
   * (UNDERGROUND), 'ground' for what the basement has under the house that rises over the lawn (its stair, up through
   * the living room's hole, which the upper floor shades until it is cut away), 'none' for the rest. `late`: an opaque
   * mesh of a module that buries anything, drawn after the rest while that module's cut is off (UNDER_LAWN_ORDER).
   * `detail`: one the interior tags detail (its small things), drawn only while the camera is near the house.
   */
  meshes: {
    mesh: Mesh;
    bottom: number;
    top: number;
    casts: boolean;
    uncut: boolean;
    buried: boolean;
    detail: boolean;
    shade: CutLevel;
    late: boolean;
  }[];
  /**
   * Every material with the plane it clips at. With `unclipWhole` (prepareCutaway's option) applyCut takes the planes
   * off while the module is whole and puts them back under a cut; what the module tags uncut and the void's plane never
   * reaches goes without a plane for good (it is not in here).
   */
  clipped: Map<Material, Plane>;
  unclipWhole: boolean;
  /**
   * The module's point and spot lights, with whether each stands over the lawn (UNDERGROUND): the house's, which the
   * basement's cut takes away with their rooms, so applyCut turns them off there (userData.cutDark, intensity 0) without
   * hiding them, since a light count change would recompile every shader.
   */
  lights: { light: PointLight | SpotLight; over: boolean }[];
}

/** userData key of a material's own side, taken the first time the cutaway sees it: a remount finds it double-sided. */
const SIDE = 'cutawaySide';

function materialsOf(object: Object3D): Material[] {
  const mesh = object as Mesh;
  if (!mesh.isMesh) return [];
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * The material an uncut mesh clips with: its own copy of one a cut mesh of the module shares (a material can carry one
 * plane), made once per material; the copy keeps the wind (applyWind's hook is not copied).
 */
function ownCopy(material: Material, copies: Map<Material, Material>): Material {
  let copy = copies.get(material);
  if (!copy) {
    copy = material.clone();
    if (material.userData.windPatched) {
      delete copy.userData.windPatched;
      applyWind(copy);
    }
    copies.set(material, copy);
  }
  return copy;
}

const bounds = new Box3();

/** The world box round a mesh's geometry (its matrixWorld up to date). */
function worldBox(mesh: Mesh): Box3 {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  return bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
}

/** The opaque mesh `mesh` (no material of it blended): one the depth test can hide before it is shaded. */
function opaque(mesh: Mesh): boolean {
  return materialsOf(mesh).every((material) => !material.transparent);
}

/**
 * The shallowest level the site shows at which a mesh's shadow can show (HouseCutaway.meshes `shade`), its top `top`
 * metres over the slot: under the lawn only the basement's cut lets the sun in; what a module that buries anything (the
 * basement) has over the lawn but stands whole under its cut (the light well's palm) stands in the open, and the rest
 * of it under the house (its stair, up through the living room's hole) once the house is cut to the ground floor.
 */
function shadeOf(top: number, uncut: boolean, buries: boolean): CutLevel {
  if (top <= UNDERGROUND) return 'basement';
  return buries && !uncut ? 'ground' : 'none';
}

/**
 * Gives every material of a prepared house the shared clipping plane, with shadows clipped too (the cut floors let the
 * sun in), starting whole. Run it after prepareModule, which clones the night-light materials and swaps in the water
 * shader. Only the module's own materials are touched: modules load their GLBs separately. What the module tags uncut
 * (isUncut: the chandelier in the double-height void, the basement's retaining walls and light well) clips at the void's
 * plane instead, never lower than its own top (cutTop), so the cut does not cut it and it stays in reach of a click; a
 * material it shares with what is cut becomes its own copy (ownCopy), and it keeps its side (nothing of it is cut open
 * but the chandelier's cord). What the basement tags buried (isBuried) applyCut draws only under the basement's cut.
 * With `unclipWhole` (the basement, which only a floor button cuts) applyCut takes the planes off the materials while
 * the module is whole; the house keeps them, far above it, so a cut by distance never changes its shaders. There, what
 * stands whole under the cut, all under the lowest the void's plane comes down to, never gets a plane: its shaders stay
 * the ones it is drawn with on the way to the cut.
 */
export function prepareCutaway(
  root: Object3D,
  { unclipWhole = false }: { unclipWhole?: boolean } = {},
): HouseCutaway {
  const cutaway: HouseCutaway = {
    plane: new Plane(new Vector3(0, -1, 0), NO_CUT),
    voidPlane: new Plane(new Vector3(0, -1, 0), NO_CUT),
    voidTop: null,
    opaque: new Set(),
    meshes: [],
    clipped: new Map(),
    unclipWhole,
    lights: [],
  };
  const cut = new Set<Material>();
  let buries = false;
  root.traverse((object) => {
    if (!isUncut(object)) for (const material of materialsOf(object)) cut.add(material);
    if ((object as Mesh).isMesh && isBuried(object)) buries = true;
  });
  const copies = new Map<Material, Material>();
  root.updateWorldMatrix(true, true);
  const base = new Vector3().setFromMatrixPosition(root.matrixWorld).y;
  const reach = new Map<Material, number>(); // the highest top of the uncut meshes each material of theirs is on
  root.traverse((object) => {
    if (isPunctualLight(object)) {
      const y = new Vector3().setFromMatrixPosition(object.matrixWorld).y - base;
      cutaway.lights.push({ light: object, over: y > UNDERGROUND });
      return;
    }
    const uncut = isUncut(object);
    const top = uncut ? cutTop(object) : null;
    if (top !== null) cutaway.voidTop = Math.max(cutaway.voidTop ?? top, top);
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      if (uncut) {
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => (cut.has(m) ? ownCopy(m, copies) : m))
          : cut.has(mesh.material)
            ? ownCopy(mesh.material, copies)
            : mesh.material;
      }
      const { min, max } = worldBox(mesh);
      const [bottom, height] = [min.y - base, max.y - base];
      const buried = isBuried(object);
      cutaway.meshes.push({
        mesh,
        bottom,
        top: height,
        casts: mesh.castShadow,
        uncut,
        buried,
        detail: isDetail(object),
        shade: shadeOf(height, uncut, buries),
        late: buries && !buried && opaque(mesh),
      });
      if (uncut)
        for (const material of materialsOf(mesh))
          reach.set(material, Math.max(reach.get(material) ?? -Infinity, height));
    }
    for (const material of materialsOf(object)) {
      const plane = uncut ? cutaway.voidPlane : cutaway.plane;
      cutaway.clipped.set(material, plane);
      if (material.clippingPlanes?.includes(plane)) continue; // shared by several meshes
      material.clippingPlanes = [plane];
      material.clipShadows = true;
      if ((material as ShaderMaterial).isShaderMaterial)
        (material as ShaderMaterial).clipping = true;
      if (!material.transparent && !uncut) {
        // The materials are shared with the clone of a house that was cut when it unmounted: only the first look at
        // one tells its own side.
        material.userData[SIDE] ??= material.side;
        cutaway.opaque.add(material);
      }
      material.needsUpdate = true;
    }
  });
  if (unclipWhole) {
    // the void's plane comes down lowest under the basement's cut (voidCutHeight): what stays under it is never clipped
    const lowest = voidCutHeight(cutaway, 'basement')!;
    for (const [material, top] of reach) {
      if (top > lowest + 1e-6) continue;
      cutaway.clipped.delete(material);
      material.clippingPlanes = null;
      material.needsUpdate = true;
    }
  }
  return cutaway;
}

/**
 * Height of the void's plane in module space while `level` shows (null: the house is whole): the upper floor's cut,
 * under the ground floor's cut no higher than voidTop, and under the basement's the ground floor's cut, no higher than
 * voidTop either (the house's chandelier goes with the house, the basement's light well stands whole).
 */
export function voidCutHeight(
  cutaway: Pick<HouseCutaway, 'voidTop'>,
  level: CutLevel,
): number | null {
  if (level === 'none') return null;
  const over = level === 'basement' ? cutHeight('ground')! : cutHeight('upper')!;
  return level !== 'upper' && cutaway.voidTop !== null ? Math.min(over, cutaway.voidTop) : over;
}

/**
 * Leaves `mesh` out of the drawing for `why` (HIDDEN_LAYER: the cut; UNSEEN_LAYER: no opening shows it), or takes that
 * reason back: on the camera's layer (0) while neither holds.
 */
function hide(
  mesh: Object3D,
  hidden: boolean,
  why: typeof HIDDEN_LAYER | typeof UNSEEN_LAYER = HIDDEN_LAYER,
): void {
  const { layers } = mesh;
  if (hidden === layers.isEnabled(why)) return;
  if (hidden) layers.enable(why);
  else layers.disable(why);
  if (layers.isEnabled(HIDDEN_LAYER) || layers.isEnabled(UNSEEN_LAYER)) layers.disable(0);
  else layers.enable(0);
}

/**
 * Leaves what the module tags buried (the basement's rooms under the plinth) out of the drawing, what lies under the
 * lawn (UNDERGROUND) or under the house (its stair) out of the shadow pass, and draws the rest of its opaque meshes after
 * everything else (UNDER_LAWN_ORDER): on the wallpaper, which is never cut, they never show but through the light well
 * (applyCut does it on the site route).
 */
export function bury(root: Object3D): void {
  let basement = false; // only the basement buries anything; the yard's lawn and the pond keep their shadows
  root.traverse((object) => {
    if ((object as Mesh).isMesh && isBuried(object)) basement = true;
  });
  if (!basement) return;
  root.updateWorldMatrix(true, true);
  const base = new Vector3().setFromMatrixPosition(root.matrixWorld).y;
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    if (isBuried(object)) hide(object, true);
    else if (opaque(mesh)) mesh.renderOrder = UNDER_LAWN_ORDER;
    // under the lawn or the house, never cut away here
    if (shadeOf(worldBox(mesh).max.y - base, isUncut(object), true) !== 'none')
      mesh.castShadow = false;
  });
}

/**
 * Leaves what the interior tags detail (its small things: cushions, books, the table laid) out of the drawing of a
 * module nothing cuts (the wallpaper, whose camera is never near the house): from that far they are a pixel or two, and
 * most of its triangles.
 */
export function leaveOutDetails(root: Object3D): void {
  root.traverse((object) => {
    if ((object as Mesh).isMesh && isDetail(object)) hide(object, true);
  });
}

/**
 * Shows `level` of the house standing at world height `baseY` (its slot), the site showing `shown` (the basement shows
 * 'none' while the house's storeys are cut, moduleCut): moves the planes (the void's to the upper floor's cut, or under
 * the ground floor's to the top of what hangs in the void: voidCutHeight) and puts every opaque material on its side
 * (double while cut, its own when whole). Only a material whose side changes recompiles, so moving between cut heights
 * costs nothing, and a cutaway made over materials a previous mount left cut sets them right at once. A mesh lying
 * wholly over the plane it clips at is left out of the drawing (HIDDEN_LAYER: under the basement's cut the whole house),
 * it and its shadow being clipped away anyway, and what the module tags buried shows only under the basement's cut; a
 * mesh casts its shadow from the level its `shade` says on, and a late one draws after the rest while the cut is off.
 * What the interior tags detail shows only while the camera is `near` the house (nearHouse: close enough to make it
 * out), the house whole or cut, as long as the cut leaves it. Under the basement's cut the lights over the lawn (the
 * house's) go dark, still drawn.
 */
export function applyCut(
  cutaway: HouseCutaway,
  level: CutLevel,
  baseY: number,
  shown: CutLevel = level,
  near = false,
): void {
  const height = cutHeight(level);
  const voidHeight = voidCutHeight(cutaway, level);
  cutaway.plane.constant = height === null ? NO_CUT : baseY + height;
  cutaway.voidPlane.constant = voidHeight === null ? NO_CUT : baseY + voidHeight;
  if (cutaway.unclipWhole) {
    // a module only a floor button cuts: whole, its shaders go without the plane (no discard: occluded fragments under
    // the plinth cost nothing), and take it back under its cut (one recompile, then cached)
    for (const [material, plane] of cutaway.clipped) {
      const want = level === 'none' ? null : plane;
      if ((material.clippingPlanes?.[0] ?? null) === want) continue;
      material.clippingPlanes = want ? [want] : null;
      material.needsUpdate = true;
    }
  }
  for (const { mesh, bottom, casts, uncut, buried, detail, shade, late } of cutaway.meshes) {
    const over = uncut ? voidHeight : height;
    hide(
      mesh,
      (buried && level !== 'basement') || (detail && !near) || (over !== null && bottom >= over),
    );
    mesh.castShadow = casts && DEPTH[shown] >= DEPTH[shade];
    if (late) mesh.renderOrder = level === 'basement' ? 0 : UNDER_LAWN_ORDER;
  }
  for (const { light, over } of cutaway.lights) {
    // userData.lit: the intensity the toggles give it (interact/effects applyToggles), which it gets back
    const dark = level === 'basement' && over;
    if ((light.userData.cutDark === true) === dark) continue;
    if (dark) light.userData.lit ??= light.intensity;
    light.userData.cutDark = dark;
    light.intensity = dark ? 0 : (light.userData.lit as number);
  }
  for (const material of cutaway.opaque) {
    const side: Side = level === 'none' ? (material.userData[SIDE] as Side) : DoubleSide;
    if (material.side === side) continue;
    material.side = side;
    material.needsUpdate = true; // the side is part of the shader program
  }
}

/** Whether warmCut has logged a compile that failed: once is enough (all it costs is a hitch on the first "Basement"). */
let warmFailed = false;

function warmFailure(error: unknown): void {
  if (warmFailed) return;
  warmFailed = true;
  console.warn(
    'Compiling the basement\'s cut look ahead failed; the first "Basement" compiles it.',
    error,
  );
}

/** Runs `compile`, logging (once) what it throws, or what the promise it returns rejects with, instead of passing it on. */
function tryCompile(compile: () => void | Promise<unknown>): void {
  try {
    const done = compile();
    if (done instanceof Promise) done.catch(warmFailure);
  } catch (error) {
    warmFailure(error);
  }
}

/**
 * Has `compile` compile what the module looks like at `level` while it is drawn whole: the planes back on the materials
 * of a module only a floor button cuts, the opaque ones double-sided; then puts its look back as it was. ModuleInstance
 * runs renderer.compileAsync in it while the site route is idle after the basement loads, and again once the night
 * lights come on or go off (the light count is part of every program), so the first "Basement" finds its shaders compiled
 * instead of compiling all of them in one frame. What the cut shows or hides is left alone: compile takes every mesh,
 * drawn or not. A compile that fails (a lost context) only costs that: logged once, never thrown.
 */
export function warmCut(
  cutaway: HouseCutaway,
  level: CutLevel,
  compile: () => void | Promise<unknown>,
): void {
  const planes = new Map<Material, Plane[] | null>();
  const sides = new Map<Material, Side>();
  if (level === 'none') {
    tryCompile(compile); // its look now
    return;
  }
  if (cutaway.unclipWhole) {
    for (const [material, plane] of cutaway.clipped) {
      planes.set(material, material.clippingPlanes);
      material.clippingPlanes = [plane];
    }
  }
  for (const material of cutaway.opaque) {
    sides.set(material, material.side);
    material.side = DoubleSide;
  }
  for (const material of [...planes.keys(), ...sides.keys()]) material.needsUpdate = true;
  tryCompile(compile);
  for (const [material, own] of planes) material.clippingPlanes = own;
  for (const [material, side] of sides) material.side = side;
  for (const material of [...planes.keys(), ...sides.keys()]) material.needsUpdate = true;
}

/** A rectangle the basement is seen through while its cut is off, in module space (glTF): its corners and middle. */
interface Hole {
  corners: Vector3[];
  centre: Vector3;
}

/**
 * What a module (the basement) shows through its openings (extras openingOf: the light well's top, the stair's hole)
 * while it is not cut down to: the openings in its own space, the module, and what lies under them that is neither
 * buried nor an opening's own, with its box in module space; showThroughOpenings draws each only where an opening shows
 * it.
 */
export interface Openings {
  root: Object3D;
  holes: Hole[];
  meshes: { mesh: Mesh; box: Box3 }[];
}

/** How far a mesh's box is grown before the openings test it (m): the hot tub's bubbles bob over theirs. */
const OPENING_MARGIN = 0.1;

/** The openings of the module `root` and what lies under them (Openings), null for a module without any. */
export function findOpenings(root: Object3D): Openings | null {
  const holes: Hole[] = [];
  let top = -Infinity;
  root.traverse((object) => {
    const rect = object.userData.opening === undefined ? null : openingOf(object);
    if (!rect) return;
    const [x0, y0, x1, y1, z] = rect; // Blender x, y, z: glTF x, z, -y
    const corners = [
      new Vector3(x0, z, -y0),
      new Vector3(x1, z, -y0),
      new Vector3(x1, z, -y1),
      new Vector3(x0, z, -y1),
    ];
    holes.push({ corners, centre: new Vector3((x0 + x1) / 2, z, -(y0 + y1) / 2) });
    top = Math.max(top, z);
  });
  if (!holes.length) return null;
  root.updateWorldMatrix(true, true);
  const local = new Matrix4().copy(root.matrixWorld).invert();
  const meshes: Openings['meshes'] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || isBuried(object) || openingOf(object) !== null) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry
      .boundingBox!.clone()
      .applyMatrix4(new Matrix4().multiplyMatrices(local, mesh.matrixWorld));
    if (box.max.y > top + 1e-3) return; // over the openings: in the open
    meshes.push({ mesh, box: box.expandByScalar(OPENING_MARGIN) });
  });
  return { root, holes, meshes };
}

const eyeLocal = new Vector3();
const toLocal = new Matrix4();
const side = new Plane();
const corner = new Vector3();

/**
 * Whether `box` (module space) can show through `hole` from `eye` (module space): it is not wholly outside any of the
 * four planes through the eye and the hole's edges (the pyramid of sight lines through the hole; what is under the
 * hole and inside it may show). An eye no higher than the hole is not ruled out.
 */
function seenThrough(box: Box3, eye: Vector3, hole: Hole): boolean {
  if (eye.y <= hole.centre.y + 1e-3) return true;
  for (let i = 0; i < 4; i++) {
    side.setFromCoplanarPoints(eye, hole.corners[i], hole.corners[(i + 1) % 4]);
    if (side.distanceToPoint(hole.centre) < 0) side.negate();
    const n = side.normal;
    corner.set(
      n.x > 0 ? box.max.x : box.min.x,
      n.y > 0 ? box.max.y : box.min.y,
      n.z > 0 ? box.max.z : box.min.z,
    );
    if (side.distanceToPoint(corner) < 0) return false;
  }
  return true;
}

/**
 * Once a frame, with the camera at world `eye`: draws what lies under the module's openings only where one of them
 * shows it (seenThrough; UNSEEN_LAYER, so what the cut leaves out stays out and `visible` stays the effects'), all of it
 * while the basement's cut is on (`open`). From the site's first view, low in front, the spa shows through the light
 * well's glass but not its hot tub under the line of sight, nor the hall's floor under the stair's hole: their draw calls
 * go, without a pixel changing. The module's place is brought up to date first: on the frame after its slot moved (the
 * first one), three has not drawn it yet.
 */
export function showThroughOpenings(openings: Openings, eye: Vector3, open: boolean): void {
  openings.root.updateWorldMatrix(true, false);
  eyeLocal.copy(eye).applyMatrix4(toLocal.copy(openings.root.matrixWorld).invert());
  for (const { mesh, box } of openings.meshes) {
    let seen = open;
    for (let i = 0; !seen && i < openings.holes.length; i++)
      seen = seenThrough(box, eyeLocal, openings.holes[i]);
    hide(mesh, !seen, UNSEEN_LAYER);
  }
}
