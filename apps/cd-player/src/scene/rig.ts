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
import type { SceneView } from '../bridge';
import type { SharedNode } from './contract';
import { scrubTargetMs } from './controls';
import {
  ARM_PLAY,
  ARM_REST,
  easeArm,
  turntableArm,
  type ArmPose,
  type DiscPose,
  type Pose,
} from './director';
import type { CdModel, PlayerModel, VinylModel } from './model';
import { createPlayhead, type Playhead, type PlayheadView } from './playhead';
import { SCENE_PROFILES, type SceneProfile } from './profiles';
import { DISC_COPIES, emptyShelf, type Place, type StageState } from './stage';
import { directorAngle, grooveAngle, grooveShare, toneArmOf, type ToneArm } from './tonearm';

/** The rack's slots in the model, slot 0 the next to play: each the pose of a disc in it. */
const RACK_NODES = [
  'rack_slot_0',
  'rack_slot_1',
  'rack_slot_2',
  'rack_slot_3',
  'rack_slot_4',
] as const satisfies readonly SharedNode[];
const ARM_LIFT_M = 0.006;
/** Room between the turning case and the lid's lining, past the reach of its half-width. */
const CASE_FLIP_MARGIN_M = 0.01;
/** A disc this small is out of sight. */
const HIDDEN_BELOW = 1e-3;
const UP = new Vector3(0, 1, 0);
/** The case's own vertical in the open lid (Blender's Y): it turns over about it. */
const CASE_AXIS = new Vector3(0, 0, 1);

/** A turntable record's sleeve: the template's copy, with its own `art_sleeve` print. */
export interface SleeveCopy {
  object: Object3D;
  print: MeshPhysicalMaterial;
}

export interface DiscCopy {
  object: Object3D;
  label: MeshPhysicalMaterial;
  /** A turntable record's sleeve, which follows the record on a way of its own; null on a CD player. */
  sleeve: SleeveCopy | null;
}

/**
 * Where a copy's way meets the deck: the record's spindle, which turns with the spin, or the
 * sleeve's ledge, which does not; and how far the way's handle reaches out of it.
 */
