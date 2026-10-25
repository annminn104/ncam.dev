import { createEvents } from '@react-three/fiber';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  type Intersection,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';
import { filterRaycasts, pickable, shown, shownBox } from './pick';

function hit(object: Object3D, point: [number, number, number], materialIndex = 0): Intersection {
  return {
    object,
    point: new Vector3(...point),
    distance: 1,
    face: { a: 0, b: 1, c: 2, normal: new Vector3(0, 1, 0), materialIndex },
  };
}

describe('shown', () => {
  it('is false when the object or any of its parents is hidden, as the renderer draws it', () => {
    const parent = new Group();
    const child = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    parent.add(child);
    expect(shown(child)).toBe(true);
    parent.visible = false;
    expect(shown(child)).toBe(false);
    parent.visible = true;
    child.visible = false;
    expect(shown(child)).toBe(false);
  });

  it('is false for an object the cut leaves out of the drawing on a layer of its own (cutaway.ts HIDDEN_LAYER)', () => {
    const child = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    child.layers.set(1);
    expect(shown(child)).toBe(false);
    expect(pickable(hit(child, [0, 1, 0]))).toBe(false);
    child.layers.set(0);
    expect(shown(child)).toBe(true);
  });
});

describe('pickable', () => {
  it('takes ordinary geometry', () => {
    expect(pickable(hit(new Mesh(new BoxGeometry(), new MeshStandardMaterial()), [0, 1, 0]))).toBe(
      true,
    );
  });

  it('looks through glass and frosted panes, so a click reaches the room behind them', () => {
    expect(
      pickable(
        hit(
          new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'GLASS_clear' })),
          [0, 1, 0],
        ),
      ),
    ).toBe(false);
    expect(
      pickable(
        hit(
          new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'FROSTED_bath' })),
          [0, 1, 0],
        ),
      ),
    ).toBe(false);
    const door = new Mesh(new BoxGeometry(), [
      new MeshStandardMaterial({ name: 'M_frame' }),
      new MeshStandardMaterial({ name: 'GLASS_clear' }),
    ]);
    expect(pickable(hit(door, [0, 1, 0], 0))).toBe(true);
    expect(pickable(hit(door, [0, 1, 0], 1))).toBe(false);
  });

  it('looks through the curtains\' voile like a pane (villa v2 spec §12 "Rèm và phụ kiện"): a click reaches the room behind', () => {
    const decor = new Mesh(new BoxGeometry(), [
      new MeshStandardMaterial({ name: 'M_drape' }),
      new MeshStandardMaterial({ name: 'M_sheer' }),
    ]);
    expect(pickable(hit(decor, [0, 1, 0], 0))).toBe(true); // the linen drape is solid
    expect(pickable(hit(decor, [0, 1, 0], 1))).toBe(false);
    // the zoom and the turn pick through it too (OrbitRig's pick keeps the first pickable hit): the lamp behind it
    const voile = new Mesh(
      new PlaneGeometry(2, 2),
      new MeshStandardMaterial({ name: 'M_sheer', side: DoubleSide }),
    );
    const lamp = new Mesh(
      new PlaneGeometry(2, 2),
      new MeshStandardMaterial({ name: 'M_led', side: DoubleSide }),
    );
    lamp.position.z = -1;
    const room = new Group();
    room.add(voile, lamp);
    room.updateMatrixWorld(true);
    const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
    expect(raycaster.intersectObject(room, true).find(pickable)?.object).toBe(lamp);
  });

  it("takes the glass of an interactive item, which is that item: a shower's enclosure, the glass door", () => {
    const door = new Mesh(new BoxGeometry(), [
      new MeshStandardMaterial({ name: 'M_frame' }),
      new MeshStandardMaterial({ name: 'GLASS_clear' }),
    ]);
    door.userData = { name: 'Door_main', interact: 'door:main', label: 'Cửa chính' };
    expect(pickable(hit(door, [0, 1, 0], 1))).toBe(true);
    const shower = new Group();
    shower.userData = { name: 'Shower_shared', interact: 'shower:Shower_shared', label: 'Vòi sen' };
    const enclosure = new Mesh(
      new BoxGeometry(),
      new MeshStandardMaterial({ name: 'GLASS_clear' }),
    );
    shower.add(enclosure);
    expect(pickable(hit(enclosure, [0, 1, 0]))).toBe(true);
  });

  it('ignores what is hidden, itself or through a parent (a shower that is off)', () => {
    const flow = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    flow.visible = false;
    expect(pickable(hit(flow, [0, 1, 0]))).toBe(false);
    const parent = new Group();
    const child = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    parent.add(child);
    parent.visible = false;
    expect(pickable(hit(child, [0, 1, 0]))).toBe(false);
  });

  it('ignores a hidden material and a light pool, which is light on the lawn and not the lamp (Garden_lamps by day)', () => {
    const off = new MeshStandardMaterial({ name: 'M_frame' });
    off.visible = false;
    const lamps = new Mesh(new BoxGeometry(), [new MeshStandardMaterial({ name: 'M_frame' }), off]);
    lamps.userData.interact = 'lights:garden';
    expect(pickable(hit(lamps, [0, 1, 0], 0))).toBe(true);
    expect(pickable(hit(lamps, [0, 1, 0], 1))).toBe(false);
    const pool = new MeshStandardMaterial({ name: 'GLOW_pool' });
    pool.userData.glow = true;
    lamps.material = [lamps.material[0], pool];
    expect(pickable(hit(lamps, [0, 0.03, 0], 1))).toBe(false);
  });

  it('ignores what the cutaway clips: the ray goes through the missing roof', () => {
    const plane = new Plane(new Vector3(0, -1, 0), 2.05);
    const roof = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ clippingPlanes: [plane] }));
    expect(pickable(hit(roof, [0, 7.5, 0]))).toBe(false);
    expect(pickable(hit(roof, [0, 1.5, 0]))).toBe(true);
  });
});

