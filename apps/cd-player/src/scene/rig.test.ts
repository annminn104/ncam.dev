import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  Texture,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_VIEW, type SceneView, type TrackView } from '../bridge';
import type { Status } from '../playback/sequencer';
import { fakeTurntable, TEST_TURNTABLE } from '../testing/fake-turntable';
import {
  BOXES,
  CLEAR_SEAT,
  CLEAR_SHELL,
  CLEAR_STAND,
  DECK_CASE,
  DECK_CHASSIS,
  DECK_DOOR,
  DECK_SCREEN,
  DECK_SEAT,
  DECK_WELL,
  LUXE_ARM,
  LUXE_BAR,
  LUXE_LEDGE,
  LUXE_PANELS,
  LUXE_PLATTER,
  LUXE_PLINTH,
  LUXE_RECORD,
  LUXE_SEAT,
  LUXE_SLEEVE,
  LUXE_STAND,
  LUXE_STEPS,
  clearSlot,
  deckSlot,
  luxeSlot,
} from '../testing/model-measures';
import type { RequiredNode } from './contract';
import {
  ARM_PLAY,
  ARM_REST,
  FLIP_EDGE_MS,
  planChange,
  posePlan,
  restingArm,
  restingPose,
  type DiscPose,
  type Pose,
} from './director';
import type { Slots } from './materials';
import type { CdModel, VinylModel } from './model';
import { SCENE_PROFILES } from './profiles';
import {
  applyPose,
  armAngleFor,
  doorAxis,
  isCdRig,
  isTurntableRig,
  rigFor,
  ringTargetMs,
  spinSense,
  turnDoor,
  turntableRestFor,
  type DiscCopy,
  type Rig,
} from './rig';
import {
  DISC_COPIES,
  RACK_SLOTS,
  classifyChange,
  emptyShelf,
  fillShelf,
  lineupOf,
  targetOf,
  type Lineup,
} from './stage';

function named<T extends Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

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

/** The jewel case of cd-player.glb: 142 × 125 mm, 10.4 mm deep, its base on its origin. */
const CASE_W = 0.142;
const CASE_DEEP = 0.0104;
const CASE_H = 0.125;

/**
 * The nodes the rig moves, placed as in cd-player.glb: the disc and its seat on the spindle; the
 * case (with its lid and booklet), its seat and the rack's five slots in the open lid.
 */
function fakeModel() {
  const label = new MeshPhysicalMaterial({ name: 'art_disc' });
  const booklet = new MeshPhysicalMaterial({ name: 'art_booklet' });
  const disc = named(new Group(), 'disc');
  disc.position.set(-0.048, 0.0745, -0.002);
  disc.rotation.y = (-25 * Math.PI) / 180;
  disc.add(new Mesh(new BoxGeometry(0.12, 0.0012, 0.12), label));
  const seat = named(new Object3D(), 'disc_seat');
  seat.position.copy(disc.position);
  seat.quaternion.copy(disc.quaternion);
  const shell = new Mesh(
    new BoxGeometry(CASE_W, CASE_DEEP, CASE_H).translate(0, CASE_DEEP / 2, 0),
    new MeshPhysicalMaterial({ name: 'crystal' }),
  );
  const page = new Mesh(new BoxGeometry(0.12, 0.0005, 0.12), booklet);
  page.position.set(0.071, 0.002, 0);
  const caseLid = named(new Group(), 'case_lid_hinge');
  caseLid.position.set(-0.071, 0.0066, 0);
  caseLid.add(page);
  const jewelCase = named(new Group(), 'case');
  jewelCase.position.set(-0.06, 0.0265, 0.118);
  jewelCase.rotation.x = Math.PI;
  jewelCase.add(shell, caseLid);
  const caseSeat = named(new Object3D(), 'case_seat');
  caseSeat.position.copy(jewelCase.position);
  caseSeat.quaternion.copy(jewelCase.quaternion);
  const lid = named(new Group(), 'lid_hinge');
  lid.position.set(0, 0.084, -0.118);
  lid.rotation.x = (-100 * Math.PI) / 180;
  lid.add(jewelCase, caseSeat);
  const nodes: Partial<Record<RequiredNode, Object3D>> = {
    disc,
    disc_seat: seat,
    case: jewelCase,
    case_lid_hinge: caseLid,
    case_seat: caseSeat,
    lid_hinge: lid,
  };
  const slots: Object3D[] = [];
  for (let slot = 0; slot < RACK_SLOTS; slot++) {
    // In the right of the lid, facing out of it like the case: slot 0 the lowest (nearest the
    // hinge) and the frontmost, each slot above it 20 mm higher, 1.6 mm nearer the lining (the
    // lining is at y = 0.0265, the lid opens towards -y) and leaning out 1.5° less.
    const empty = named(new Object3D(), `rack_slot_${slot}`);
    empty.position.set(0.07, 0.0165 + 0.0016 * slot, 0.07 + 0.02 * slot);
    empty.rotation.set(Math.PI + ((6 - 1.5 * slot) * Math.PI) / 180, 0, 0);
    lid.add(empty);
    slots.push(empty);
    nodes[`rack_slot_${slot}` as RequiredNode] = empty;
  }
  const arm = named(new Object3D(), 'arm_pivot');
  nodes.arm_pivot = arm;
  const player = named(new Group(), 'player');
  player.add(disc, seat, lid, arm);
  const root = new Group();
  root.add(player);
  const dispose = vi.fn();
  const model: CdModel = {
    id: 'suitcase',
    media: 'cd',
    root,
    nodes: nodes as Record<RequiredNode, Object3D>,
    slots: {} as Slots,
    optionalSlots: {},
    dispose,
    applyLook: vi.fn(),
  };
  return { model, label, booklet, dispose, slots, lid, caseSeat };
}

/** A pose with nothing shown but copy `disc`, posed `pose`. */
function only(disc: number, pose: DiscPose): Pose {
  const rest = restingPose(emptyShelf(), false, false);
  return { ...rest, discs: rest.discs.map((_, index) => (index === disc ? pose : null)) };
}

/** The corners of the case's own box, in world space. */
function caseCorners(object: Object3D): Vector3[] {
  const corners: Vector3[] = [];
  for (const x of [-CASE_W / 2, CASE_W / 2]) {
    for (const y of [0, CASE_DEEP]) {
      for (const z of [-CASE_H / 2, CASE_H / 2]) {
        corners.push(object.localToWorld(new Vector3(x, y, z)));
      }
    }
  }
  return corners;
}

/** A CD player's rig's jewel case, which it always has. */
const jewelCase = (rig: Rig) => {
  if (!rig.case) throw new Error('no case');
  return rig.case;
};