export interface Landing {
  frame: PlaceFrame;
  spins: boolean;
  reach: number;
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

export interface Rig<M extends PlayerModel = PlayerModel> extends StageState {
  model: M;
  /** The model's scene profile (src/scene/profiles.ts), as the rig was built from it. */
  profile: SceneProfile;
  /** DISC_COPIES copies of the disc, each with its own label. */
  discs: DiscCopy[];
  /** A CD player's jewel case; null on a turntable, which has none. */
  case: CaseRig | null;
  /** The booklet's two prints (the print hook sets them): `bookletFront` shows. */
  bookletMaps: [Texture | null, Texture | null];
  spin: number;
  /** The knob's turn as a seek (ms) while one is going on, for the display's preview; else null. */
  scrubMs: number | null;
  /** How far the disc follows the knob's turn going on (radians); 0 between turns. */
  knobTurn: number;
  /** 1, or -1 for a profile that plays clockwise. */
  spinSense: 1 | -1;
  /** The disc's spin at full speed, radians a second: its profile's rpm. */
  spinRate: number;
  /** A turntable's platter: its node, and its turn as the GLB has it; it turns with the record. */
  platter: { node: Object3D; base: number } | null;
  arm: { node: Object3D; baseRotationY: number; baseY: number };
  /** A turntable's tonearm (its profile's three angles); null on a CD player. */
  toneArm: M extends VinylModel ? ToneArm : null;
  /**
   * The position carried on frame by frame between the embed's reports (a turntable's arm, its
   * ring).
   */
  playhead: Playhead;
  /** The arm's angle an arm drag holds, about its pivot from the GLB's pose; null between drags. */
  armDrag: number | null;
  /** An arm drag's target (ms) while one goes on, for the LED ring; null between drags. */
  dragMs: number | null;
  /** The door's hinge, for a model with one: where it is shut, and the turn that opens it. */
  door: { node: Object3D; base: number; angle: number; axis: 'x' | 'y' } | null;
  /** How far the door stood open at the last pose: 0 shut … 1 open; 0 for a model without one. */
  doorOpen: number;
  /**
   * The spindle's seat, in world space (the discs live at the root), and its normal: the way a disc
   * leaves and reaches it, as a slot's is (up out of the suitcase's deck, out of the Clear's door).
   */
  seat: { position: Vector3; quaternion: Quaternion; out: Vector3 };
  /**
   * A turntable's ledge (`sleeve_seat`), in world space, where the playing record's sleeve stands.
   * Its `out` is the world's up: the ledge stands behind the deck, so a sleeve comes down onto it
   * from above, never along its face through the plinth. Null on a CD player.
   */
  sleeveSeat: PlaceFrame | null;
  /** The ways' ends at the deck: the record's (the spindle's seat) and its sleeve's (the ledge). */
  landings: { disc: Landing; sleeve: Landing | null };
  /** Each rack slot, in world space. */
  slots: PlaceFrame[];
  /**
   * The model's flights (its profile's): how far their handles reach out of a slot and out of the
   * spindle, and where a disc leaving the spindle goes out of sight, from its seat.
   */
  flight: {
    reach: { slot: number; spindle: number; ledge: number };
    aside: Vector3;
    exit: 'normal' | 'up';
  };
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

/** A CD player's jewel case, posed where it stands, with a booklet print of its own. */
function caseRigFor(model: CdModel): CaseRig {
  const { nodes } = model;
  return {
    object: nodes.case,
    seat: nodes.case_seat.position.clone(),
    quaternion: nodes.case_seat.quaternion.clone(),
    out: UP.clone().applyQuaternion(nodes.case_seat.quaternion),
    lift: flipLift(nodes.case),
    booklet: ownMaterial(nodes.case, 'art_booklet'),
  };
}

/** A rig for a CD player: its case and its knob are there. */
export function isCdRig(rig: Rig): rig is Rig<CdModel> {
  return rig.model.media === 'cd';
}

/** A rig for a turntable: its tone arm is there. */
export function isTurntableRig(rig: Rig): rig is Rig<VinylModel> {
  return rig.model.media === 'vinyl' && rig.toneArm !== null;
}

/** One rig per model (StrictMode renders twice; building it twice would clone twice). */
export function rigFor(model: PlayerModel, profile: SceneProfile = SCENE_PROFILES[model.id]): Rig {
  const existing = rigs.get(model);
  if (existing) return existing;
  const { nodes, root } = model;
  root.updateMatrixWorld(true);
  const seatPosition = new Vector3();
  const seatQuaternion = new Quaternion();
  nodes.disc_seat.matrixWorld.decompose(seatPosition, seatQuaternion, new Vector3());
  const slots = RACK_NODES.map((name) => {
    const frame = frameOf(nodes[name]);
    // A crate's discs stand in their slots: they leave and come in straight up, not along the face.
    if (profile.flight.exit === 'up') frame.out.copy(UP);
    return frame;
  });
  // The discs fly in world space, so every copy lives at the root, and a turntable's sleeves too.
  const template = nodes.disc;
  root.attach(template);
  const sleeveTemplate = model.media === 'vinyl' ? model.nodes.sleeve : null;
  if (sleeveTemplate) root.attach(sleeveTemplate);
  const copyOf = (index: number): DiscCopy => {
    const object = index === 0 ? template : template.clone(true);
    if (index > 0) root.add(object);
    let sleeve: SleeveCopy | null = null;
    if (sleeveTemplate) {
      const cover = index === 0 ? sleeveTemplate : sleeveTemplate.clone(true);
      if (index > 0) root.add(cover);
      sleeve = { object: cover, print: ownMaterial(cover, 'art_sleeve') };
    }
    return { object, label: ownMaterial(object, 'art_disc'), sleeve };
  };
  const discs: DiscCopy[] = Array.from({ length: DISC_COPIES }, (_, index) => copyOf(index));
  const seat = {
    position: seatPosition,
    quaternion: seatQuaternion,
    out: UP.clone().applyQuaternion(seatQuaternion),
  };
  const sleeveSeat: PlaceFrame | null =
    model.media === 'vinyl' ? { ...frameOf(model.nodes.sleeve_seat), out: UP.clone() } : null;
  const reach = {
    slot: profile.flight.reach.slot,
    spindle: profile.flight.reach.spindle,
    ledge: profile.flight.reach.ledge ?? profile.flight.reach.spindle,
  };
  const jewelCase = model.media === 'cd' ? caseRigFor(model) : null;
  const door = profile.door;
  const rig: Rig = {
    model,
    profile,
    discs,
    case: jewelCase,
    bookletMaps: [null, null],
    shelf: emptyShelf(),
    bookletFront: 0,
    filled: false,
    swapping: false,
    last: { armAngle: ARM_REST, spin: 0, armLift: 0 },
    spin: 0,
    scrubMs: null,
    knobTurn: 0,
    spinSense: spinSense(profile),
    spinRate: (profile.rpm / 60) * 2 * Math.PI,
    platter:
      model.media === 'vinyl'
        ? { node: model.nodes.platter, base: model.nodes.platter.rotation.y }
        : null,
    arm: {
      node: nodes.arm_pivot,
      baseRotationY: nodes.arm_pivot.rotation.y,
      baseY: nodes.arm_pivot.position.y,
    },
    toneArm: model.media === 'vinyl' ? toneArmOf(profile) : null,
    playhead: createPlayhead(),
    armDrag: null,
    dragMs: null,
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
    seat,
    sleeveSeat,
    landings: {
      disc: { frame: seat, spins: true, reach: reach.spindle },
      sleeve: sleeveSeat ? { frame: sleeveSeat, spins: false, reach: reach.ledge } : null,
    },
    slots,
    flight: {
      exit: profile.flight.exit ?? 'normal',
      reach,
      aside: new Vector3(...profile.flight.aside),
    },
  };
  // The model's own dispose knows only its shared materials: the copies go with it.
  const prints = [
    ...discs.map((disc) => disc.label),
    ...discs.flatMap((copy) => (copy.sleeve ? [copy.sleeve.print] : [])),
    ...(jewelCase ? [jewelCase.booklet] : []),
  ];
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

/** Where `place` is now, into `into`: the landing (the spindle turns with the disc on it), or a slot. */
function placeAt(rig: Rig, place: Place, into: PlaceFrame, landing: Landing): PlaceFrame {
  if (place === 'spindle') {
    into.position.copy(landing.frame.position);
    into.quaternion.copy(landing.frame.quaternion);
    if (landing.spins) {
      into.quaternion.multiply(spinQuaternion.setFromAxisAngle(UP, rig.spin + rig.knobTurn));
    }
    into.out.copy(landing.frame.out);
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
function asideOf(rig: Rig, place: Place, into: PlaceFrame, landing: Landing): PlaceFrame {
  placeAt(rig, place, into, landing);
  if (place === 'spindle') into.position.add(rig.flight.aside);
  return into;
}

/**
 * How far a way to or from the spindle reaches out of `place` before it turns: out of a slot, or
 * out of the spindle (and out of sight beside it). Between two slots a disc moves in a straight
 * line: each slot stands behind the one below it, so a pop-out would cross a neighbour, and the
 * straight way only widens the gaps, as between discs further apart.
 */
function reachOf(rig: Rig, place: Place | null, flies: boolean, landing: Landing): number {
  if (!flies) return 0;
  return place === 'spindle' || place === null ? landing.reach : rig.flight.reach.slot;
}

/**
 * Puts `object` where `pose` has it. A turntable's sleeve runs the same way with its ledge as the
 * landing: it leaves and arrives with its record, on one timeline.
 */
function placeOn(rig: Rig, object: Object3D, pose: DiscPose | null, landing: Landing): void {
  if (!pose || (pose.from === null && pose.to === null)) {
    object.visible = false;
    return;
  }
  if (pose.from !== null && pose.from === pose.to) {
    const at = placeAt(rig, pose.from, fromFrame, landing);
    object.visible = true;
    object.position.copy(at.position);
    object.quaternion.copy(at.quaternion);
    object.scale.setScalar(1);
    return;
  }
  const a = MathUtils.clamp(pose.along, 0, 1);
  const start =
    pose.from === null
      ? asideOf(rig, pose.to as Place, fromFrame, landing)
      : placeAt(rig, pose.from, fromFrame, landing);
  const end =
    pose.to === null
      ? asideOf(rig, pose.from as Place, toFrame, landing)
      : placeAt(rig, pose.to, toFrame, landing);
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
  handleA.copy(start.position).addScaledVector(start.out, reachOf(rig, pose.from, flies, landing));
  handleB.copy(end.position).addScaledVector(end.out, reachOf(rig, pose.to, flies, landing));
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
function placeCase(item: CaseRig, lift: number, turn: number): void {
  item.object.position.copy(item.seat).addScaledVector(item.out, lift * item.lift);
  item.object.quaternion
    .copy(item.quaternion)
    .multiply(turnQuaternion.setFromAxisAngle(CASE_AXIS, turn * Math.PI));
}

/** The booklet shows its front print, or from a turn's edge-on moment the other one. */
function showBooklet(rig: Rig, item: CaseRig, next: boolean): void {
  const map = rig.bookletMaps[next ? 1 - rig.bookletFront : rig.bookletFront];
  if (!map || item.booklet.map === map) return;
  item.booklet.map = map;
  item.booklet.needsUpdate = true;
}

/** The director's arm angle (ARM_REST … ARM_PLAY) as a profile's own (its rest … play). */
export function armAngleFor(arm: SceneProfile['arm'], angle: number): number {
  return arm.rest + ((angle - ARM_REST) / (ARM_PLAY - ARM_REST)) * (arm.play - arm.rest);
}

/**
 * Puts every moving part where `pose` says, and notes where it left the arm (its lift too, on a
 * turntable) and the spin.
 */
export function applyPose(rig: Rig, pose: Pose, dt: number): void {
  rig.arm.node.rotation.y = rig.arm.baseRotationY + armAngleFor(rig.profile.arm, pose.armAngle);
  rig.arm.node.position.y = rig.arm.baseY + pose.armLift * ARM_LIFT_M;
  rig.spin = (rig.spin + dt * rig.spinRate * pose.spin * rig.spinSense) % (2 * Math.PI);
  if (rig.platter) rig.platter.node.rotation.y = rig.platter.base + rig.spin;
  rig.last.armAngle = pose.armAngle;
  rig.last.spin = pose.spin;
  rig.last.armLift = rig.toneArm ? pose.armLift : 0;
  rig.discs.forEach((copy, index) => {
    const way = pose.discs[index] ?? null;
    placeOn(rig, copy.object, way, rig.landings.disc);
    if (copy.sleeve && rig.landings.sleeve)
      placeOn(rig, copy.sleeve.object, way, rig.landings.sleeve);
  });
  if (rig.case) {
    placeCase(rig.case, pose.caseLift, pose.caseTurn);
    showBooklet(rig, rig.case, pose.bookletNew);
  }
  rig.doorOpen = rig.door ? pose.door : 0;
  if (rig.door) turnDoor(rig.door, pose.door);
}

/**
 * A turntable's resting arm and platter this frame (turntableArm), eased from the last pose over
 * `dtS` seconds (Infinity under reduced motion). The groove's angle comes from the playhead, so
 * the arm tracks smoothly between the embed's progress events, held at the duration; a drag's
 * angle is taken at once, its lift eased.
 */
export function turntableRestFor(
  rig: Rig<VinylModel>,
  view: SceneView,
  dtS: number,
  nowMs: number,
): ArmPose {
  const arm = rig.toneArm;
  const position = rig.playhead.read(view, nowMs);
  const target = turntableArm(
    {
      seated: rig.shelf.spindle !== null,
      status: view.status,
      stopped: view.stopped,
      groove: directorAngle(arm, grooveAngle(arm, grooveShare(position, view.durationMs))),
      drag: rig.armDrag === null ? null : directorAngle(arm, rig.armDrag),
    },
    rig.last,
  );
  const from = { armAngle: rig.last.armAngle, armLift: rig.last.armLift ?? 0, spin: rig.last.spin };
  return easeArm(from, target, dtS, rig.armDrag !== null);
}

/**
 * The time a model's LED ring shows: an arm drag's target while one goes on; else a turntable's
 * position as it plays, carried on frame by frame; else a CD player's (its knob turn's target).
 */
export function ringTargetMs(rig: Rig, view: PlayheadView, nowMs: number): number {
  if (rig.dragMs !== null) return rig.dragMs;
  if (rig.toneArm) return rig.playhead.read(view, nowMs);
  return scrubTargetMs(view.positionMs, view.durationMs, rig.scrubMs);
}
