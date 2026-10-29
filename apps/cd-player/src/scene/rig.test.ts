import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, Object3D, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { RequiredNode } from './contract';
import { restingPose } from './director';
import type { Slots } from './materials';
import type { PlayerModel } from './model';
import { applyPose, rigFor } from './rig';

function named<T extends Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

/** The nodes the rig moves, placed as in cd-player.glb (lid_hinge > case > case_lid_hinge). */
function fakeModel() {
  const label = new MeshPhysicalMaterial({ name: 'art_disc' });
  const booklet = new MeshPhysicalMaterial({ name: 'art_booklet' });
  const disc = named(new Group(), 'disc');
  disc.position.set(-0.048, 0.0745, -0.002);
  disc.add(new Mesh(new BoxGeometry(), label));
  const seat = named(new Object3D(), 'disc_seat');
  seat.position.copy(disc.position);
  const caseLid = named(new Group(), 'case_lid_hinge');
  caseLid.position.set(-0.071, 0.0066, 0);
  caseLid.add(new Mesh(new BoxGeometry(), booklet));
  const jewelCase = named(new Group(), 'case');
  jewelCase.position.set(-0.06, 0.0265, 0.118);
  jewelCase.rotation.x = Math.PI;
  jewelCase.add(caseLid);
  const lid = named(new Group(), 'lid_hinge');
  lid.position.set(0, 0.084, -0.118);
  lid.rotation.x = (-100 * Math.PI) / 180;
  lid.add(jewelCase);
  const arm = named(new Object3D(), 'arm_pivot');
  const player = named(new Group(), 'player');
  player.add(disc, seat, lid, arm);
  const root = new Group();
  root.add(player);
  const nodes = { disc, disc_seat: seat, case: jewelCase, case_lid_hinge: caseLid, arm_pivot: arm };
  const dispose = vi.fn();
  const model: PlayerModel = {
    root,
    nodes: nodes as Partial<Record<RequiredNode, Object3D>> as Record<RequiredNode, Object3D>,
    slots: {} as Slots,
    dispose,
  };
  return { model, label, booklet, dispose };
}

describe('rigFor', () => {
  it('gives each disc and each case prints of their own, and disposes them with the model', () => {
    const { model, label, booklet, dispose } = fakeModel();
    const rig = rigFor(model);
    const prints = [
      rig.discs[0].label,
      rig.discs[1].label,
      rig.cases[0].booklet,
      rig.cases[1].booklet,
    ];
    expect(new Set(prints).size).toBe(4);
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
    expect(discs).toBe(2);
  });

  it('keeps the first disc in the lid’s case until the first play, and hides the spare pair', () => {
    const { model } = fakeModel();
    const rig = rigFor(model);
    applyPose(rig, restingPose(false, false, false), null, 0);
    expect(rig.cases[0].object.visible).toBe(true);
    expect(rig.cases[1].object.visible).toBe(false);
    expect(rig.discs[1].object.visible).toBe(false);
    // Blender's disc slot in the case, (3, 0, 6) mm.
    const slot = rig.cases[0].object.localToWorld(new Vector3(0.003, 0.006, 0));
    expect(rig.discs[0].object.visible).toBe(true);
    expect(rig.discs[0].object.position.distanceTo(slot)).toBeLessThan(1e-6);
  });
});