describe('rigFor', () => {
  it('gives the seven discs and the booklet prints of their own, and disposes them with the model', () => {
    const { model, label, booklet, dispose } = fakeModel();
    const rig = rigFor(model);
    const prints = [...rig.discs.map((disc) => disc.label), jewelCase(rig).booklet];
    expect(rig.discs).toHaveLength(DISC_COPIES);
    expect(new Set(prints).size).toBe(DISC_COPIES + 1);
    expect(prints).not.toContain(label);
    expect(prints).not.toContain(booklet);
    const disposed = prints.map((material) => vi.spyOn(material, 'dispose'));
    model.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    for (const spy of disposed) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('builds one rig per model, so a second render clones nothing more', () => {
    const { model } = fakeModel();
    expect(rigFor(model)).toBe(rigFor(model));
    let discs = 0;
    model.root.traverse((object) => {
      if (object.name === 'disc') discs += 1;
    });
    expect(discs).toBe(DISC_COPIES);
  });

  it('reads the spindle’s seat and the five slots from the model, and measures the case’s turn', () => {
    const { model, slots } = fakeModel();
    const rig = rigFor(model);
    expect(rig.slots).toHaveLength(RACK_SLOTS);
    rig.slots.forEach((frame, slot) => {
      const world = slots[slot].getWorldPosition(new Vector3());
      expect(frame.position.distanceTo(world)).toBeLessThan(1e-9);
      expect(frame.out.length()).toBeCloseTo(1);
    });
    expect(rig.seat.quaternion.angleTo(model.nodes.disc_seat.quaternion)).toBeLessThan(1e-6);
    // The reach of its half-width and depth across the turn, and a centimetre.
    expect(jewelCase(rig).lift).toBeCloseTo(Math.hypot(CASE_W / 2, CASE_DEEP) + 0.01, 6);
  });
});

describe('armAngleFor', () => {
  it('is the director’s own angle for the suitcase', () => {
    for (const angle of [ARM_REST, -0.2, ARM_PLAY])
      expect(armAngleFor(SCENE_PROFILES.suitcase.arm, angle)).toBeCloseTo(angle, 12);
  });

  it('is the identity only while the suitcase’s profile arm agrees with the director’s', () => {
    expect(SCENE_PROFILES.suitcase.arm).toEqual({ rest: ARM_REST, play: ARM_PLAY });
  });

  it('maps the director’s rest and play to the Clear model’s own', () => {
    expect(armAngleFor(SCENE_PROFILES.clear.arm, ARM_REST)).toBeCloseTo(0, 12);
    expect(armAngleFor(SCENE_PROFILES.clear.arm, ARM_PLAY)).toBeCloseTo(0.52, 12);
    expect(armAngleFor(SCENE_PROFILES.clear.arm, ARM_PLAY / 2)).toBeCloseTo(0.26, 12);
  });
});

describe('the door', () => {
  /** The fake model as the Clear: its id, and a hinge turned a little at rest. */
  function clearModel() {
    const { model } = fakeModel();
    const hinge = named(new Object3D(), 'door_hinge');
    hinge.rotation.y = 0.1;
    model.root.add(hinge);
    const clear: CdModel = {
      ...model,
      id: 'clear',
      nodes: { ...model.nodes, door_hinge: hinge },
    };
    return { model: clear, hinge };
  }

  it('is the hinge of a model whose profile has a door, with the turn that opens it', () => {
    const { model, hinge } = clearModel();
    expect(rigFor(model).door).toEqual({
      node: hinge,
      base: 0.1,
      angle: -(100 * Math.PI) / 180,
      axis: 'y',
    });
  });

  it('is the Deck’s jog plate: a hinge lifted about X, its shut turn kept', () => {
    const { model } = fakeModel();
    const hinge = named(new Object3D(), 'door_hinge');
    hinge.rotation.x = 0.1;
    model.root.add(hinge);
    const deck: CdModel = {
      ...model,
      id: 'deck',
      nodes: { ...model.nodes, door_hinge: hinge },
    };
    const rig = rigFor(deck);
    const { angle } = SCENE_PROFILES.deck.door!;
    expect(rig.door).toEqual({ node: hinge, base: 0.1, angle, axis: 'x' });
    const rest = restingPose(emptyShelf(), false, false);
    applyPose(rig, { ...rest, door: 1 }, 0);
    expect(hinge.rotation.x).toBeCloseTo(0.1 + angle, 12);
    expect(hinge.rotation.y).toBe(0);
  });

  it('is none for a model without one, hinge or no hinge', () => {
    expect(rigFor(fakeModel().model).door).toBeNull();
    const { model } = clearModel();
    expect(rigFor({ ...model, id: 'suitcase' }).door).toBeNull();
  });

  it('turns the hinge from its shut angle to the open one as the pose opens it', () => {
    const { model, hinge } = clearModel();
    const rig = rigFor(model);
    const rest = restingPose(emptyShelf(), false, false);
    applyPose(rig, { ...rest, door: 0 }, 0);
    expect(hinge.rotation.y).toBeCloseTo(0.1, 12);
    applyPose(rig, { ...rest, door: 1 }, 0);
    expect(hinge.rotation.y).toBeCloseTo(0.1 - (100 * Math.PI) / 180, 12);
    applyPose(rig, { ...rest, door: 0.5 }, 0);
    expect(hinge.rotation.y).toBeCloseTo(0.1 - (50 * Math.PI) / 180, 12);
  });

  it('turns about Y unless the profile names X', () => {
    expect(doorAxis({})).toBe('y');
    expect(doorAxis({ axis: 'y' })).toBe('y');
    expect(doorAxis({ axis: 'x' })).toBe('x');
  });

  it('turns a hinge about X from its shut angle, leaving its Y alone', () => {
    const node = new Object3D();
    node.rotation.set(0.2, 0.3, 0);
    turnDoor({ node, base: 0.2, angle: 1.2, axis: 'x' }, 0.5);
    expect(node.rotation.x).toBeCloseTo(0.8, 12);
    expect(node.rotation.y).toBeCloseTo(0.3, 12);
  });

  it('notes how far the door stands open after each pose, 0 for a model without one', () => {
    const { model } = clearModel();
    const rig = rigFor(model);
    const rest = restingPose(emptyShelf(), false, false);
    expect(rig.doorOpen).toBe(0);
    applyPose(rig, { ...rest, door: 0.5 }, 0);
    expect(rig.doorOpen).toBe(0.5);
    const plain = rigFor(fakeModel().model);
    applyPose(plain, { ...rest, door: 0.5 }, 0);
    expect(plain.doorOpen).toBe(0);
  });
});

describe('applyPose', () => {
  it('turns the disc on the spindle by the knob’s turn on top of its spin', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f')));
    rig.knobTurn = 0.3;
    applyPose(rig, restingPose(shelf, true, false), 0);
    const expected = rig.seat.quaternion
      .clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rig.spin + 0.3));
    expect(rig.discs[0].object.quaternion.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('starts with no turn and no preview', () => {
    const rig = rigFor(fakeModel().model);
    expect(rig.knobTurn).toBe(0);
    expect(rig.scrubMs).toBeNull();
  });

  it('rests each copy where the shelf puts it, and hides the spare', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f')));
    applyPose(rig, restingPose(shelf, true, false), 0);
    const spindle = rig.discs[0].object;
    expect(spindle.visible).toBe(true);
    expect(spindle.position.distanceTo(rig.seat.position)).toBeLessThan(1e-9);
    expect(spindle.quaternion.angleTo(rig.seat.quaternion)).toBeLessThan(1e-6);
    for (let slot = 0; slot < RACK_SLOTS; slot++) {
      const copy = rig.discs[slot + 1].object;
      expect(copy.visible).toBe(true);
      expect(copy.position.distanceTo(rig.slots[slot].position)).toBeLessThan(1e-9);
      expect(copy.quaternion.angleTo(rig.slots[slot].quaternion)).toBeLessThan(1e-6);
      expect(copy.scale.x).toBe(1);
    }
    expect(rig.discs[6].object.visible).toBe(false);
    expect(rig.last).toEqual({ armAngle: ARM_PLAY, spin: 0, armLift: 0 });
  });

  it('flies a disc from its slot onto the spindle, leaving and landing along each normal', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    const disc = rig.discs[1].object;
    const pose = (along: number) => only(1, { from: 0, to: 'spindle', along });
    applyPose(rig, pose(0), 0);
    expect(disc.position.distanceTo(rig.slots[0].position)).toBeLessThan(1e-9);
    applyPose(rig, pose(0.05), 0);
    expect(disc.position.clone().sub(rig.slots[0].position).dot(rig.slots[0].out)).toBeGreaterThan(
      0,
    );
    applyPose(rig, pose(0.95), 0);
    expect(disc.position.y).toBeGreaterThan(rig.seat.position.y);
    applyPose(rig, pose(1), 0);
    expect(disc.position.distanceTo(rig.seat.position)).toBeLessThan(1e-9);
    expect(disc.quaternion.angleTo(rig.seat.quaternion)).toBeLessThan(1e-6);
    expect(disc.scale.x).toBe(1);
  });

  it('shrinks a disc leaving the spindle away to the left', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    const leaving = rig.discs[0].object;
    let size = 1;
    let x = Infinity;
    for (let step = 0; step <= 20; step++) {
      applyPose(rig, only(0, { from: 'spindle', to: null, along: step / 20 }), 0);
      if (!leaving.visible) break;
      expect(leaving.scale.x).toBeLessThanOrEqual(size + 1e-9);
      expect(leaving.position.x).toBeLessThanOrEqual(x + 1e-9);
      size = leaving.scale.x;
      x = leaving.position.x;
    }
    expect(leaving.visible).toBe(false);
  });

  it('shrinks and grows a rack disc where it stands, never out through the discs in front', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    const leaving = rig.discs[3].object;
    const arriving = rig.discs[6].object;
    let size = 1;
    for (let step = 0; step < 20; step++) {
      applyPose(rig, only(3, { from: 2, to: null, along: step / 20 }), 0);
      expect(leaving.position.distanceTo(rig.slots[2].position)).toBeLessThan(1e-9);
      expect(leaving.scale.x).toBeLessThanOrEqual(size + 1e-9);
      size = leaving.scale.x;
    }
    applyPose(rig, only(3, { from: 2, to: null, along: 1 }), 0);
    expect(leaving.visible).toBe(false);
    size = 0;
    for (let step = 1; step <= 20; step++) {
      applyPose(rig, only(6, { from: null, to: 4, along: step / 20 }), 0);
      expect(arriving.visible).toBe(true);
      expect(arriving.position.distanceTo(rig.slots[4].position)).toBeLessThan(1e-9);
      expect(arriving.quaternion.angleTo(rig.slots[4].quaternion)).toBeLessThan(1e-6);
      expect(arriving.scale.x).toBeGreaterThanOrEqual(size - 1e-9);
      size = arriving.scale.x;
    }
    expect(arriving.scale.x).toBe(1);
  });

  it('moves a disc between two slots in a straight line', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    const disc = rig.discs[2].object;
    const from = rig.slots[1].position;
    const to = rig.slots[0].position;
    const line = to.clone().sub(from).normalize();
    for (const along of [0.1, 0.5, 0.9]) {
      applyPose(rig, only(2, { from: 1, to: 0, along }), 0);
      const offset = disc.position.clone().sub(from);
      // No part of its way leaves the line from one slot to the other.
      expect(
        offset
          .clone()
          .sub(line.clone().multiplyScalar(offset.dot(line)))
          .length(),
      ).toBeLessThan(1e-9);
      expect(offset.dot(line)).toBeGreaterThan(0);
      expect(offset.dot(line)).toBeLessThan(to.distanceTo(from));
      expect(disc.scale.x).toBe(1);
    }
  });

  it('reaches each way out of the spindle along its seat’s own normal', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    // The suitcase's seat turns only about the vertical: its normal is straight up.
    expect(rig.seat.out.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12);
    expect(rig.flight.reach).toEqual({
      ...SCENE_PROFILES.suitcase.flight.reach,
      ledge: SCENE_PROFILES.suitcase.flight.reach.spindle,
    });
    expect(rig.flight.aside.toArray()).toEqual(SCENE_PROFILES.suitcase.flight.aside);
  });

  it('lifts the case clear of the lid before it turns over, and swaps the booklet as it passes edge-on', () => {
    const { model, lid, caseSeat } = fakeModel();
    const rig = rigFor(model);
    const front = new Texture();
    const back = new Texture();
    rig.bookletMaps = [front, back];
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f')));
    const after = lineup('b', 'c', 'd', 'e', 'f', 'g');
    const change = classifyChange(lineupOf(shelf), after, track('b'));
    const plan = planChange(change, shelf, targetOf(after, track('b')), {
      armAngle: ARM_PLAY,
      spin: 1,
    });
    const flip = plan.flip!;
    const seat = lid.localToWorld(caseSeat.position.clone());
    const normal = jewelCase(rig).out.clone().transformDirection(lid.matrixWorld);
    for (let t = flip.start; t <= flip.end; t += 10) {
      applyPose(rig, posePlan(plan, t, restingArm(true, true, true)), 0);
      jewelCase(rig).object.updateMatrixWorld(true);
      for (const corner of caseCorners(jewelCase(rig).object)) {
        expect(corner.sub(seat).dot(normal), `t ${t}`).toBeGreaterThan(-1e-6);
      }
      expect(jewelCase(rig).booklet.map, `t ${t}`).toBe(
        t >= flip.start + FLIP_EDGE_MS ? back : front,
      );
    }
    // Back at rest the case sits in its seat again.
    applyPose(rig, restingPose(plan.after, true, true), 0);
    expect(jewelCase(rig).object.position.distanceTo(jewelCase(rig).seat)).toBeLessThan(1e-9);
  });
});

