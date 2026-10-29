import {
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type Mesh,
  type MeshPhysicalMaterial,
  type Object3D,
} from 'three';
import type { CasePose, DiscPose, Pose, SwapKind } from './director';
import type { PlayerModel } from './model';

/** Where a disc sits inside a case, in the case's space (Blender's (3, 0, 6) mm, Y-up). */
const DISC_IN_CASE = new Vector3(0.003, 0.006, 0);
/**
 * A case changing places flies out of the tray, across and away, shrinking to nothing (the next
 * one grows from a point the other way round), so it never cuts through the lid's walls or pops
 * in or out of view. It all follows |slide|, so the director's timeline stays as it is:
 * - up to CASE_RISE_SHARE it only lifts, out of the tray towards the visitor and past the lid's
 *   rim (26.5 mm above the lining, Blender's HL - 13.5) with room to spare; coming in, that last
 *   stretch only lowers it into the tray;
 * - from there it flies CASE_ACROSS_M across (by eye: on a phone it vanishes inside the view);
 * - from CASE_SHRINK_SHARE on it shrinks, to nothing at the end.
 */
const CASE_ACROSS_M = 0.16;
const CASE_LIFT_M = 0.034;
const CASE_RISE_SHARE = 0.12;
const CASE_SHRINK_SHARE = 0.3;
/**
 * The case's own lid opening, about its hinge (Blender's Y, three's Z): positive swings it out of
 * the tray, toward the visitor (checked against cd-player.glb).
 */
const CASE_OPEN_RAD = (105 * Math.PI) / 180;
/** From this share of the way out (a case's slide, a disc's way into a hidden case) it is hidden. */
const HIDDEN_FROM = 0.999;
const ARM_LIFT_M = 0.006;
const RISE_M = 0.035;
const ARC_M = 0.09;
const SPIN_RAD_S = (200 / 60) * 2 * Math.PI;
const UP = new Vector3(0, 1, 0);

export interface DiscInstance {
  object: Object3D;
  label: MeshPhysicalMaterial;
}

export interface CaseInstance {
  object: Object3D;
  lid: Object3D;
  lidBaseZ: number;
  booklet: MeshPhysicalMaterial;
  seat: Vector3;
  /** Out of the tray, towards the visitor: the case's own up, in the lid's space. */
  out: Vector3;
}

export interface Rig {
  model: PlayerModel;
  /** Disc `i` belongs to case `i`. */
  discs: [DiscInstance, DiscInstance];
  cases: [CaseInstance, CaseInstance];
  /** The case shown in the lid. */
  lidCase: 0 | 1;
  /** The disc on the spindle; null before the first play. */
  seated: 0 | 1 | null;
  /** A change is running: the textures hook leaves the lid alone. */
  swapping: boolean;
  spin: number;
  arm: { node: Object3D; baseRotationY: number; baseY: number };
  seat: { position: Vector3; quaternion: Quaternion };
}

/** Gives every mesh under `root` that wears `name` its own copy, so two instances print differently. */
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

function caseInstance(object: Object3D): CaseInstance {
  const lid = object.getObjectByName('case_lid_hinge');
  if (!lid) throw new Error('a case without case_lid_hinge');
  return {
    object,
    lid,
    lidBaseZ: lid.rotation.z,
    booklet: ownMaterial(object, 'art_booklet'),
    seat: object.position.clone(),
    out: new Vector3(0, 1, 0).applyQuaternion(object.quaternion),
  };
}

const rigs = new WeakMap<PlayerModel, Rig>();

/** One rig per model (StrictMode renders twice; building it twice would clone twice). */
export function rigFor(model: PlayerModel): Rig {
  const existing = rigs.get(model);
  if (existing) return existing;
  const { nodes, root } = model;
  root.updateMatrixWorld(true);
  const seatPosition = new Vector3();
  const seatQuaternion = new Quaternion();
  nodes.disc_seat.matrixWorld.decompose(seatPosition, seatQuaternion, new Vector3());
  // Discs fly in world space, so both live at the root (at the origin, unrotated).
  const discA = nodes.disc;
  root.attach(discA);
  const labelA = ownMaterial(discA, 'art_disc');
  const discB = discA.clone(true);
  root.add(discB);
  const labelB = ownMaterial(discB, 'art_disc');
  const caseA = nodes.case;
  const caseB = caseA.clone(true);
  caseA.parent?.add(caseB);
  const rig: Rig = {
    model,
    discs: [
      { object: discA, label: labelA },
      { object: discB, label: labelB },
    ],
    cases: [caseInstance(caseA), caseInstance(caseB)],
    lidCase: 0,
    seated: null,
    swapping: false,
    spin: 0,
    arm: {
      node: nodes.arm_pivot,
      baseRotationY: nodes.arm_pivot.rotation.y,
      baseY: nodes.arm_pivot.position.y,
    },
    seat: { position: seatPosition, quaternion: seatQuaternion },
  };
  // The model's own dispose knows only its shared materials: the copies go with it.
  const prints = [labelA, labelB, rig.cases[0].booklet, rig.cases[1].booklet];
  const disposeModel = model.dispose;
  model.dispose = () => {
    disposeModel();
    for (const material of prints) material.dispose();
  };
  rigs.set(model, rig);
  return rig;
}

