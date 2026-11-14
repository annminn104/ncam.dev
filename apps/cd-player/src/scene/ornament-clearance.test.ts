import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Matrix4, Quaternion, Vector3, type Group, type Mesh, type Object3D } from 'three';
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
 * rig.test.ts flies (spec §5). Vertex-exact: each ornament vertex is taken into the item's own frame
 * and measured to the record as a solid disc (Ø 300 mm, 1.8 thick) and to the sleeve as a box
 * (310 mm square, 3 thick); the ledge's legs and the sleeves lean 15°, so no axis-aligned box would
 * do. The closest today: the ledge legs' vines, which keep to the legs' backs, the sleeve on the
 * ledge leaning 0.4 mm off their fronts.
 *
 * The suitcase's ornament (art/blender/scripts/suitcase_ornament.py: every `*_orn_*` node of
 * cd-player.glb, on the tub, the deck and the lid's lining) keeps 5 mm or more off every disc the
 * same way: resting on the spindle and in the rack, and at every step of every way between the
 * spindle and a slot, between two slots, and out of sight and back. The suitcase is loaded as the
 * page loads it, its rig built from its own nodes, and each disc is measured as a solid disc of the
 * GLB's own disc's radius and faces, scaled with it as it shrinks away or grows in.
 */

const LUXE_GLB = fileURLToPath(new URL('../../public/assets/cd-player-luxe.glb', import.meta.url));
/** The clearance spec §5 asks for: 5 mm. */
const CLEARANCE = 0.005;
/** Steps along each flight (rig.test.ts takes 200). */
const STEPS = 120;
/** A sleeve's half thickness (vinyl.py's SLEEVE_T, 3 mm). */
const SLEEVE_HALF_T = 0.0015;

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

/** The world-space vertices of every ornament mesh of cd-player-luxe.glb, as three loads it. */
async function ornamentVertices(): Promise<Vector3[]> {
  const bytes = readFileSync(LUXE_GLB);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await loader.parseAsync(data as ArrayBuffer, '');
  gltf.scene.updateMatrixWorld(true);
  const out: Vector3[] = [];
  gltf.scene.traverse((child: Object3D) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.name.includes('_orn_')) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      out.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    }
  });
  return out;
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

/** A point's distance (its item's own frame, the face local XZ) to a record: a solid disc. */
function toRecord(p: Vector3): number {
  const radial = Math.max(Math.hypot(p.x, p.z) - LUXE_RECORD.radius, 0);
  return Math.hypot(radial, Math.max(Math.abs(p.y) - LUXE_RECORD.half, 0));
}

/** A point's distance (its item's own frame, the face local XZ) to a sleeve: a box. */
function toSleeve(p: Vector3): number {
  return Math.hypot(
    Math.max(Math.abs(p.x) - LUXE_SLEEVE.half, 0),
    Math.max(Math.abs(p.y) - SLEEVE_HALF_T, 0),
    Math.max(Math.abs(p.z) - LUXE_SLEEVE.half, 0),
  );
}

describe('Luxe’s ornament and its records and sleeves (spec §5)', () => {
  let ornament: Vector3[] = [];
  beforeAll(async () => {
    ornament = await ornamentVertices();
  });

  /** The least distance from the ornament to `object` (its own frame) as `measure` takes it. */
  function closest(object: Object3D, measure: (p: Vector3) => number): number {
    object.updateMatrixWorld(true);
    const toItem = new Matrix4().copy(object.matrixWorld).invert();
    const centre = new Vector3().setFromMatrixPosition(object.matrixWorld);
    // Nothing further than the item's reach (a sleeve's half diagonal) and the clearance can count.
    const reach = (Math.SQRT2 * LUXE_SLEEVE.half + 0.01) ** 2;
    const local = new Vector3();
    let least = Infinity;
    for (const p of ornament) {
      if (p.distanceToSquared(centre) > reach) continue;
      least = Math.min(least, measure(local.copy(p).applyMatrix4(toItem)));
    }
    return least;
  }

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
    rig.discs.slice(0, 6).forEach((copy, index) => {
      expect(closest(copy.object, toRecord), `record ${index}`).toBeGreaterThan(CLEARANCE);
      expect(closest(copy.sleeve!.object, toSleeve), `sleeve ${index}`).toBeGreaterThan(CLEARANCE);
    });
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
            closest(copy.object, toRecord),
            `the record, ${way}, along ${along}`,
          ).toBeGreaterThan(CLEARANCE);
        }
        if (copy.sleeve?.object.visible) {
          expect(
            closest(copy.sleeve.object, toSleeve),
            `the sleeve, ${way}, along ${along}`,
          ).toBeGreaterThan(CLEARANCE);
        }
      }
    }
  });
});

const SUITCASE_GLB = fileURLToPath(new URL('../../public/assets/cd-player.glb', import.meta.url));

/** The GLB's disc in its own frame (its face local XZ): its radius and its two faces' heights. */
interface DiscShape {
  radius: number;
  bottom: number;
  top: number;
}

/** The world-space vertices of every ornament mesh under `root`. */
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

/** `disc`'s meshes measured in its own frame. */
function discShape(disc: Object3D): DiscShape {
  const toDisc = new Matrix4().copy(disc.matrixWorld).invert();
  const shape = { radius: 0, bottom: Infinity, top: -Infinity };
  const p = new Vector3();
  disc.traverse((child: Object3D) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    const matrix = toDisc.clone().multiply(mesh.matrixWorld);
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
 * cd-player.glb as the page loads it (GLTFLoader with meshopt), with its ornament and its disc
 * measured before the rig takes the disc for its copies, and the rig built from its own nodes.
 */
async function suitcaseSet(): Promise<{ rig: Rig; ornament: Vector3[]; disc: DiscShape }> {
  const bytes = readFileSync(SUITCASE_GLB);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await loader.parseAsync(data as ArrayBuffer, '');
  const root: Group = gltf.scene;
  root.updateMatrixWorld(true);
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
  beforeAll(async () => {
    set = await suitcaseSet();
  });

  /**
   * The least distance from the ornament to the solid disc `object` poses (scaled with it), or
   * Infinity when none of the ornament is within the clearance of it.
   */
  function closest(object: Object3D): number {
    object.updateMatrixWorld(true);
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    object.matrixWorld.decompose(position, quaternion, scale);
    const k = scale.x;
    const { radius, bottom, top } = set.disc;
    const reach =
      (Math.hypot(radius, Math.max(Math.abs(bottom), Math.abs(top))) * k + CLEARANCE) ** 2;
    const back = quaternion.clone().invert();
    const local = new Vector3();
    let least = Infinity;
    for (const p of set.ornament) {
      if (p.distanceToSquared(position) > reach) continue;
      local.copy(p).sub(position).applyQuaternion(back);
      const radial = Math.max(Math.hypot(local.x, local.z) - radius * k, 0);
      const across = Math.max(bottom * k - local.y, local.y - top * k, 0);
      least = Math.min(least, Math.hypot(radial, across));
    }
    return least;
  }

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
    rig.discs.slice(0, 6).forEach((copy, index) => {
      expect(copy.object.visible, `disc ${index}`).toBe(true);
      expect(closest(copy.object), `disc ${index}`).toBeGreaterThan(CLEARANCE);
    });
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
        expect(closest(copy.object), `${way}, along ${along}`).toBeGreaterThan(CLEARANCE);
      }
    }
  });
});
