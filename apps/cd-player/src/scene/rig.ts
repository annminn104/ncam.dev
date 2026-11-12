import {
  Box3,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type Mesh,
  type MeshPhysicalMaterial,
  type Object3D,
  type Texture,
} from 'three';
import type { ModelId } from '../models';
import type { RequiredNode } from './contract';
import { ARM_PLAY, ARM_REST, type DiscPose, type Pose } from './director';
import type { PlayerModel } from './model';
import { SCENE_PROFILES } from './profiles';
import { DISC_COPIES, emptyShelf, type Place, type StageState } from './stage';

/** The rack's slots in the model, slot 0 the next to play: each the pose of a disc in it. */
const RACK_NODES = [
  'rack_slot_0',
  'rack_slot_1',
  'rack_slot_2',
  'rack_slot_3',
  'rack_slot_4',
] as const satisfies readonly RequiredNode[];
const ARM_LIFT_M = 0.006;
const SPIN_RAD_S = (200 / 60) * 2 * Math.PI;
/** Room between the turning case and the lid's lining, past the reach of its half-width. */
const CASE_FLIP_MARGIN_M = 0.01;
/** A disc this small is out of sight. */
const HIDDEN_BELOW = 1e-3;
const UP = new Vector3(0, 1, 0);
/** The case's own vertical in the open lid (Blender's Y): it turns over about it. */
const CASE_AXIS = new Vector3(0, 0, 1);

export interface DiscCopy {
  object: Object3D;
  label: MeshPhysicalMaterial;
}

/** A place's pose in world space, and its normal: the way a disc leaves and reaches it. */
export interface PlaceFrame {
  position: Vector3;
  quaternion: Quaternion;
  out: Vector3;
}

export interface CaseRig {
  object: Object3D;
  /** Its seat in the lid (its parent's space), and its own up there: out of the lid. */
  seat: Vector3;
  quaternion: Quaternion;
  out: Vector3;
  /** How far it rises before it turns over, measured from its meshes. */
  lift: number;
  booklet: MeshPhysicalMaterial;
}

export interface Rig extends StageState {
  model: PlayerModel;
  /** DISC_COPIES copies of the disc, each with its own label. */
  discs: DiscCopy[];
  case: CaseRig;
  /** The booklet's two prints (the print hook sets them): `bookletFront` shows. */
  bookletMaps: [Texture | null, Texture | null];
  spin: number;
  /** The knob's turn as a seek (ms) while one is going on, for the display's preview; else null. */
  scrubMs: number | null;
  /** How far the disc follows the knob's turn going on (radians); 0 between turns. */
  knobTurn: number;
  /** 1, or -1 for a profile that plays clockwise. */
  spinSense: 1 | -1;
  arm: { node: Object3D; baseRotationY: number; baseY: number };
  /** The door's hinge, for a model with one: where it is shut, and the turn that opens it. */
  door: { node: Object3D; base: number; angle: number; axis: 'x' | 'y' } | null;
  /** How far the door stood open at the last pose: 0 shut … 1 open; 0 for a model without one. */
  doorOpen: number;
  /**
   * The spindle's seat, in world space (the discs live at the root), and its normal: the way a disc
   * leaves and reaches it, as a slot's is (up out of the suitcase's deck, out of the Clear's door).
   */
  seat: { position: Vector3; quaternion: Quaternion; out: Vector3 };
  /** Each rack slot, in world space. */
  slots: PlaceFrame[];
  /**
   * The model's flights (its profile's): how far their handles reach out of a slot and out of the
   * spindle, and where a disc leaving the spindle goes out of sight, from its seat.
   */
  flight: { reach: { slot: number; spindle: number }; aside: Vector3; exit: 'normal' | 'up' };
}

/** Gives every mesh under `root` that wears `name` one copy of it, so each instance prints its own. */
function ownMaterial(root: Object3D, name: string): MeshPhysicalMaterial {
  let copy: MeshPhysicalMaterial | null = null;
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || (mesh.material as MeshPhysicalMaterial).name !== name) return;
    copy ??= (mesh.material as MeshPhysicalMaterial).clone();
    mesh.material = copy;
  });
  if (!copy) throw new Error(`no ${name} under ${root.name}`);
  return copy;
}

