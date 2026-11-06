import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, Object3D, Texture, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TrackView } from '../bridge';
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
import type { PlayerModel } from './model';
import { applyPose, modelArmAngle, rigFor } from './rig';
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
  collection: { name: 'Mix', subtitle: 'Owner' },
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
  const model: PlayerModel = {
    id: 'suitcase',
    root,
    nodes: nodes as Record<RequiredNode, Object3D>,
    slots: {} as Slots,
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

describe('rigFor', () => {
  it('gives the seven discs and the booklet prints of their own, and disposes them with the model', () => {
    const { model, label, booklet, dispose } = fakeModel();
    const rig = rigFor(model);
    const prints = [...rig.discs.map((disc) => disc.label), rig.case.booklet];
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
    expect(rig.case.lift).toBeCloseTo(Math.hypot(CASE_W / 2, CASE_DEEP) + 0.01, 6);
  });
});

describe('modelArmAngle', () => {
  it('is the director’s own angle for the suitcase', () => {
    for (const angle of [ARM_REST, -0.2, ARM_PLAY])
      expect(modelArmAngle('suitcase', angle)).toBeCloseTo(angle, 12);
  });

  it('maps the director’s rest and play to the Clear model’s own', () => {
    expect(modelArmAngle('clear', ARM_REST)).toBeCloseTo(0, 12);
    expect(modelArmAngle('clear', ARM_PLAY)).toBeCloseTo(0.52, 12);
    expect(modelArmAngle('clear', ARM_PLAY / 2)).toBeCloseTo(0.26, 12);
  });
});

describe('the door', () => {
  /** The fake model as the Clear: its id, and a hinge turned a little at rest. */
  function clearModel() {
    const { model } = fakeModel();
    const hinge = named(new Object3D(), 'door_hinge');
    hinge.rotation.y = 0.1;
    model.root.add(hinge);
    const clear: PlayerModel = {
      ...model,
      id: 'clear',
      nodes: { ...model.nodes, door_hinge: hinge },
    };
    return { model: clear, hinge };
  }

  it('is the hinge of a model whose profile has a door, with the turn that opens it', () => {
    const { model, hinge } = clearModel();
    expect(rigFor(model).door).toEqual({ node: hinge, base: 0.1, angle: -(100 * Math.PI) / 180 });
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
});

describe('applyPose', () => {
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
    expect(rig.last).toEqual({ armAngle: ARM_PLAY, spin: 0 });
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
    const normal = rig.case.out.clone().transformDirection(lid.matrixWorld);
    for (let t = flip.start; t <= flip.end; t += 10) {
      applyPose(rig, posePlan(plan, t, restingArm(true, true, true)), 0);
      rig.case.object.updateMatrixWorld(true);
      for (const corner of caseCorners(rig.case.object)) {
        expect(corner.sub(seat).dot(normal), `t ${t}`).toBeGreaterThan(-1e-6);
      }
      expect(rig.case.booklet.map, `t ${t}`).toBe(t >= flip.start + FLIP_EDGE_MS ? back : front);
    }
    // Back at rest the case sits in its seat again.
    applyPose(rig, restingPose(plan.after, true, true), 0);
    expect(rig.case.object.position.distanceTo(rig.case.seat)).toBeLessThan(1e-9);
  });
});