describe('the Clear model’s flights', () => {
  /**
   * The fake model posed as cd-player-clear.glb: the spindle's seat upright behind the door (its
   * normal +z), the stand's hinge right of the shell turned 18° toward it, and the five slots in it,
   * each 20 mm above and 18 mm behind the one below it and leaning back 15°. Measured with three's
   * GLTFLoader over the GLB, which model-contract.test.ts holds to them
   * (src/testing/model-measures.ts).
   */
  function clearSet() {
    const { model, slots, lid } = fakeModel();
    const { disc, disc_seat: seat } = model.nodes;
    seat.position.set(...CLEAR_SEAT.position);
    seat.rotation.set(CLEAR_SEAT.rotationX, 0, 0);
    disc.position.copy(seat.position);
    disc.quaternion.copy(seat.quaternion);
    lid.position.set(...CLEAR_STAND.position);
    lid.rotation.set(0, CLEAR_STAND.rotationY, 0);
    slots.forEach((slot, k) => {
      const { position, rotationX } = clearSlot(k);
      slot.position.set(...position);
      slot.rotation.set(rotationX, 0, 0);
    });
    const clear: CdModel = { ...model, id: 'clear' };
    return rigFor(clear);
  }

  /**
   * Where a point would stand inside the Clear shell's walls (cd-player-clear.glb, metres): its
   * outline with round corners, the front plate but for the opening the disc passes through, the
   * back plate, and the band round the sides, the top and the bottom between them (`CLEAR_SHELL`).
   */
  function inShell(p: Vector3): string | null {
    const { halfWidth, bottom, top, corner, band, front, back, opening } = CLEAR_SHELL;
    const outline = (inset: number) => {
      const halfW = halfWidth - inset;
      const low = bottom + inset;
      const high = top - inset;
      const r = corner - inset;
      if (Math.abs(p.x) > halfW || p.y < low || p.y > high) return false;
      const cx = Math.min(Math.max(p.x, -halfW + r), halfW - r);
      const cy = Math.min(Math.max(p.y, low + r), high - r);
      return Math.hypot(p.x - cx, p.y - cy) <= r;
    };
    if (!outline(0)) return null;
    if (p.z >= front[0] && p.z <= front[1]) {
      return Math.hypot(p.x, p.y - opening.y) > opening.radius ? 'front plate' : null;
    }
    if (p.z <= back[1] && p.z >= back[0]) return 'back plate';
    if (p.z > back[1] && p.z < front[0] && !outline(band)) return 'band';
    return null;
  }

  /** Every point of a disc copy's rim (Ø 120 mm) that stands in the shell's walls, as posed. */
  function rimInShell(object: Object3D): string[] {
    object.updateMatrixWorld(true);
    const hits: string[] = [];
    for (let k = 0; k < 96; k++) {
      const turn = (k / 96) * 2 * Math.PI;
      const rim = new Vector3(0.06 * Math.cos(turn), 0, 0.06 * Math.sin(turn));
      const wall = inShell(rim.applyMatrix4(object.matrixWorld));
      if (wall) hits.push(wall);
    }
    return hits;
  }

  it('reaches the spindle in through the door, along its seat’s normal', () => {
    const rig = clearSet();
    expect(rig.seat.out.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-12);
    const disc = rig.discs[1].object;
    // Close to landing it comes in square to the window, from in front of it.
    applyPose(rig, only(1, { from: 0, to: 'spindle', along: 0.95 }), 0);
    const offset = disc.position.clone().sub(rig.seat.position);
    expect(offset.dot(rig.seat.out)).toBeGreaterThan(0);
    expect(Math.hypot(offset.x, offset.y)).toBeLessThan(0.004);
  });

  it('leaves the Clear’s slots their own normals', () => {
    const rig = clearSet();
    for (const slot of rig.slots) {
      expect(
        slot.out.distanceTo(new Vector3(0, 1, 0).applyQuaternion(slot.quaternion)),
      ).toBeLessThan(1e-12);
    }
  });

  it('flies every way to and from the spindle through the door’s opening, never through the shell', () => {
    const rig = clearSet();
    const ways: [string, DiscPose['from'], DiscPose['to']][] = [
      ...[0, 1, 2, 3, 4].map((slot): [string, DiscPose['from'], DiscPose['to']] => [
        `slot ${slot} onto the spindle`,
        slot,
        'spindle',
      ]),
      ['the spindle back into slot 0', 'spindle', 0],
      ['the spindle out of sight', 'spindle', null],
      ['out of sight onto the spindle', null, 'spindle'],
    ];
    for (const [way, from, to] of ways) {
      for (let step = 0; step <= 200; step++) {
        const along = step / 200;
        applyPose(rig, only(1, { from, to, along }), 0);
        const disc = rig.discs[1].object;
        if (!disc.visible) continue;
        expect(rimInShell(disc), `${way}, along ${along}`).toEqual([]);
      }
    }
  });

  it('sends a disc leaving the spindle out of the door and to the right, away from its hinge', () => {
    const rig = clearSet();
    const leaving = rig.discs[0].object;
    applyPose(rig, only(0, { from: 'spindle', to: null, along: 0.3 }), 0);
    const offset = leaving.position.clone().sub(rig.seat.position);
    expect(offset.z).toBeGreaterThan(0.04);
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeGreaterThan(0);
  });
});

