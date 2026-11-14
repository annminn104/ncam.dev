import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3, type Group, type Mesh, type Object3D } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackView } from '../bridge';
import { fakeTurntable } from '../testing/fake-turntable';
import {
  LUXE_LEDGE,
  LUXE_RECORD,
  LUXE_SEAT,
  LUXE_SLEEVE,
  LUXE_STAND,
  luxeSlot,
} from '../testing/model-measures';
import { REQUIRED_NODES, type RequiredNode } from './contract';
import { restingPose, type DiscPose, type Pose } from './director';
import type { Slots } from './materials';
import type { CdModel, VinylModel } from './model';
import { applyPose, rigFor, type Rig } from './rig';
import { emptyShelf, fillShelf, targetOf, type Lineup } from './stage';

/**
 * Luxe's ornament (art/blender/scripts/luxe_ornament.py: every `*_orn_*` node of
 * cd-player-luxe.glb, on the deck, the stand and the ledge) keeps 5 mm or more off every record and
 * sleeve, resting in the rack, on the platter and on the ledge, and at every step of every flight
 * rig.test.ts flies. The record is measured as a solid disc (Ø 300 mm, 1.8 thick) and the sleeve as
 * a box (310 mm square, 3 thick); the ledge's legs and the sleeves lean 15°, so no axis-aligned box
 * would do. The closest today: the ledge legs' vines, which keep to the legs' backs, the sleeve on
 * the ledge leaning 0.4 mm off their fronts.
 *
 * The suitcase's ornament (art/blender/scripts/suitcase_ornament.py: every `*_orn_*` node of
 * cd-player.glb, on the tub, the deck and the lid's lining) keeps 5 mm or more off every disc the
 * same way: resting on the spindle and in the rack, and at every step of every way between the
 * spindle and a slot, between two slots, and out of sight and back. The suitcase is loaded as the
 * page loads it, its rig built from its own nodes, and each disc is measured as a solid disc of the
 * GLB's own disc's radius and faces.
 *
 * Vertex-exact: each ornament vertex is taken into the item's own frame and measured there, and the
 * distance is brought back to the world's by the item's scale, which the rig sets on a copy as it
 * shrinks away or grows in (uniformly, so the one factor is exact).
 */

const LUXE_GLB = fileURLToPath(new URL('../../public/assets/cd-player-luxe.glb', import.meta.url));
const SUITCASE_GLB = fileURLToPath(new URL('../../public/assets/cd-player.glb', import.meta.url));
/** The clearance every flight keeps off the ornament: 5 mm. */
const CLEARANCE = 0.005;
/** Steps along each flight (rig.test.ts takes 200). */
const STEPS = 120;
/** A sleeve's half thickness (vinyl.py's SLEEVE_T, 3 mm). */
const SLEEVE_HALF_T = 0.0015;
/**
 * How far past an item's own reach the ornament is measured: further off, it cannot be the closest
 * that counts, and within it the least distance at rest is a number, not Infinity.
 */
const REACH = 0.03;

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: null,
  artistUrl: null,
});
const lineup = (current: string | null, ...upcoming: string[]): Lineup => ({
  collection: { name: 'Mix', subtitle: 'Owner', key: 'playlist:mix' },
  current: current === null ? null : track(current),
  upcoming: upcoming.map(track),
});

/** Disc `disc` alone on its way, every other copy out of sight (as rig.test.ts's `only`). */
function only(disc: number, pose: DiscPose): Pose {
  const rest = restingPose(emptyShelf(), false, false);
  return { ...rest, discs: rest.discs.map((_, index) => (index === disc ? pose : null)) };
}

/** A committed GLB as the page loads it: three's GLTFLoader with the meshopt decoder. */
async function loadGlb(file: string): Promise<Group> {
  const bytes = readFileSync(file);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await loader.parseAsync(data as ArrayBuffer, '');
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/** The world-space vertices of every ornament mesh (`*_orn_*`) under `root`. */
function ornamentOf(root: Object3D): Vector3[] {
  const out: Vector3[] = [];
  root.traverse((child: Object3D) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.name.includes('_orn_')) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      out.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    }
  });
  return out;
}

/**
 * An item measured in its own frame: a point's distance to it, and its reach (the radius round its
 * origin that holds all of it).
 */
interface Measure {
  distance: (p: Vector3) => number;
  reach: number;
}

/** A record (its face local XZ): a solid disc. */
const toRecord: Measure = {
  distance: (p) =>
    Math.hypot(
      Math.max(Math.hypot(p.x, p.z) - LUXE_RECORD.radius, 0),
      Math.max(Math.abs(p.y) - LUXE_RECORD.half, 0),
    ),
  reach: Math.hypot(LUXE_RECORD.radius, LUXE_RECORD.half),
};

/** A sleeve (its face local XZ): a box. */
const toSleeve: Measure = {
  distance: (p) =>
    Math.hypot(
      Math.max(Math.abs(p.x) - LUXE_SLEEVE.half, 0),
      Math.max(Math.abs(p.y) - SLEEVE_HALF_T, 0),
      Math.max(Math.abs(p.z) - LUXE_SLEEVE.half, 0),
    ),
  reach: Math.hypot(LUXE_SLEEVE.half, SLEEVE_HALF_T, LUXE_SLEEVE.half),
};