/** A mesh of two horizontal squares, a ceiling at y = 7 and a floor at y = 1: the house's Walls_white and Floors_stone span storeys like this. */
function storeys(
  material: Material | Material[] = new MeshStandardMaterial({ side: DoubleSide }),
): Mesh {
  const geometry = new BufferGeometry();
  const square = (y: number) => [-1, y, -1, 1, y, -1, 1, y, 1, -1, y, 1];
  geometry.setAttribute('position', new Float32BufferAttribute([...square(7), ...square(1)], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return new Mesh(geometry, material);
}

/** The ground-floor cut at 2.05 m: what lies above it is gone from the screen. */
const cut = () => new Plane(new Vector3(0, -1, 0), 2.05);

/**
 * The hits a pointer move at the middle of the view hands to the handlers of `root`, through R3F's own event pipeline
 * (createEvents) over a hand-made store, looking straight down from 10 m.
 */
function reached(root: Object3D): Intersection[] {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  const pointer = new Vector2(0, 0);
  const state = {
    raycaster,
    pointer,
    camera,
    previousRoot: undefined,
    onPointerMissed: undefined,
    events: {
      enabled: true,
      priority: 1,
      filter: undefined,
      compute: () => raycaster.setFromCamera(pointer, camera),
    },
    internal: {
      interaction: [root],
      hovered: new Map(),
      capturedMap: new Map(),
      initialClick: [0, 0],
      initialHits: [],
      lastEvent: { current: null },
    },
  };
  const store = { getState: () => state };
  const hits: Intersection[] = [];
  (root as unknown as { __r3f: object }).__r3f = {
    root: store,
    eventCount: 1,
    handlers: { onPointerMove: (event: Intersection) => hits.push(event) },
  };
  createEvents(store as never).handlePointer('onPointerMove')({
    offsetX: 0,
    offsetY: 0,
    buttons: 0,
  } as never);
  return hits;
}

/** Heights of the hits, to the millimetre. */
const heights = (hits: Intersection[]) => hits.map((hit) => Math.round(hit.point.y * 1000) / 1000);

describe('shownBox', () => {
  /** A 1 x `height` x 1 box standing on y = 0 at x, under a node, in `materials` (two halves when there are two). */
  function column(height: number, ...materials: Material[]) {
    const geometry = new BoxGeometry(1, height, 1).translate(0, height / 2, 0);
    if (materials.length > 1) {
      geometry.clearGroups();
      geometry.addGroup(0, 18, 0);
      geometry.addGroup(18, 18, 1);
    }
    return new Mesh(geometry, materials.length > 1 ? materials : materials[0]);
  }
  const cutAt = (y: number) =>
    new MeshStandardMaterial({ clippingPlanes: [new Plane(new Vector3(0, -1, 0), y)] });

  it('is the box round the object while nothing clips it', () => {
    const node = new Group();
    node.add(column(9.3, new MeshStandardMaterial()));
    const box = shownBox(node, new Box3());
    expect(box.min.distanceTo(new Vector3(-0.5, 0, -0.5))).toBeLessThan(1e-5);
    expect(box.max.distanceTo(new Vector3(0.5, 9.3, 0.5))).toBeLessThan(1e-5);
  });

  it('stops at the clipping plane of its materials: the hover frame round the cut chandelier ends at its crown', () => {
    const node = new Group();
    node.position.set(2, 0.5, 0); // the house's slot
    node.add(column(9.3, cutAt(0.5 + 5.72)));
    const box = shownBox(node, new Box3());
    expect(box.max.y).toBeCloseTo(0.5 + 5.72, 5);
    expect(box.min.distanceTo(new Vector3(1.5, 0.5, -0.5))).toBeLessThan(1e-5);
    expect(box.max.x).toBeCloseTo(2.5, 5);
  });

  it('keeps what a mesh draws in its least clipped material, and what an unclipped mesh beside it draws', () => {
    const node = new Group();
    node.add(column(9.3, cutAt(4), new MeshStandardMaterial()));
    expect(shownBox(node, new Box3()).max.y).toBeCloseTo(9.3, 5);
    const two = new Group();
    two.add(column(9.3, cutAt(4)), column(3));
    expect(shownBox(two, new Box3()).max.y).toBeCloseTo(4, 5);
    const far = new Group();
    far.add(column(9.3, cutAt(1e6)));
    expect(shownBox(far, new Box3()).max.y).toBeCloseTo(9.3, 5);
  });

  it('leaves out what the cut takes whole and what is hidden, and is empty when nothing is drawn', () => {
    const node = new Group();
    const low = column(2);
    const gone = column(9.3, cutAt(-1));
    gone.position.y = 3;
    node.add(low, gone);
    expect(shownBox(node, new Box3()).max.y).toBeCloseTo(2, 5);
    low.visible = false;
    expect(shownBox(node, new Box3()).isEmpty()).toBe(true);
  });

  it("keeps a flat mesh it draws (the koi pond's water surface), and drops one the cut lies under", () => {
    const water = () =>
      new Mesh(
        new PlaneGeometry(4, 3).rotateX(-Math.PI / 2).translate(0, 0.3, 0),
        new MeshStandardMaterial(),
      );
    const pond = new Group();
    pond.add(water());
    const box = shownBox(pond, new Box3());
    expect(box.isEmpty()).toBe(false);
    expect(box.min.y).toBeCloseTo(0.3, 5);
    expect(box.max.y).toBeCloseTo(0.3, 5);
    expect(box.max.x - box.min.x).toBeCloseTo(4, 5);
    const under = new Group();
    under.add(new Mesh(water().geometry, cutAt(1)));
    expect(shownBox(under, new Box3()).max.y).toBeCloseTo(0.3, 5);
    const above = new Group();
    above.add(new Mesh(water().geometry, cutAt(0.1)));
    expect(shownBox(above, new Box3()).isEmpty()).toBe(true);
  });
});

describe('filterRaycasts', () => {
  it('lets R3F keep only one hit per mesh, the nearest: a clipped ceiling hides the floor behind it (the bug)', () => {
    const house = new Group();
    house.add(storeys(new MeshStandardMaterial({ side: DoubleSide, clippingPlanes: [cut()] })));
    expect(heights(reached(house))).toEqual([7]);
  });

  it('drops the hits the cut removes before R3F sees them, so the visible floor behind the cut ceiling is reached', () => {
    const house = new Group();
    house.add(storeys(new MeshStandardMaterial({ side: DoubleSide, clippingPlanes: [cut()] })));
    filterRaycasts(house);
    expect(heights(reached(house))).toEqual([1]);
  });

  it('follows the plane as it moves: with the house whole the ceiling is reached again', () => {
    const plane = new Plane(new Vector3(0, -1, 0), 1e6);
    const house = new Group();
    house.add(storeys(new MeshStandardMaterial({ side: DoubleSide, clippingPlanes: [plane] })));
    filterRaycasts(house);
    expect(heights(reached(house))).toEqual([7]);
    plane.constant = 2.05;
    expect(heights(reached(house))).toEqual([1]);
  });

  it('drops glass in front of the frame of the same mesh and what is hidden, and keeps the rest', () => {
    const glass = new MeshStandardMaterial({ name: 'GLASS_clear', side: DoubleSide });
    const frame = new MeshStandardMaterial({ name: 'M_frame', side: DoubleSide });
    const door = storeys([glass, frame]);
    door.geometry.addGroup(0, 6, 0); // the ceiling is glass, the floor the frame
    door.geometry.addGroup(6, 6, 1);
    const house = new Group();
    house.add(door);
    filterRaycasts(house);
    expect(heights(reached(house))).toEqual([1]);
    house.visible = false;
    expect(reached(house)).toEqual([]);
  });

  it('keeps the glass of an interactive item, which is that item', () => {
    const shower = new Group();
    shower.userData = { name: 'Shower_shared', interact: 'shower:Shower_shared', label: 'Vòi sen' };
    shower.add(storeys(new MeshStandardMaterial({ name: 'GLASS_clear', side: DoubleSide })));
    filterRaycasts(shower);
    expect(heights(reached(shower))).toEqual([7]);
  });

  it('wraps a mesh once however often it is asked to', () => {
    const house = new Group();
    const mesh = storeys(new MeshStandardMaterial({ side: DoubleSide, clippingPlanes: [cut()] }));
    house.add(mesh);
    filterRaycasts(house);
    const wrapped = mesh.raycast;
    filterRaycasts(house);
    expect(mesh.raycast).toBe(wrapped);
  });

  it('leaves the original scene alone: only the meshes it is given', () => {
    const original = storeys(
      new MeshStandardMaterial({ side: DoubleSide, clippingPlanes: [cut()] }),
    );
    const house = new Group();
    house.add(original.clone());
    filterRaycasts(house);
    expect(original.raycast).toBe(Mesh.prototype.raycast);
  });
});
