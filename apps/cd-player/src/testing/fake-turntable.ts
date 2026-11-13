import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
} from 'three';
import type { TurntableNode } from '../scene/contract';
import type { VinylModel } from '../scene/model';
import type { SceneProfile } from '../scene/profiles';

function named<T extends Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

/**
 * A turntable's profile for the scene's node tests: what Luxe's will be (src/scene/profiles.ts),
 * before Luxe exists. The rig reads a turntable's numbers from the profile it is given.
 */
export const TEST_TURNTABLE: SceneProfile = {
  media: 'vinyl',
  rpm: 100 / 3,
  frame: { target: [0.17, 0.13, -0.03], direction: [0, 0.6, 0.8], across: 0.46, up: 0.3 },
  near: 0.8,
  arm: { rest: 0, play: -0.39, runOut: -0.79 },
  door: null,
  clockwise: true,
  flight: { reach: { slot: 0.3, spindle: 0.15 }, aside: [-0.1, 0.15, -0.1] },
};

/**
 * The nodes the rig moves on a turntable, placed about as on Luxe (three's axes, metres): the
 * record on the platter and its seat, the template sleeve on the ledge and its seat, the stand
 * right of the deck turned 18° toward it with the five slots in it, the tonearm with its head,
 * the six keys and the plate. Its id is the suitcase's: the rig takes TEST_TURNTABLE as its profile.
 */
export function fakeTurntable() {
  const label = new MeshPhysicalMaterial({ name: 'art_disc' });
  const print = new MeshPhysicalMaterial({ name: 'art_sleeve' });
  const plate = new MeshPhysicalMaterial({ name: 'card_print' });
  const disc = named(new Group(), 'disc');
  disc.position.set(-0.045, 0.1017, -0.01);
  disc.add(
    new Mesh(
      new CylinderGeometry(0.15, 0.15, 0.0018, 48),
      new MeshPhysicalMaterial({ name: 'vinyl' }),
    ),
  );
  const labelMesh = new Mesh(new CylinderGeometry(0.05, 0.05, 0.0001, 24), label);
  labelMesh.position.y = 0.001;
  disc.add(labelMesh);
  const seat = named(new Object3D(), 'disc_seat');
  seat.position.copy(disc.position);
  const platter = named(new Group(), 'platter');
  platter.position.set(-0.045, 0.084, -0.01);
  platter.add(
    new Mesh(
      new CylinderGeometry(0.155, 0.155, 0.016, 48),
      new MeshPhysicalMaterial({ name: 'luxe_metal' }),
    ),
  );
  const sleeve = named(new Group(), 'sleeve');
  sleeve.add(
    new Mesh(
      new BoxGeometry(0.31, 0.003, 0.31),
      new MeshPhysicalMaterial({ name: 'sleeve_paper' }),
    ),
  );
  const cover = new Mesh(new BoxGeometry(0.309, 0.00005, 0.309), print);
  cover.position.y = 0.0016;
  sleeve.add(cover);
  const sleeveSeat = named(new Object3D(), 'sleeve_seat');
  sleeveSeat.position.set(-0.15, 0.158, -0.245);
  sleeveSeat.rotation.set((75 * Math.PI) / 180, 0, 0);
  sleeve.position.copy(sleeveSeat.position);
  sleeve.quaternion.copy(sleeveSeat.quaternion);
  const stand = named(new Group(), 'luxe_stand');
  stand.position.set(0.42, 0, -0.06);
  stand.rotation.y = (-18 * Math.PI) / 180;
  const nodes: Partial<Record<TurntableNode, Object3D>> = {
    disc,
    disc_seat: seat,
    platter,
    sleeve,
    sleeve_seat: sleeveSeat,
  };
  const slots: Object3D[] = [];
  for (let k = 0; k < 5; k++) {
    // Each sleeve's bottom edge 34 mm behind and 12 mm above the one in front, leaning back 15°.
    const slot = named(new Object3D(), `rack_slot_${k}`);
    slot.position.set(0, 0.1802 + 0.012 * k, 0.0439 - 0.034 * k);
    slot.rotation.set((75 * Math.PI) / 180, 0, 0);
    stand.add(slot);
    slots.push(slot);
    nodes[`rack_slot_${k}` as TurntableNode] = slot;
  }
  const arm = named(new Object3D(), 'arm_pivot');
  arm.position.set(0.15, 0.118, -0.11);
  const head = named(new Group(), 'arm_head');
  head.position.set(-0.0115, -0.012, 0.2317);
  head.add(
    new Mesh(new BoxGeometry(0.04, 0.024, 0.05), new MeshBasicMaterial({ name: 'arm_hit' })),
  );
  arm.add(head);
  const deck = named(new Group(), 'luxe');
  for (const key of [
    'btn_prev',
    'btn_next',
    'btn_play',
    'btn_stop',
    'btn_rpt',
    'btn_mode',
  ] as const) {
    const node = named(new Group(), key);
    node.add(
      new Mesh(
        new BoxGeometry(0.014, 0.005, 0.014),
        new MeshPhysicalMaterial({ name: 'luxe_metal' }),
      ),
    );
    deck.add(node);
    nodes[key] = node;
  }
  for (const icon of ['icon_play', 'icon_pause'] as const) {
    const node = named(
      new Mesh(new BoxGeometry(0.01, 0.0001, 0.01), new MeshBasicMaterial({ name: 'luxe_light' })),
      icon,
    );
    nodes.btn_play?.add(node);
    nodes[icon] = node;
  }
  const card = named(new Group(), 'card');
  card.add(new Mesh(new BoxGeometry(0.112, 0.02, 0.00005), plate));
  stand.add(card);
  Object.assign(nodes, { arm_pivot: arm, arm_head: head, card });
  deck.add(disc, seat, platter, sleeve, sleeveSeat, arm, stand);
  const root = new Group();
  root.add(deck);
  root.updateMatrixWorld(true);
  let disposed = 0;
  const model: VinylModel = {
    id: 'suitcase',
    media: 'vinyl',
    root,
    nodes: nodes as VinylModel['nodes'],
    slots: { art_disc: label, card_print: plate, art_sleeve: print },
    optionalSlots: {},
    applyLook: () => {},
    dispose: () => {
      disposed += 1;
    },
  };
  return {
    model,
    label,
    print,
    disc,
    seat,
    sleeve,
    sleeveSeat,
    platter,
    stand,
    slots,
    arm,
    head,
    disposed: () => disposed,
  };
}