function frameOf(node: Object3D): PlaceFrame {
  const position = new Vector3();
  const quaternion = new Quaternion();
  node.matrixWorld.decompose(position, quaternion, new Vector3());
  return { position, quaternion, out: UP.clone().applyQuaternion(quaternion) };
}

/**
 * How far the case rises out of its seat before it turns over about CASE_AXIS: the reach of its
 * meshes across the turn (its half-width and its depth) and a margin, so it never cuts into the
 * lid, whatever its size.
 */
function flipLift(object: Object3D): number {
  object.updateWorldMatrix(true, true);
  const toCase = object.matrixWorld.clone().invert();
  const box = new Box3();
  const part = new Box3();
  const local = new Matrix4();
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (bounds) {
      box.union(part.copy(bounds).applyMatrix4(local.multiplyMatrices(toCase, mesh.matrixWorld)));
    }
  });
  if (box.isEmpty()) return CASE_FLIP_MARGIN_M;
  const across = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
  const deep = Math.max(Math.abs(box.min.y), Math.abs(box.max.y));
  return Math.hypot(across, deep) + CASE_FLIP_MARGIN_M;
}

/** The axis a profile's door turns about: Y unless it says X. */
export function doorAxis(door: { axis?: 'x' | 'y' }): 'x' | 'y' {
  return door.axis ?? 'y';
}

/** Turns `door`'s hinge to `open` (0 shut … 1 open) about its own axis. */
export function turnDoor(door: NonNullable<Rig['door']>, open: number): void {
  door.node.rotation[door.axis] = door.base + door.angle * open;
}

/**
 * Between these two parts of its way from a slot (or, mirrored, to one) a disc lifted out of it turns
 * from upright to flat.
 */
const LIFT_TURN = [0.1, 0.5] as const;

const rigs = new WeakMap<PlayerModel, Rig>();

/** Which way a model's disc plays about its seat's up: 1 counter-clockwise, -1 clockwise. */
export function spinSense(profile: { clockwise?: boolean }): 1 | -1 {
  return profile.clockwise ? -1 : 1;
}

/** One rig per model (StrictMode renders twice; building it twice would clone twice). */
export function rigFor(model: PlayerModel): Rig {
  const existing = rigs.get(model);
  if (existing) return existing;
  const { nodes, root } = model;
  root.updateMatrixWorld(true);
  const seatPosition = new Vector3();
  const seatQuaternion = new Quaternion();
  nodes.disc_seat.matrixWorld.decompose(seatPosition, seatQuaternion, new Vector3());
  const profile = SCENE_PROFILES[model.id];
  const slots = RACK_NODES.map((name) => {
    const frame = frameOf(nodes[name]);
    // A crate's discs stand in their slots: they leave and come in straight up, not along the face.
    if (profile.flight.exit === 'up') frame.out.copy(UP);
    return frame;
  });
  // The discs fly in world space, so every copy lives at the root.
  const template = nodes.disc;
  root.attach(template);
  const discs: DiscCopy[] = [{ object: template, label: ownMaterial(template, 'art_disc') }];
  while (discs.length < DISC_COPIES) {
    const object = template.clone(true);
    root.add(object);
    discs.push({ object, label: ownMaterial(object, 'art_disc') });
  }
  const caseSeat = nodes.case_seat;
  const jewelCase: CaseRig = {
    object: nodes.case,
    seat: caseSeat.position.clone(),
    quaternion: caseSeat.quaternion.clone(),
    out: UP.clone().applyQuaternion(caseSeat.quaternion),
    lift: flipLift(nodes.case),
    booklet: ownMaterial(nodes.case, 'art_booklet'),
  };
  const door = profile.door;
  const rig: Rig = {
    model,
    discs,
    case: jewelCase,
    bookletMaps: [null, null],
    shelf: emptyShelf(),
    bookletFront: 0,
    filled: false,
    swapping: false,
    last: { armAngle: ARM_REST, spin: 0 },
    spin: 0,
    scrubMs: null,
    knobTurn: 0,
    spinSense: spinSense(profile),
    arm: {
      node: nodes.arm_pivot,
      baseRotationY: nodes.arm_pivot.rotation.y,
      baseY: nodes.arm_pivot.position.y,
    },
    door:
      nodes.door_hinge && door
        ? {
            node: nodes.door_hinge,
            base: nodes.door_hinge.rotation[doorAxis(door)],
            angle: door.angle,
            axis: doorAxis(door),
          }
        : null,
    doorOpen: 0,
    seat: {
      position: seatPosition,
      quaternion: seatQuaternion,
      out: UP.clone().applyQuaternion(seatQuaternion),
    },
    slots,
    flight: {
      exit: profile.flight.exit ?? 'normal',
      reach: { ...profile.flight.reach },
      aside: new Vector3(...profile.flight.aside),
    },
  };
  // The model's own dispose knows only its shared materials: the copies go with it.
  const prints = [...discs.map((disc) => disc.label), jewelCase.booklet];
  const disposeModel = model.dispose;
  model.dispose = () => {
    disposeModel();
    for (const material of prints) material.dispose();
  };
  rigs.set(model, rig);
  return rig;
}