/** The GLB's disc in its own frame (its face local XZ): its radius and its two faces' heights. */
interface DiscShape {
  radius: number;
  bottom: number;
  top: number;
}

/** A CD of `shape`: a solid disc. */
function toDisc(shape: DiscShape): Measure {
  return {
    distance: (p) =>
      Math.hypot(
        Math.max(Math.hypot(p.x, p.z) - shape.radius, 0),
        Math.max(shape.bottom - p.y, p.y - shape.top, 0),
      ),
    reach: Math.hypot(shape.radius, Math.max(Math.abs(shape.bottom), Math.abs(shape.top))),
  };
}

/**
 * The least world distance from `ornament` to the item `object` poses, as `measure` takes it in
 * the item's own frame, or Infinity when none of it lies within REACH of the item. A copy the rig
 * shrinks carries a scale (`setScalar`, the same on every axis): a distance in its frame is the
 * world's over that scale, so the scale brings it back.
 */
function closest(ornament: readonly Vector3[], object: Object3D, measure: Measure): number {
  object.updateMatrixWorld(true);
  const toItem = new Matrix4().copy(object.matrixWorld).invert();
  const scale = object.matrixWorld.getMaxScaleOnAxis();
  const centre = new Vector3().setFromMatrixPosition(object.matrixWorld);
  const reach = (measure.reach * scale + REACH) ** 2;
  const local = new Vector3();
  let least = Infinity;
  for (const p of ornament) {
    if (p.distanceToSquared(centre) > reach) continue;
    least = Math.min(least, measure.distance(local.copy(p).applyMatrix4(toItem)));
  }
  return least * scale;
}

/** The fake turntable posed as cd-player-luxe.glb (as rig.test.ts's Luxe set). */
function luxeRig(): Rig {
  const { model, seat, disc, sleeveSeat, sleeve, stand, slots } = fakeTurntable();
  seat.position.set(...LUXE_SEAT.position);
  seat.quaternion.identity();
  disc.position.copy(seat.position);
  disc.quaternion.copy(seat.quaternion);
  sleeveSeat.position.set(...LUXE_LEDGE.seat.position);
  sleeveSeat.rotation.set(LUXE_LEDGE.seat.rotationX, 0, 0);
  sleeve.position.copy(sleeveSeat.position);
  sleeve.quaternion.copy(sleeveSeat.quaternion);
  stand.position.set(...LUXE_STAND.position);
  stand.rotation.set(0, LUXE_STAND.rotationY, 0);
  slots.forEach((slot, k) => {
    const { position, rotationX } = luxeSlot(k);
    slot.position.set(...position);
    slot.rotation.set(rotationX, 0, 0);
  });
  model.root.updateMatrixWorld(true);
  const luxe: VinylModel = { ...model, id: 'luxe' };
  return rigFor(luxe);
}

describe('Luxe’s ornament and its records and sleeves', () => {
  let ornament: Vector3[] = [];
  beforeAll(async () => {
    ornament = ornamentOf(await loadGlb(LUXE_GLB));
  });

  it('loads the deck’s, the stand’s and the ledge’s ornament', () => {
    expect(ornament.length).toBeGreaterThan(10_000);
  });

  it('keeps 5 mm off every record and sleeve at rest: in the rack, on the platter and on the ledge', () => {
    const rig = luxeRig();
    applyPose(
      rig,
      restingPose(fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f'))), true, false),
      0,
    );
    let least = Infinity;
    rig.discs.slice(0, 6).forEach((copy, index) => {
      const record = closest(ornament, copy.object, toRecord);
      const sleeve = closest(ornament, copy.sleeve!.object, toSleeve);
      expect(record, `record ${index}`).toBeGreaterThan(CLEARANCE);
      expect(sleeve, `sleeve ${index}`).toBeGreaterThan(CLEARANCE);
      least = Math.min(least, record, sleeve);
    });
    // It measured something: the ledge's sleeve stands about 5.2 mm off the legs' vines.
    expect(Number.isFinite(least)).toBe(true);
  });

  it('keeps 5 mm off every record and its sleeve at every step of every flight', () => {
    const rig = luxeRig();
    const ways: [string, DiscPose['from'], DiscPose['to']][] = [
      ...[0, 1, 2, 3, 4].map((slot): [string, DiscPose['from'], DiscPose['to']] => [
        `slot ${slot} onto the platter`,
        slot,
        'spindle',
      ]),
      ['the platter back into slot 0', 'spindle', 0],
      ...[1, 2, 3, 4].map((slot): [string, DiscPose['from'], DiscPose['to']] => [
        `slot ${slot} down to slot ${slot - 1}`,
        slot,
        slot - 1,
      ]),
      ['the platter out of sight', 'spindle', null],
      ['out of sight onto the platter', null, 'spindle'],
    ];
    for (const [way, from, to] of ways) {
      for (let step = 0; step <= STEPS; step++) {
        const along = step / STEPS;
        applyPose(rig, only(1, { from, to, along }), 0);
        const copy = rig.discs[1];
        if (copy.object.visible) {
          expect(
            closest(ornament, copy.object, toRecord),
            `the record, ${way}, along ${along}`,
          ).toBeGreaterThan(CLEARANCE);
        }
        if (copy.sleeve?.object.visible) {
          expect(
            closest(ornament, copy.sleeve.object, toSleeve),
            `the sleeve, ${way}, along ${along}`,
          ).toBeGreaterThan(CLEARANCE);
        }
      }
    }
  });
});

/** `disc`'s meshes measured in its own frame. */
function discShape(disc: Object3D): DiscShape {
  const toFrame = new Matrix4().copy(disc.matrixWorld).invert();
  const shape = { radius: 0, bottom: Infinity, top: -Infinity };
  const p = new Vector3();
  disc.traverse((child: Object3D) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    const matrix = toFrame.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(matrix);
      shape.radius = Math.max(shape.radius, Math.hypot(p.x, p.z));
      shape.bottom = Math.min(shape.bottom, p.y);
      shape.top = Math.max(shape.top, p.y);
    }
  });
  return shape;
}