function placeCase(item: CaseInstance, pose: CasePose | null): void {
  const away = pose ? Math.abs(pose.slide) : 1;
  if (!pose || away >= HIDDEN_FROM) {
    item.object.visible = false;
    return;
  }
  item.object.visible = true;
  const lift = MathUtils.smoothstep(away, 0, CASE_RISE_SHARE);
  const across = MathUtils.smoothstep(away, CASE_RISE_SHARE, 1);
  item.object.position.copy(item.seat).addScaledVector(item.out, lift * CASE_LIFT_M);
  item.object.position.x += Math.sign(pose.slide) * across * CASE_ACROSS_M;
  // Never quite 0: a zero scale leaves no rotation for the disc inside to take.
  const size = 1 - MathUtils.smoothstep(away, CASE_SHRINK_SHARE, 1);
  item.object.scale.setScalar(Math.max(size, 1e-3));
  item.lid.rotation.z = item.lidBaseZ + pose.open * CASE_OPEN_RAD;
}

const inCase = new Matrix4();
const offset = new Matrix4().makeTranslation(DISC_IN_CASE.x, DISC_IN_CASE.y, DISC_IN_CASE.z);
const casePosition = new Vector3();
const caseQuaternion = new Quaternion();
const caseScale = new Vector3();
const start = new Vector3();
const control = new Vector3();
const spinQuaternion = new Quaternion();

function placeDisc(rig: Rig, disc: DiscInstance, owner: CaseInstance, pose: DiscPose | null): void {
  if (!pose || (pose.along >= HIDDEN_FROM && !owner.object.visible)) {
    disc.object.visible = false;
    return;
  }
  disc.object.visible = true;
  owner.object.updateWorldMatrix(true, false);
  inCase
    .multiplyMatrices(owner.object.matrixWorld, offset)
    .decompose(casePosition, caseQuaternion, caseScale);
  start.copy(rig.seat.position).addScaledVector(UP, RISE_M * pose.rise);
  const a = Math.min(1, Math.max(0, pose.along));
  // In its case a disc takes the case's size, so a case flying off takes its disc with it.
  disc.object.scale.setScalar(1 + (caseScale.x - 1) * a);
  if (a <= 0) {
    disc.object.position.copy(start);
  } else {
    control.copy(start).add(casePosition).multiplyScalar(0.5).addScaledVector(UP, ARC_M);
    // Quadratic Bézier start → control → the slot in the case.
    const b0 = (1 - a) * (1 - a);
    const b1 = 2 * (1 - a) * a;
    const b2 = a * a;
    disc.object.position.set(
      start.x * b0 + control.x * b1 + casePosition.x * b2,
      start.y * b0 + control.y * b1 + casePosition.y * b2,
      start.z * b0 + control.z * b1 + casePosition.z * b2,
    );
  }
  spinQuaternion.setFromAxisAngle(UP, rig.spin);
  disc.object.quaternion
    .copy(rig.seat.quaternion)
    .multiply(spinQuaternion)
    .slerp(caseQuaternion, a);
}

/** Puts every moving part where `pose` says. `swap` is null between changes. */
export function applyPose(rig: Rig, pose: Pose, swap: SwapKind | null, dt: number): void {
  rig.arm.node.rotation.y = rig.arm.baseRotationY + pose.armAngle;
  rig.arm.node.position.y = rig.arm.baseY + pose.armLift * ARM_LIFT_M;
  rig.spin = (rig.spin + dt * SPIN_RAD_S * pose.spin) % (2 * Math.PI);
  const lid = rig.lidCase;
  const other: 0 | 1 = lid === 0 ? 1 : 0;
  if (swap === 'change') {
    placeCase(rig.cases[lid], pose.oldCase);
    placeCase(rig.cases[other], pose.newCase);
    placeDisc(rig, rig.discs[lid], rig.cases[lid], pose.oldDisc);
    placeDisc(rig, rig.discs[other], rig.cases[other], pose.newDisc);
    return;
  }
  placeCase(rig.cases[lid], pose.newCase);
  placeCase(rig.cases[other], null);
  placeDisc(rig, rig.discs[lid], rig.cases[lid], pose.newDisc);
  placeDisc(rig, rig.discs[other], rig.cases[other], null);
}

/** What a change leaves behind on the rig. */
export type ChangeState = Pick<Rig, 'lidCase' | 'seated' | 'swapping'>;

/** After a change, the new case is the lid's and its disc is on the spindle. */
export function finishSwap(rig: ChangeState, kind: SwapKind): void {
  if (kind === 'change') rig.lidCase = rig.lidCase === 0 ? 1 : 0;
  rig.seated = rig.lidCase;
  rig.swapping = false;
}