describe('the Deck’s flights', () => {
  /** Rim points of a disc copy (Ø 120 mm), and the obstacles' margin: a hair inside every box. */
  const RIM = 96;
  const HAIR = 1e-4;
  const [cx, , cz] = DECK_WELL.centre;

  /**
   * The flight case's base (art/blender/scripts/deck_case.py, in its own frame): 170 × 150 mm and
   * 120 mm tall from its 7 mm ball corners, open on top, its walls (3 mm of aluminium and the
   * angle extrusions over them) a few millimetres thick, its floor too. Its lid stands open past
   * upright behind it, out of the way; its foam block fills the base's lower part (to 112 mm), the
   * slots cut in it: the walls, the floor and the foam stop a disc, but for its slot's own column.
   */
  const BASE = { halfWidth: 0.085, halfDepth: 0.075, top: 0.127, floor: 0.01, wall: 0.006 };
  /** The foam's top (FC_FOAM_TOP, 112 mm): under it, outside a slot's slit, the base is solid. */
  const FOAM_TOP = 0.112;
  /** A slot's slit: 124 mm long (deck_case.py), so 62 mm each way of its middle. */
  const SLIT_HALF_LENGTH = 0.062;
  /** How far a disc may stray from its slot's plane inside the crate (metres): the slit's half thickness and a hair. */
  const COLUMN_PLAY = 0.003;

  /**
   * The fake model posed as cd-player-deck.glb: the spindle's seat at the well's centre, flat
   * (its normal up), the flight case's frame right of the deck turned 18° toward it, and its five
   * slots in that frame, every one turned a quarter about X so a disc stands up in it facing the
   * case's front. Measured with three's GLTFLoader, which model-contract.test.ts holds to them
   * (src/testing/model-measures.ts).
   */
  function deckSet() {
    const { model, slots, lid } = fakeModel();
    const { disc, disc_seat: seat } = model.nodes;
    seat.position.set(...DECK_SEAT.position);
    seat.quaternion.identity();
    disc.position.copy(seat.position);
    disc.quaternion.copy(seat.quaternion);
    lid.position.set(0.28, 0, -0.04);
    lid.rotation.set(0, DECK_CASE.turn, 0);
    slots.forEach((slot, k) => {
      const { position, rotationX } = deckSlot(k);
      slot.position.set(...position);
      slot.rotation.set(rotationX, 0, 0);
    });
    const deck: CdModel = { ...model, id: 'deck' };
    lid.updateMatrixWorld(true);
    return { rig: rigFor(deck), toCase: lid.matrixWorld.clone().invert() };
  }

  const inBox = (
    p: Vector3,
    box: { readonly min: readonly number[]; readonly max: readonly number[] },
  ) =>
    p.x > box.min[0] + HAIR &&
    p.x < box.max[0] - HAIR &&
    p.y > box.min[1] + HAIR &&
    p.y < box.max[1] - HAIR &&
    p.z > box.min[2] + HAIR &&
    p.z < box.max[2] - HAIR;

  /** The jog plate lifted by the profile's angle about its hinge's X: a point's place in its shut frame. */
  const hinge = new Vector3(...DECK_DOOR.hinge);
  const unlift = (p: Vector3, angle: number) =>
    p
      .clone()
      .sub(hinge)
      .applyAxisAngle(new Vector3(1, 0, 0), -angle)
      .add(hinge);

  /** What a point of a disc, as posed, stands in, if anything. */
  function obstacle(p: Vector3, toCase: Matrix4, doorAngle: number): string | null {
    const inWell =
      Math.hypot(p.x - cx, p.z - cz) <= DECK_WELL.radius && p.y >= DECK_WELL.floor - HAIR;
    if (inBox(p, DECK_CHASSIS) && !inWell) return 'the chassis';
    if (inBox(p, DECK_SCREEN)) return 'the screen';
    if (inBox(unlift(p, doorAngle), DECK_DOOR.shut)) return 'the lifted plate';
    const local = p.clone().applyMatrix4(toCase);
    const inner = {
      min: [-BASE.halfWidth + BASE.wall, BASE.floor, -BASE.halfDepth + BASE.wall],
      max: [BASE.halfWidth - BASE.wall, BASE.top, BASE.halfDepth - BASE.wall],
    };
    const outer = {
      min: [-BASE.halfWidth, 0, -BASE.halfDepth],
      max: [BASE.halfWidth, BASE.top, BASE.halfDepth],
    };
    if (inBox(local, outer)) {
      // The base's walls, floor and the foam under its rim, but for each slot's own column: a
      // prism of the disc's size (a hair of play) standing on the slot, in its plane, up from it.
      const column = [0, 1, 2, 3, 4].some((k) => {
        const { position } = deckSlot(k);
        return (
          Math.abs(local.z - position[2]) <= COLUMN_PLAY &&
          local.y >= position[1] - 0.06 &&
          Math.abs(local.x - position[0]) <= SLIT_HALF_LENGTH
        );
      });
      if (!column && (!inBox(local, inner) || local.y < FOAM_TOP)) return 'the case';
    }
    return null;
  }

  /** Every obstacle any rim point of a disc copy stands in, as posed. */
  function rimHits(object: Object3D, toCase: Matrix4, doorAngle: number): string[] {
    object.updateMatrixWorld(true);
    const hits = new Set<string>();
    for (let k = 0; k < RIM; k++) {
      const turn = (k / RIM) * 2 * Math.PI;
      const rim = new Vector3(0.06 * Math.cos(turn), 0, 0.06 * Math.sin(turn));
      const hit = obstacle(rim.applyMatrix4(object.matrixWorld), toCase, doorAngle);
      if (hit) hits.add(hit);
    }
    return [...hits];
  }

  it('keeps the case’s base inside the measured case', () => {
    expect(BASE.halfWidth).toBeLessThanOrEqual(DECK_CASE.max[0]);
    expect(-BASE.halfWidth).toBeGreaterThanOrEqual(DECK_CASE.min[0]);
    expect(BASE.halfDepth).toBeLessThanOrEqual(DECK_CASE.max[2]);
    expect(-BASE.halfDepth).toBeGreaterThanOrEqual(DECK_CASE.min[2]);
    expect(BASE.top).toBeLessThanOrEqual(DECK_CASE.max[1]);
  });

  it('lifts a disc out of and into a slot straight up, the suitcase’s and the Clear’s along the face', () => {
    const { rig } = deckSet();
    for (const slot of rig.slots) expect(slot.out.toArray()).toEqual([0, 1, 0]);
    expect(rig.seat.out.toArray()).toEqual([0, 1, 0]);
    const suitcase = rigFor(fakeModel().model);
    for (const slot of suitcase.slots) {
      expect(
        slot.out.distanceTo(new Vector3(0, 1, 0).applyQuaternion(slot.quaternion)),
      ).toBeLessThan(1e-12);
    }
    expect(SCENE_PROFILES.suitcase.flight.exit).toBeUndefined();
    expect(SCENE_PROFILES.clear.flight.exit).toBeUndefined();
    expect(SCENE_PROFILES.deck.flight.exit).toBe('up');
  });

  it('reaches the spindle from above, flat, along its seat’s normal', () => {
    const { rig } = deckSet();
    expect(rig.seat.out.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12);
    const disc = rig.discs[1].object;
    applyPose(rig, only(1, { from: 0, to: 'spindle', along: 0.95 }), 0);
    const offset = disc.position.clone().sub(rig.seat.position);
    expect(offset.dot(rig.seat.out)).toBeGreaterThan(0);
    expect(Math.hypot(offset.x, offset.z)).toBeLessThan(0.02);
  });

  it('flies every way between a slot and the spindle clear of the deck, its screen, the lifted plate and the case', () => {
    const { rig, toCase } = deckSet();
    const doorAngle = SCENE_PROFILES.deck.door!.angle;
    const ways: [string, DiscPose['from'], DiscPose['to']][] = [
      ...[0, 1, 2, 3, 4].flatMap((slot): [string, DiscPose['from'], DiscPose['to']][] => [
        [`slot ${slot} onto the spindle`, slot, 'spindle'],
        [`the spindle back into slot ${slot}`, 'spindle', slot],
      ]),
      ['the spindle out of sight', 'spindle', null],
      ['out of sight onto the spindle', null, 'spindle'],
    ];
    for (const [way, from, to] of ways) {
      for (let step = 0; step <= 200; step++) {
        const along = step / 200;
        applyPose(rig, only(1, { from, to, along }), 0);
        const disc = rig.discs[1].object;
        if (!disc.visible) continue;
        expect(rimHits(disc, toCase, doorAngle), `${way}, along ${along}`).toEqual([]);
      }
    }
  });
});