const fromFrame: PlaceFrame = {
  position: new Vector3(),
  quaternion: new Quaternion(),
  out: new Vector3(),
};
const toFrame: PlaceFrame = {
  position: new Vector3(),
  quaternion: new Quaternion(),
  out: new Vector3(),
};
const handleA = new Vector3();
const handleB = new Vector3();
const spinQuaternion = new Quaternion();
const turnQuaternion = new Quaternion();

/** Where `place` is now, into `into`: the spindle turns with the disc on it. */
function placeAt(rig: Rig, place: Place, into: PlaceFrame): PlaceFrame {
  if (place === 'spindle') {
    into.position.copy(rig.seat.position);
    into.quaternion
      .copy(rig.seat.quaternion)
      .multiply(spinQuaternion.setFromAxisAngle(UP, rig.spin + rig.knobTurn));
    into.out.copy(rig.seat.out);
    return into;
  }
  const slot = rig.slots[place];
  into.position.copy(slot.position);
  into.quaternion.copy(slot.quaternion);
  into.out.copy(slot.out);
  return into;
}

/**
 * Out of sight from `place`: the profile's `aside` from the spindle (up and to the left of the
 * suitcase's, out of the Clear's door and up to its right); for a slot, the slot itself (a rack
 * disc shrinks away, or grows in, where it stands: any way out of the lid would pass through the
 * discs in front of it).
 */
function asideOf(rig: Rig, place: Place, into: PlaceFrame): PlaceFrame {
  placeAt(rig, place, into);
  if (place === 'spindle') into.position.add(rig.flight.aside);
  return into;
}

/**
 * How far a way to or from the spindle reaches out of `place` before it turns: out of a slot, or
 * out of the spindle (and out of sight beside it). Between two slots a disc moves in a straight
 * line: each slot stands behind the one below it, so a pop-out would cross a neighbour, and the
 * straight way only widens the gaps, as between discs further apart.
 */
function reachOf(rig: Rig, place: Place | null, flies: boolean): number {
  if (!flies) return 0;
  return place === 'spindle' || place === null ? rig.flight.reach.spindle : rig.flight.reach.slot;
}