/**
 * cd-player.glb as the page loads it, with its ornament and its disc measured before the rig takes
 * the disc for its copies, and the rig built from its own nodes.
 */
async function suitcaseSet(): Promise<{ rig: Rig; ornament: Vector3[]; disc: DiscShape }> {
  const root = await loadGlb(SUITCASE_GLB);
  const nodes: Partial<Record<RequiredNode, Object3D>> = {};
  for (const name of REQUIRED_NODES) {
    const node = root.getObjectByName(name);
    if (!node) throw new Error(`cd-player.glb has no ${name}`);
    nodes[name] = node;
  }
  const ornament = ornamentOf(root);
  const disc = discShape(nodes.disc!);
  const model: CdModel = {
    id: 'suitcase',
    media: 'cd',
    root,
    nodes: nodes as CdModel['nodes'],
    slots: {} as Slots,
    optionalSlots: {},
    dispose: () => {},
    applyLook: () => {},
  };
  return { rig: rigFor(model), ornament, disc };
}

describe('the suitcase’s ornament and its discs', () => {
  let set: Awaited<ReturnType<typeof suitcaseSet>>;
  let measure: Measure;
  beforeAll(async () => {
    set = await suitcaseSet();
    measure = toDisc(set.disc);
  });

  it('loads the tub’s, the deck’s and the lining’s ornament, and the disc it measures', () => {
    expect(set.ornament.length).toBeGreaterThan(10_000);
    // parts.py's disc: 120 mm across, 1.2 mm of polycarbonate under its 0.8 mm stacking ring.
    expect(set.disc.radius).toBeCloseTo(0.06, 4);
    expect(set.disc.top - set.disc.bottom).toBeCloseTo(0.0014, 4);
  });

  it('keeps 5 mm off every disc at rest: on the spindle and in the rack', () => {
    const { rig } = set;
    applyPose(
      rig,
      restingPose(fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f'))), true, false),
      0,
    );
    let least = Infinity;
    rig.discs.slice(0, 6).forEach((copy, index) => {
      expect(copy.object.visible, `disc ${index}`).toBe(true);
      const distance = closest(set.ornament, copy.object, measure);
      expect(distance, `disc ${index}`).toBeGreaterThan(CLEARANCE);
      least = Math.min(least, distance);
    });
    // It measured something: slot 4's disc stands about 13 mm off the lining's daisy under the strap.
    expect(Number.isFinite(least)).toBe(true);
  });

  it('keeps 5 mm off a disc at every step of every way it flies', () => {
    const { rig } = set;
    const slots = [0, 1, 2, 3, 4] as const;
    const ways: [string, DiscPose['from'], DiscPose['to']][] = [
      ...slots.flatMap((slot): [string, DiscPose['from'], DiscPose['to']][] => [
        [`slot ${slot} onto the spindle`, slot, 'spindle'],
        [`the spindle back into slot ${slot}`, 'spindle', slot],
      ]),
      ...[1, 2, 3, 4].map((slot): [string, DiscPose['from'], DiscPose['to']] => [
        `slot ${slot} down to slot ${slot - 1}`,
        slot,
        slot - 1,
      ]),
      ['the spindle out of sight', 'spindle', null],
      ['out of sight onto the spindle', null, 'spindle'],
    ];
    for (const [way, from, to] of ways) {
      for (let step = 0; step <= STEPS; step++) {
        const along = step / STEPS;
        applyPose(rig, only(1, { from, to, along }), 0);
        const copy = rig.discs[1];
        if (!copy.object.visible) continue;
        expect(
          closest(set.ornament, copy.object, measure),
          `${way}, along ${along}`,
        ).toBeGreaterThan(CLEARANCE);
      }
    }
  });
});