describe('a turntable’s rig', () => {
  it('carries the profile it is given, a CD player’s its own', () => {
    const rig = rigFor(fakeTurntable().model, TEST_TURNTABLE);
    expect(rig.profile).toBe(TEST_TURNTABLE);
    expect(rigFor(fakeModel().model).profile).toBe(SCENE_PROFILES.suitcase);
  });

  it('has no jewel case, and poses with none', () => {
    const rig = rigFor(fakeTurntable().model, TEST_TURNTABLE);
    expect(rig.case).toBeNull();
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c')));
    expect(() => applyPose(rig, restingPose(shelf, true, true), 1 / 60)).not.toThrow();
    expect(rig.discs[0].object.visible).toBe(true);
  });

  it('tells a turntable’s rig from a CD player’s', () => {
    const turntable = rigFor(fakeTurntable().model, TEST_TURNTABLE);
    const cd = rigFor(fakeModel().model);
    expect([isCdRig(cd), isTurntableRig(cd)]).toEqual([true, false]);
    expect([isCdRig(turntable), isTurntableRig(turntable)]).toEqual([false, true]);
  });
});

describe('a turntable’s sleeves', () => {
  const sleeveOf = (copy: DiscCopy) => {
    if (!copy.sleeve) throw new Error('no sleeve');
    return copy.sleeve;
  };
  function turntable() {
    const parts = fakeTurntable();
    const rig = rigFor(parts.model, TEST_TURNTABLE);
    if (!rig.sleeveSeat) throw new Error('no ledge');
    return { ...parts, rig, ledge: rig.sleeveSeat };
  }

  it('gives each of the seven records a sleeve with a print of its own, disposed with the model', () => {
    const { rig, model, print, disposed } = turntable();
    const prints = rig.discs.map((copy) => sleeveOf(copy).print);
    expect(new Set(prints).size).toBe(DISC_COPIES);
    expect(prints).not.toContain(print);
    const spies = prints.map((material) => vi.spyOn(material, 'dispose'));
    model.dispose();
    expect(disposed()).toBe(1);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('gives a CD player’s discs none, and no ledge', () => {
    const rig = rigFor(fakeModel().model);
    expect(rig.discs.every((copy) => copy.sleeve === null)).toBe(true);
    expect(rig.sleeveSeat).toBeNull();
  });

  it('stands the ledge where the GLB has it, a sleeve coming down onto it from above', () => {
    const { rig, sleeveSeat, ledge } = turntable();
    expect(ledge.position.distanceTo(sleeveSeat.getWorldPosition(new Vector3()))).toBeLessThan(
      1e-9,
    );
    expect(ledge.out.toArray()).toEqual([0, 1, 0]);
    expect(rig.flight.reach.ledge).toBe(0.3);
  });

  it('rests the record on the platter and its sleeve on the ledge, and a rack record in its sleeve', () => {
    const { rig, ledge } = turntable();
    applyPose(rig, restingPose(fillShelf(targetOf(lineup('a', 'b'))), true, false), 0);
    const [playing, next] = rig.discs;
    expect(playing.object.position.distanceTo(rig.seat.position)).toBeLessThan(1e-9);
    expect(sleeveOf(playing).object.position.distanceTo(ledge.position)).toBeLessThan(1e-9);
    expect(sleeveOf(playing).object.quaternion.angleTo(ledge.quaternion)).toBeLessThan(1e-6);
    expect(next.object.position.distanceTo(rig.slots[0].position)).toBeLessThan(1e-9);
    expect(sleeveOf(next).object.position.distanceTo(next.object.position)).toBeLessThan(1e-9);
    expect(sleeveOf(next).object.quaternion.angleTo(next.object.quaternion)).toBeLessThan(1e-6);
  });

  it('turns the record with the platter, and never its sleeve', () => {
    const { rig, ledge } = turntable();
    applyPose(rig, restingPose(fillShelf(targetOf(lineup('a'))), true, true), 0.45);
    expect(rig.discs[0].object.quaternion.angleTo(rig.seat.quaternion)).toBeGreaterThan(1);
    expect(sleeveOf(rig.discs[0]).object.quaternion.angleTo(ledge.quaternion)).toBeLessThan(1e-6);
  });

  it('takes a record and its sleeve out of sight together, shrinking alike', () => {
    const { rig } = turntable();
    applyPose(rig, only(0, { from: 'spindle', to: null, along: 0.7 }), 0);
    const [copy] = rig.discs;
    expect(copy.object.visible).toBe(true);
    expect(sleeveOf(copy).object.visible).toBe(true);
    expect(sleeveOf(copy).object.scale.x).toBeCloseTo(copy.object.scale.x, 12);
    applyPose(rig, only(0, { from: 'spindle', to: null, along: 1 }), 0);
    expect(copy.object.visible).toBe(false);
    expect(sleeveOf(copy).object.visible).toBe(false);
  });

  it('flies a sleeve from its slot down onto the ledge from above as its record lands', () => {
    const { rig, ledge } = turntable();
    applyPose(rig, only(1, { from: 0, to: 'spindle', along: 0.95 }), 0);
    const offset = sleeveOf(rig.discs[1]).object.position.clone().sub(ledge.position);
    expect(offset.y).toBeGreaterThan(0);
    expect(Math.hypot(offset.x, offset.z)).toBeLessThan(0.02);
    const record = rig.discs[1].object.position.clone().sub(rig.seat.position);
    expect(record.dot(rig.seat.out)).toBeGreaterThan(0);
  });
});

describe('Luxe’s flights', () => {
  /** A hair inside every box: a point on a face is not in the solid behind it. */
  const HAIR = 1e-4;
  type Box = { readonly min: readonly number[]; readonly max: readonly number[] };
  const inBox = (p: Vector3, box: Box) =>
    p.x > box.min[0] + HAIR &&
    p.x < box.max[0] - HAIR &&
    p.y > box.min[1] + HAIR &&
    p.y < box.max[1] - HAIR &&
    p.z > box.min[2] + HAIR &&
    p.z < box.max[2] - HAIR;

  /** A record's rim (Ø 300 mm) and a sleeve's outline (310 mm square), in their own frame: the face is local XZ. */
  const RIM = Array.from({ length: 96 }, (_, k) => {
    const turn = (k / 96) * 2 * Math.PI;
    return new Vector3(LUXE_RECORD.radius * Math.cos(turn), 0, LUXE_RECORD.radius * Math.sin(turn));
  });
  const h = LUXE_SLEEVE.half;
  const OUTLINE = Array.from({ length: 25 }, (_, k) => -h + (2 * h * k) / 24).flatMap((s) => [
    new Vector3(-h, 0, s),
    new Vector3(h, 0, s),
    new Vector3(s, 0, -h),
    new Vector3(s, 0, h),
  ]);

  /**
   * The fake turntable posed as cd-player-luxe.glb: the record's seat on the platter's mat, the
   * ledge's seat behind the platter, the stand right of the deck and square to it, and the five
   * slots in the stand's frame (src/testing/model-measures.ts, which model-contract.test.ts holds
   * to the GLB).
   */
  function luxeSet() {
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
    return { rig: rigFor(luxe), toStand: stand.matrixWorld.clone().invert() };
  }

  /**
   * What a point stands in, if anything: the plinth, the platter, the arm at rest (what is drawn
   * of it: its head's invisible hit shape stops nothing), the ledge, the stand.
   */
  function obstacle(p: Vector3, toStand: Matrix4): string | null {
    if (inBox(p, LUXE_PLINTH)) return 'the plinth';
    const [cx, , cz] = LUXE_PLATTER.centre;
    if (
      Math.hypot(p.x - cx, p.z - cz) < LUXE_PLATTER.radius - HAIR &&
      p.y > LUXE_PLATTER.bottom + HAIR &&
      p.y < LUXE_PLATTER.top - HAIR
    ) {
      return 'the platter';
    }
    if (inBox(p, LUXE_ARM.rest)) return 'the arm';
    if ([LUXE_LEDGE.bar, LUXE_LEDGE.lip, ...LUXE_LEDGE.legs].some((box) => inBox(p, box))) {
      return 'the ledge';
    }
    const local = p.clone().applyMatrix4(toStand);
    if (LUXE_STEPS.some((box) => inBox(local, box))) return 'the stand’s steps';
    if (LUXE_PANELS.some((box) => inBox(local, box))) return 'the stand’s sides';
    if (inBox(local, LUXE_BAR)) return 'the stand’s bar';
    return null;
  }

  function hits(object: Object3D, points: readonly Vector3[], toStand: Matrix4): string[] {
    object.updateMatrixWorld(true);
    const found = new Set<string>();
    for (const point of points) {
      const hit = obstacle(point.clone().applyMatrix4(object.matrixWorld), toStand);
      if (hit) found.add(hit);
    }
    return [...found];
  }

  it('rests every record and sleeve clear of everything, in the rack, on the platter and the ledge', () => {
    const { rig, toStand } = luxeSet();
    applyPose(
      rig,
      restingPose(fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f'))), true, false),
      0,
    );
    rig.discs.slice(0, 6).forEach((copy, index) => {
      expect(hits(copy.object, RIM, toStand), `record ${index}`).toEqual([]);
      expect(hits(copy.sleeve!.object, OUTLINE, toStand), `sleeve ${index}`).toEqual([]);
    });
  });

  it('leaves a slot along its face, and comes down onto the platter and the ledge from above', () => {
    const { rig } = luxeSet();
    for (const slot of rig.slots) {
      expect(
        slot.out.distanceTo(new Vector3(0, 1, 0).applyQuaternion(slot.quaternion)),
      ).toBeLessThan(1e-12);
    }
    expect(rig.seat.out.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12);
    expect(rig.sleeveSeat?.out.toArray()).toEqual([0, 1, 0]);
  });

  it('flies every record and its sleeve clear of the plinth, the platter, the arm, the stand and the ledge', () => {
    const { rig, toStand } = luxeSet();
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
      for (let step = 0; step <= 200; step++) {
        const along = step / 200;
        applyPose(rig, only(1, { from, to, along }), 0);
        const copy = rig.discs[1];
        if (copy.object.visible) {
          expect(hits(copy.object, RIM, toStand), `the record, ${way}, along ${along}`).toEqual([]);
        }
        if (copy.sleeve?.object.visible) {
          expect(
            hits(copy.sleeve.object, OUTLINE, toStand),
            `the sleeve, ${way}, along ${along}`,
          ).toEqual([]);
        }
      }
    }
  });

  it('sends a record leaving the platter, and its sleeve the ledge, up, left and back', () => {
    const { rig } = luxeSet();
    applyPose(rig, only(0, { from: 'spindle', to: null, along: 0.3 }), 0);
    const record = rig.discs[0].object.position.clone().sub(rig.seat.position);
    const sleeve = rig.discs[0].sleeve!.object.position.clone().sub(rig.sleeveSeat!.position);
    for (const offset of [record, sleeve]) {
      expect(offset.y).toBeGreaterThan(0);
      expect(offset.x).toBeLessThan(0);
      expect(offset.z).toBeLessThan(0);
    }
  });

  it('keeps the whole set inside the box the framing test frames', () => {
    const { rig } = luxeSet();
    applyPose(
      rig,
      restingPose(fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f'))), true, false),
      0,
    );
    for (const copy of rig.discs.slice(0, 6)) {
      for (const point of [copy.object.position, copy.sleeve!.object.position]) {
        expect(inBox(point, BOXES.luxe), point.toArray().join(', ')).toBe(true);
      }
    }
  });
});

describe('the spin', () => {
  it('turns a CD player’s disc at 200 rpm, as it always did, and has no platter', () => {
    const rig = rigFor(fakeModel().model);
    expect(rig.spinRate).toBeCloseTo((200 / 60) * 2 * Math.PI, 12);
    applyPose(rig, restingPose(fillShelf(targetOf(lineup('a'))), true, true), 0.03);
    expect(rig.spin).toBeCloseTo((200 / 60) * 2 * Math.PI * 0.03, 12);
    expect(rig.platter).toBeNull();
  });

  it('turns a turntable’s record and its platter at 33⅓ rpm, clockwise seen from above', () => {
    const { model, platter } = fakeTurntable();
    const base = platter.rotation.y;
    const rig = rigFor(model, TEST_TURNTABLE);
    expect(rig.spinRate).toBeCloseTo((100 / 3 / 60) * 2 * Math.PI, 12);
    // A quarter of a turn: 33⅓ rpm is 0.5556 turns a second.
    applyPose(rig, restingPose(fillShelf(targetOf(lineup('a'))), true, true), 0.45);
    expect(rig.spin).toBeCloseTo(-Math.PI / 2, 9);
    expect(platter.rotation.y).toBeCloseTo(base - Math.PI / 2, 9);
    const expected = rig.seat.quaternion
      .clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2));
    expect(rig.discs[0].object.quaternion.angleTo(expected)).toBeLessThan(1e-6);
  });
});

describe('spinSense', () => {
  it('spins counter-clockwise seen from above unless the profile plays clockwise', () => {
    expect(spinSense({})).toBe(1);
    expect(spinSense({ clockwise: false })).toBe(1);
    expect(spinSense({ clockwise: true })).toBe(-1);
  });
});

describe('a turntable’s arm', () => {
  const view = (positionMs: number, status: Status = 'playing') => ({
    ...EMPTY_VIEW,
    current: track('a'),
    status,
    positionMs,
    durationMs: 200_000,
  });
  function turntable() {
    const rig = rigFor(fakeTurntable().model, TEST_TURNTABLE);
    if (!isTurntableRig(rig)) throw new Error('not a turntable');
    rig.shelf = fillShelf(targetOf(lineup('a')));
    return rig;
  }
  const angleOf = (rig: ReturnType<typeof turntable>, armAngle: number) =>
    armAngleFor(rig.profile.arm, armAngle);
  /**
   * The arm put on its groove for `at` at once (reduced motion): from its rest that is a long way,
   * so the first step swings it there lifted and the next lowers it. Each pose is applied.
   */
  function settle(rig: ReturnType<typeof turntable>, at: SceneView) {
    const swung = turntableRestFor(rig, at, Infinity, 0);
    applyPose(rig, restingPose(rig.shelf, true, true, swung), 0);
    const lowered = turntableRestFor(rig, at, Infinity, 0);
    applyPose(rig, restingPose(rig.shelf, true, true, lowered), 0);
    return { swung, lowered };
  }

  it('tracks from the lead-in at 0:00 to the run-out at the end, down, the platter turning', () => {
    const rig = turntable();
    const { swung, lowered: half } = settle(rig, view(100_000));
    expect(swung.armLift).toBe(1);
    expect(angleOf(rig, half.armAngle)).toBeCloseTo((-0.39 + -0.79) / 2, 9);
    expect(half).toMatchObject({ armLift: 0, spin: 1 });
    expect(angleOf(rig, turntableRestFor(rig, view(0), Infinity, 0).armAngle)).toBeCloseTo(
      -0.39,
      9,
    );
  });

  it('stays down as it tracks frame by frame on a 30-second preview, through a buffering stall', () => {
    const rig = turntable();
    const at = (positionMs: number): SceneView => ({ ...view(positionMs), durationMs: 30_000 });
    settle(rig, at(0));
    // The embed reports every 250 ms, but buffers from 1 s to 3.5 s, the audio stalled with it and
    // its updates dropped: the playhead runs on 2 s past the last report and holds, then the
    // reports resume from 1 s and the groove jumps back.
    const reported = (nowMs: number) => {
      const played = nowMs < 1000 ? nowMs : nowMs < 3500 ? 1000 : nowMs - 2500;
      return Math.floor(played / 250) * 250;
    };
    for (let frame = 1; frame <= 360; frame++) {
      const nowMs = (frame * 1000) / 60;
      const pose = turntableRestFor(rig, at(reported(nowMs)), 1 / 60, nowMs);
      applyPose(rig, restingPose(rig.shelf, true, true, pose), 1 / 60);
      expect(pose.armLift, `frame ${frame}`).toBe(0);
    }
    // 6 s in, 3.5 s of it played: on by that groove, a hair behind it as it eases.
    expect(angleOf(rig, rig.last.armAngle)).toBeCloseTo(-0.39 - 0.4 * (3.5 / 30), 2);
  });

  it('lifts where it stands as it pauses, easing up rather than jumping', () => {
    const rig = turntable();
    settle(rig, view(100_000));
    const step = turntableRestFor(rig, view(100_000, 'paused'), 1 / 60, 16);
    expect(step.armLift).toBeGreaterThan(0);
    expect(step.armLift).toBeLessThan(0.5);
    expect(angleOf(rig, step.armAngle)).toBeCloseTo(-0.59, 9);
  });

  it('goes to its rest after Stop, though the embed reports the track at its first second', () => {
    const rig = turntable();
    settle(rig, view(100_000));
    const stopped: SceneView = { ...view(1000, 'paused'), stopped: true };
    const { swung, lowered } = settle(rig, stopped);
    expect(swung).toMatchObject({ armAngle: ARM_REST, armLift: 1, spin: 0 });
    expect(lowered).toMatchObject({ armAngle: ARM_REST, armLift: 0, spin: 0 });
    // A pause there (not a stop) holds the arm lifted over its groove.
    const paused = settle(rig, view(1000, 'paused')).lowered;
    expect(angleOf(rig, paused.armAngle)).toBeCloseTo(-0.39 - 0.4 * (1000 / 200_000), 9);
    expect(paused.armLift).toBe(1);
  });

  it('takes over from a change’s landing on the lead-in at 0:00 without a jump', () => {
    const rig = turntable();
    rig.last = { armAngle: ARM_PLAY, spin: 1, armLift: 0 };
    const pose = turntableRestFor(rig, view(0), 1 / 60, 0);
    expect(pose.armAngle).toBeCloseTo(ARM_PLAY, 12);
    expect(pose.armLift).toBe(0);
  });

  it('holds a drag where the hand has it, lifting', () => {
    const rig = turntable();
    rig.armDrag = -0.7;
    const pose = turntableRestFor(rig, view(10_000), 1 / 60, 0);
    expect(angleOf(rig, pose.armAngle)).toBeCloseTo(-0.7, 12);
    expect(pose.armLift).toBeGreaterThan(0);
  });

  it('notes the arm’s lift after a pose on a turntable, and never on a CD player', () => {
    const rig = turntable();
    applyPose(rig, { ...restingPose(rig.shelf, true, false), armLift: 0.5 }, 0);
    expect(rig.last.armLift).toBe(0.5);
    const cd = rigFor(fakeModel().model);
    applyPose(cd, { ...restingPose(emptyShelf(), false, false), armLift: 0.5 }, 0);
    expect(cd.last.armLift).toBe(0);
    expect(cd.toneArm).toBeNull();
  });
});

describe('ringTargetMs', () => {
  it('is a CD player’s position, or its knob turn’s target', () => {
    const rig = rigFor(fakeModel().model);
    const view = {
      ...EMPTY_VIEW,
      status: 'playing' as const,
      positionMs: 10_000,
      durationMs: 60_000,
    };
    expect(ringTargetMs(rig, view, 0)).toBe(10_000);
    rig.scrubMs = 5_000;
    expect(ringTargetMs(rig, view, 0)).toBe(15_000);
  });

  it('is a turntable’s position carried on as it plays, or its arm drag’s target', () => {
    const rig = rigFor(fakeTurntable().model, TEST_TURNTABLE);
    const view = {
      ...EMPTY_VIEW,
      current: track('a'),
      status: 'playing' as const,
      positionMs: 10_000,
      durationMs: 60_000,
    };
    expect(ringTargetMs(rig, view, 1000)).toBe(10_000);
    expect(ringTargetMs(rig, view, 1500)).toBe(10_500);
    rig.dragMs = 30_000;
    expect(ringTargetMs(rig, view, 1500)).toBe(30_000);
  });
});