function placeDisc(rig: Rig, copy: DiscCopy, pose: DiscPose | null): void {
  const { object } = copy;
  if (!pose || (pose.from === null && pose.to === null)) {
    object.visible = false;
    return;
  }
  if (pose.from !== null && pose.from === pose.to) {
    const at = placeAt(rig, pose.from, fromFrame);
    object.visible = true;
    object.position.copy(at.position);
    object.quaternion.copy(at.quaternion);
    object.scale.setScalar(1);
    return;
  }
  const a = MathUtils.clamp(pose.along, 0, 1);
  const start =
    pose.from === null
      ? asideOf(rig, pose.to as Place, fromFrame)
      : placeAt(rig, pose.from, fromFrame);
  const end =
    pose.to === null ? asideOf(rig, pose.from as Place, toFrame) : placeAt(rig, pose.to, toFrame);
  // Arriving it grows in, leaving it shrinks away; on its way between places it keeps its size.
  const scale =
    pose.from === null
      ? MathUtils.smoothstep(a, 0, 0.65)
      : pose.to === null
        ? 1 - MathUtils.smoothstep(a, 0.35, 1)
        : 1;
  if (scale < HIDDEN_BELOW) {
    object.visible = false;
    return;
  }
  object.visible = true;
  const flies = pose.from === 'spindle' || pose.to === 'spindle';
  handleA.copy(start.position).addScaledVector(start.out, reachOf(rig, pose.from, flies));
  handleB.copy(end.position).addScaledVector(end.out, reachOf(rig, pose.to, flies));
  // A cubic Bézier: out of the one place along its normal, into the other along its own (with
  // no reach, a straight line between two slots, or no way at all for a disc changing size).
  const u = 1 - a;
  object.position
    .copy(start.position)
    .multiplyScalar(u * u * u)
    .addScaledVector(handleA, 3 * u * u * a)
    .addScaledVector(handleB, 3 * u * a * a)
    .addScaledVector(end.position, a * a * a);
  // A disc lifted straight out of a crate's slot stays upright until it is clear of the foam and
  // lays flat on the way across, as it stands up again before it goes down into a slot.
  const fromSlot = typeof pose.from === 'number';
  const turn =
    rig.flight.exit === 'up' && flies
      ? fromSlot
        ? MathUtils.smoothstep(a, LIFT_TURN[0], LIFT_TURN[1])
        : 1 - MathUtils.smoothstep(1 - a, LIFT_TURN[0], LIFT_TURN[1])
      : a;
  object.quaternion.copy(start.quaternion).slerp(end.quaternion, turn);
  object.scale.setScalar(scale);
}

/** The case risen `lift` (0 … 1 of its lift) out of its seat and turned over `turn` (1: half a turn). */
function placeCase(rig: Rig, lift: number, turn: number): void {
  const item = rig.case;
  item.object.position.copy(item.seat).addScaledVector(item.out, lift * item.lift);
  item.object.quaternion
    .copy(item.quaternion)
    .multiply(turnQuaternion.setFromAxisAngle(CASE_AXIS, turn * Math.PI));
}

/** The booklet shows its front print, or from a turn's edge-on moment the other one. */
function showBooklet(rig: Rig, next: boolean): void {
  const map = rig.bookletMaps[next ? 1 - rig.bookletFront : rig.bookletFront];
  if (!map || rig.case.booklet.map === map) return;
  rig.case.booklet.map = map;
  rig.case.booklet.needsUpdate = true;
}

/** The director's arm angle (ARM_REST … ARM_PLAY) as this model's own (its profile's rest … play). */
export function modelArmAngle(model: ModelId, angle: number): number {
  const { rest, play } = SCENE_PROFILES[model].arm;
  return rest + ((angle - ARM_REST) / (ARM_PLAY - ARM_REST)) * (play - rest);
}

/** Puts every moving part where `pose` says, and notes where it left the arm and the spin. */
export function applyPose(rig: Rig, pose: Pose, dt: number): void {
  rig.arm.node.rotation.y = rig.arm.baseRotationY + modelArmAngle(rig.model.id, pose.armAngle);
  rig.arm.node.position.y = rig.arm.baseY + pose.armLift * ARM_LIFT_M;
  rig.spin = (rig.spin + dt * SPIN_RAD_S * pose.spin * rig.spinSense) % (2 * Math.PI);
  rig.last.armAngle = pose.armAngle;
  rig.last.spin = pose.spin;
  rig.discs.forEach((copy, index) => placeDisc(rig, copy, pose.discs[index] ?? null));
  placeCase(rig, pose.caseLift, pose.caseTurn);
  showBooklet(rig, pose.bookletNew);
  rig.doorOpen = rig.door ? pose.door : 0;
  if (rig.door) turnDoor(rig.door, pose.door);
}
