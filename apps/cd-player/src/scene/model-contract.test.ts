import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Box3, Euler, Matrix4, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOXES,
  CLEAR_DOOR,
  CLEAR_SEAT,
  CLEAR_SHELL,
  CLEAR_STAND,
  clearSlot,
  DECK_CASE,
  DECK_CHASSIS,
  DECK_DOOR,
  DECK_SCREEN,
  DECK_SEAT,
  DECK_WELL,
  deckSlot,
} from '../testing/model-measures';
import { RACK_SLOTS } from './stage';
import { DYNAMIC_MATERIALS, REQUIRED_NODES } from './contract';
import { readGlbJson, triangleCount } from './glb';
import { CLEAR_ROLES, MATERIAL_ROLES, SKIN_ROLES } from './material-roles';
import deckAtlas from './textures/deck-atlas.json';

const GLB = fileURLToPath(new URL('../../public/assets/cd-player.glb', import.meta.url));
/** Box-mapped in export.py (one UV unit per 5 cm), for the maps the page tiles over them. */
const TILED = ['leather', 'trim', 'lining', 'fabric', 'strap', 'deck', 'grille'];
/** What left with the polaroids and the latch: nothing may bring the names back by accident. */
const GONE = [
  'polaroid_a',
  'polaroid_b',
  'art_photo_a',
  'art_photo_b',
  'paper',
  'pin_pink',
  'pin_blue',
  'gold',
];
/** The marks printed on the deck round a key or the knob: the scripts parent them to the deck. */
const DECK_MARK = /^player_(btn_gap_|btn_lbl_|tick_|vol$)/;
const PIVOTS = ['btn_prev', 'btn_next', 'btn_play', 'btn_stop', 'btn_rpt', 'btn_mode', 'knob'];
const ARM_PARTS = [
  'player_arm_tube',
  'player_arm_cw',
  'player_arm_head',
  'player_arm_cart',
  'player_arm_lift',
  'player_arm_yoke_l',
];

describe('public/assets/cd-player.glb (art/pipeline/build.mjs)', () => {
  const json = readGlbJson(readFileSync(GLB));
  const index = new Map(json.nodes.map((node, i) => [node.name ?? '', i]));
  const node = (name: string) => json.nodes[index.get(name) ?? -1];
  const childrenOf = (name: string) =>
    (node(name)?.children ?? []).map((child) => json.nodes[child].name ?? '');
  const parentOf = (name: string) =>
    json.nodes.find((candidate) => candidate.children?.includes(index.get(name) ?? -1))?.name;
  const materialOf = (name: string) => {
    const mesh = node(name)?.mesh;
    if (mesh === undefined) return undefined;
    const material = json.meshes[mesh].primitives[0].material;
    return material === undefined ? undefined : json.materials[material].name;
  };

  it('has every node the page drives', () => {
    const names = new Set(json.nodes.map((node) => node.name));
    for (const name of REQUIRED_NODES) expect(names.has(name), name).toBe(true);
  });

  it('has nothing left of the polaroids, the paper, the pins or the gold', () => {
    const names = new Set([
      ...json.nodes.map((node) => node.name),
      ...json.materials.map((material) => material.name),
    ]);
    for (const name of GONE) expect(names.has(name), name).toBe(false);
  });

  it('has every printed material and a role for every material', () => {
    const names = json.materials.map((material) => material.name ?? '');
    for (const name of DYNAMIC_MATERIALS) expect(names).toContain(name);
    for (const name of names) expect(MATERIAL_ROLES[name], name).toBeDefined();
  });

  it('gives every skin role one material the model has', () => {
    const names = new Set(json.materials.map((material) => material.name ?? ''));
    for (const name of Object.keys(SKIN_ROLES)) expect(names.has(name), name).toBe(true);
    expect(new Set(Object.values(SKIN_ROLES))).toEqual(
      new Set(['leather', 'trim', 'thread', 'lining', 'hardware', 'deck', 'grille']),
    );
  });

  it('keeps the UVs of every printed and tiled primitive', () => {
    const mapped = new Set<string>([...DYNAMIC_MATERIALS, ...TILED]);
    const seen = new Set<string>();
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        const name =
          primitive.material === undefined ? '' : (json.materials[primitive.material].name ?? '');
        if (!mapped.has(name)) continue;
        seen.add(name);
        expect(primitive.attributes.TEXCOORD_0, name).toBeDefined();
      }
    }
    expect([...seen].sort()).toEqual([...mapped].sort());
  });

  it('hangs the five rack slots from the lid, as empties', () => {
    for (let i = 0; i < 5; i++) {
      const name = `rack_slot_${i}`;
      expect(node(name)?.mesh, name).toBeUndefined();
      expect(childrenOf(name), name).toEqual([]);
      expect(parentOf(name), name).toBe('lid_hinge');
    }
  });

  it('prints the tag on the tag node, and lights the ten VU segments with one material', () => {
    expect(materialOf('tag')).toBe('tag_print');
    for (let i = 0; i < 10; i++) expect(materialOf(`vu_seg_${i}`), `vu_seg_${i}`).toBe('vu');
    expect(MATERIAL_ROLES.vu).toBe('emissive');
  });

  it('prints ▶ and ‖ as two meshes on the play key, in the dark ink', () => {
    for (const icon of ['icon_play', 'icon_pause']) {
      expect(node(icon).mesh, icon).toBeDefined();
      expect(parentOf(icon), icon).toBe('btn_play');
      expect(materialOf(icon), icon).toBe('ink_dark');
    }
  });

  it('keeps the deck’s printed marks off the keys and the knob', () => {
    for (const pivot of PIVOTS) {
      const children = childrenOf(pivot);
      expect(children.length, pivot).toBeGreaterThan(0);
      for (const child of children) expect(child, pivot).not.toMatch(DECK_MARK);
    }
  });

  it('hangs the moving tonearm parts from arm_pivot and leaves its rest on the deck', () => {
    const under = childrenOf('arm_pivot');
    for (const part of ARM_PARTS) expect(under, part).toContain(part);
    expect(parentOf('player_arm_rest')).toBeDefined();
    expect(parentOf('player_arm_rest')).not.toBe('arm_pivot');
  });

  it('stays inside its budget, meshopt-compressed', () => {
    expect(statSync(GLB).size).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(triangleCount(json)).toBeLessThanOrEqual(150_000);
    expect(json.extensionsUsed).toContain('EXT_meshopt_compression');
  });

  it('keeps meshes on leaf nodes, so quantisation never scales a pivot', () => {
    for (const node of json.nodes)
      if (node.children?.length) expect(node.mesh, node.name).toBeUndefined();
  });
});

const CLEAR_GLB = fileURLToPath(
  new URL('../../public/assets/cd-player-clear.glb', import.meta.url),
);

describe('public/assets/cd-player-clear.glb (art/pipeline/build.mjs clear)', () => {
  const json = readGlbJson(new Uint8Array(readFileSync(CLEAR_GLB)));
  const index = new Map(json.nodes.map((node, i) => [node.name ?? '', i]));
  const node = (name: string) => json.nodes[index.get(name) ?? -1];
  const parentOf = (name: string) =>
    json.nodes.find((candidate) => candidate.children?.includes(index.get(name) ?? -1))?.name;
  const materialOf = (name: string) => {
    const mesh = node(name)?.mesh;
    if (mesh === undefined) return undefined;
    const material = json.meshes[mesh].primitives[0].material;
    return material === undefined ? undefined : json.materials[material].name;
  };

  it('has every node the page drives, and its door', () => {
    const names = new Set(json.nodes.map((n) => n.name));
    for (const name of [...REQUIRED_NODES, 'door_hinge']) expect(names.has(name), name).toBe(true);
  });

  it('has every printed material, a role for every material, and the four parts a look colours', () => {
    const names = json.materials.map((material) => material.name ?? '');
    for (const name of DYNAMIC_MATERIALS) expect(names).toContain(name);
    for (const name of names) expect(MATERIAL_ROLES[name], name).toBeDefined();
    for (const name of Object.keys(CLEAR_ROLES)) expect(names, name).toContain(name);
  });

  it('keeps the UVs of every printed primitive', () => {
    const printed = new Set<string>(DYNAMIC_MATERIALS);
    const seen = new Set<string>();
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        const name =
          primitive.material === undefined ? '' : (json.materials[primitive.material].name ?? '');
        if (!printed.has(name)) continue;
        seen.add(name);
        expect(primitive.attributes.TEXCOORD_0, name).toBeDefined();
      }
    }
    expect([...seen].sort()).toEqual([...printed].sort());
  });

  it('turns the keys, the knob and the door on empties that carry their parts', () => {
    for (const pivot of [...PIVOTS, 'door_hinge']) {
      expect(node(pivot), pivot).toBeDefined();
      expect(node(pivot).mesh, pivot).toBeUndefined();
      expect(node(pivot).children?.length ?? 0, pivot).toBeGreaterThan(0);
    }
  });

  it('hangs the five rack slots from the stand, as empties', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(parentOf(`rack_slot_${i}`)).toBe('lid_hinge');
      expect(node(`rack_slot_${i}`).mesh).toBeUndefined();
    }
  });

  it('prints the tag on the tag node, and lights the ten VU segments with one material', () => {
    expect(materialOf('tag')).toBe('tag_print');
    for (let i = 0; i < 10; i += 1) expect(materialOf(`vu_seg_${i}`), String(i)).toBe('vu');
  });

  it('prints ▶ and ‖ as two meshes on the play key, in the light', () => {
    for (const icon of ['icon_play', 'icon_pause']) {
      expect(node(icon).mesh, icon).toBeDefined();
      expect(parentOf(icon), icon).toBe('btn_play');
      expect(materialOf(icon), icon).toBe('light');
    }
  });

  it('stays inside its budget, meshopt-compressed, with meshes on leaf nodes only', () => {
    expect(statSync(CLEAR_GLB).size).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(triangleCount(json)).toBeLessThanOrEqual(150_000);
    expect(json.extensionsUsed).toContain('EXT_meshopt_compression');
    for (const n of json.nodes) if (n.children?.length) expect(n.mesh, n.name).toBeUndefined();
  });
});

const DECK_GLB = fileURLToPath(new URL('../../public/assets/cd-player-deck.glb', import.meta.url));

describe('public/assets/cd-player-deck.glb (art/pipeline/build.mjs deck)', () => {
  const json = readGlbJson(new Uint8Array(readFileSync(DECK_GLB)));
  const index = new Map(json.nodes.map((node, i) => [node.name ?? '', i]));
  const node = (name: string) => json.nodes[index.get(name) ?? -1];
  const parentOf = (name: string) =>
    json.nodes.find((candidate) => candidate.children?.includes(index.get(name) ?? -1))?.name;
  const materialOf = (name: string) => {
    const mesh = node(name)?.mesh;
    if (mesh === undefined) return undefined;
    const material = json.meshes[mesh].primitives[0].material;
    return material === undefined ? undefined : json.materials[material].name;
  };

  it('has every node the page drives, its door and its ring', () => {
    const names = new Set(json.nodes.map((n) => n.name));
    for (const name of [...REQUIRED_NODES, 'door_hinge', 'jog_ring']) {
      expect(names.has(name), name).toBe(true);
    }
  });

  it('has every printed material, the ring’s, a role for every material, and the two parts a look colours', () => {
    const names = json.materials.map((material) => material.name ?? '');
    for (const name of [...DYNAMIC_MATERIALS, 'jog_ring']) expect(names).toContain(name);
    for (const name of names) expect(MATERIAL_ROLES[name], name).toBeDefined();
    for (const name of ['deck_body', 'deck_light']) expect(names, name).toContain(name);
  });

  it('keeps the UVs of every printed primitive and of the ring', () => {
    const printed = new Set<string>([...DYNAMIC_MATERIALS, 'jog_ring']);
    const seen = new Set<string>();
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        const name =
          primitive.material === undefined ? '' : (json.materials[primitive.material].name ?? '');
        if (!printed.has(name)) continue;
        seen.add(name);
        expect(primitive.attributes.TEXCOORD_0, name).toBeDefined();
      }
    }
    expect([...seen].sort()).toEqual([...printed].sort());
  });

  it('turns the keys, the knob and the door on empties that carry their parts', () => {
    for (const pivot of [...PIVOTS, 'door_hinge']) {
      expect(node(pivot), pivot).toBeDefined();
      expect(node(pivot).mesh, pivot).toBeUndefined();
      expect(node(pivot).children?.length ?? 0, pivot).toBeGreaterThan(0);
    }
  });

  it('hangs the jog plate from its hinge', () => {
    expect(parentOf('knob')).toBe('door_hinge');
  });

  it('hangs the five rack slots from the flight case, as empties', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(parentOf(`rack_slot_${i}`)).toBe('lid_hinge');
      expect(node(`rack_slot_${i}`).mesh).toBeUndefined();
    }
  });

  it('prints the tag on the tag node, and lights the ten VU segments with one material', () => {
    expect(materialOf('tag')).toBe('tag_print');
    for (let i = 0; i < 10; i += 1) expect(materialOf(`vu_seg_${i}`), String(i)).toBe('vu');
  });

  it('prints ▶ and ‖ as two meshes on the play key, in the light', () => {
    for (const icon of ['icon_play', 'icon_pause']) {
      expect(node(icon).mesh, icon).toBeDefined();
      expect(parentOf(icon), icon).toBe('btn_play');
      expect(materialOf(icon), icon).toBe('deck_light');
    }
  });

  it('draws its LED ring as one mesh in its own material', () => {
    const mesh = node('jog_ring').mesh;
    expect(mesh).toBeDefined();
    expect(materialOf('jog_ring')).toBe('jog_ring');
    expect(json.meshes[mesh ?? -1].primitives).toHaveLength(1);
  });

  it('prints every zone of its print layer inside that zone’s region of the atlas', async () => {
    expect(json.materials.map((material) => material.name)).toContain('deck_pattern');
    const { width, height, regions } = deckAtlas;
    /** Half a pixel: the meshes are exact millimetres and the regions whole pixels. */
    const SLACK = 0.5;
    const covered = new Set<string>();
    const set = await loadScene(DECK_GLB);
    let primitives = 0;
    set.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!materials.some((material) => material.name === 'deck_pattern')) return;
      primitives += 1;
      const uv = mesh.geometry.getAttribute('uv');
      expect(uv, mesh.name).toBeDefined();
      const points = Array.from({ length: uv.count }, (_, i) => [
        uv.getX(i) * width,
        uv.getY(i) * height,
      ]);
      const region = regions.find((r) =>
        points.every(
          ([x, y]) =>
            x >= r.x - SLACK &&
            x <= r.x + r.w + SLACK &&
            y >= r.y - SLACK &&
            y <= r.y + r.h + SLACK,
        ),
      );
      expect(region, `${mesh.name}'s UVs lie in one region`).toBeDefined();
      covered.add(region?.id ?? '');
    });
    expect(primitives).toBeGreaterThan(0);
    for (const region of regions) expect(covered.has(region.id), region.id).toBe(true);
  });

  it('stays inside its budget, meshopt-compressed, with meshes on leaf nodes only', () => {
    expect(statSync(DECK_GLB).size).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(triangleCount(json)).toBeLessThanOrEqual(150_000);
    expect(json.extensionsUsed).toContain('EXT_meshopt_compression');
    for (const n of json.nodes) if (n.children?.length) expect(n.mesh, n.name).toBeUndefined();
  });
});

/** A committed GLB as the page loads it: three's GLTFLoader with the meshopt decoder. */
async function loadScene(file: string): Promise<Object3D> {
  const bytes = readFileSync(file);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await loader.parseAsync(data as ArrayBuffer, '');
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/**
 * Every vertex of `object`'s meshes in world space, or, given `pose`, with `object`'s own frame
 * placed there instead, as the rig places a copy of the disc in a rack slot.
 */
function vertices(object: Object3D, pose?: Matrix4): Vector3[] {
  const into = pose ? pose.clone().multiply(object.matrixWorld.clone().invert()) : new Matrix4();
  const out: Vector3[] = [];
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    const matrix = into.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      out.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix));
    }
  });
  return out;
}

function node(scene: Object3D, name: string): Object3D {
  const found = scene.getObjectByName(name);
  if (!found) throw new Error(`no ${name}`);
  return found;
}

/** A measure the scene tests hold to a tenth of a millimetre (src/testing/model-measures.ts). */
const PLACES = 4;
/** How far a vertex may stand from a surface the tests take it on: 0.05 mm (quantised positions). */
const TOLERANCE = 5e-5;
/** What float32 positions and quantisation leave of a measure that is exact. */
const EPSILON = 1e-6;

function expectPosition(object: Object3D, expected: readonly number[], at: string) {
  const position = object.getWorldPosition(new Vector3()).toArray();
  for (let axis = 0; axis < 3; axis++) {
    expect(position[axis], `${at}, axis ${axis}`).toBeCloseTo(expected[axis], PLACES);
  }
}

/**
 * The angle between two turns, from their difference's axis part: `Quaternion.angleTo` takes the
 * arc-cosine of a dot product within float32's noise of 1, which reads 2e-4 rad off an exact turn.
 */
function expectTurn(actual: Quaternion, expected: Euler, at: string) {
  const delta = actual.clone().invert().multiply(new Quaternion().setFromEuler(expected));
  const angle = 2 * Math.atan2(Math.hypot(delta.x, delta.y, delta.z), Math.abs(delta.w));
  expect(angle, at).toBeLessThan(1e-4);
}

describe('the GLBs as the scene tests measure them (src/testing/model-measures.ts)', () => {
  const models = { suitcase: GLB, clear: CLEAR_GLB, deck: DECK_GLB } as const;
  const scenes: Partial<Record<keyof typeof models, Object3D>> = {};
  beforeAll(async () => {
    for (const [id, file] of Object.entries(models)) {
      scenes[id as keyof typeof models] = await loadScene(file);
    }
  });
  const scene = (id: keyof typeof models): Object3D => {
    const loaded = scenes[id];
    if (!loaded) throw new Error(`${id} did not load`);
    return loaded;
  };

  for (const id of ['suitcase', 'clear', 'deck'] as const) {
    it(`frames the ${id}’s whole set by its box, a disc in each rack slot, rounded out to the millimetre`, () => {
      const set = scene(id);
      const box = new Box3().setFromPoints(vertices(set));
      const disc = node(set, 'disc');
      for (let slot = 0; slot < RACK_SLOTS; slot++) {
        for (const point of vertices(disc, node(set, `rack_slot_${slot}`).matrixWorld)) {
          box.expandByPoint(point);
        }
      }
      const [min, max] = [box.min.toArray(), box.max.toArray()];
      for (let axis = 0; axis < 3; axis++) {
        const at = `${id}, axis ${axis}`;
        // Never inside the set, and never a millimetre or more out of it.
        expect(BOXES[id].min[axis], at).toBeLessThanOrEqual(min[axis] + EPSILON);
        expect(min[axis] - BOXES[id].min[axis], at).toBeLessThan(0.001);
        expect(BOXES[id].max[axis], at).toBeGreaterThanOrEqual(max[axis] - EPSILON);
        expect(BOXES[id].max[axis] - max[axis], at).toBeLessThan(0.001);
      }
    });
  }

  // The play key's two icons, told apart by their meshes: ▶ is one triangle, whose faces cross the
  // key's centre line (x = 0 in the key's own frame), and ‖ is two bars, one on each side of it.
  for (const id of ['suitcase', 'clear', 'deck'] as const) {
    it(`draws the ${id}’s icon_play as a triangle across the key and icon_pause as two bars apart`, () => {
      const set = scene(id);
      const toKey = node(set, 'btn_play').matrixWorld.clone().invert();
      const trianglesX = (icon: string): number[][] => {
        const found = node(set, icon);
        const out: number[][] = [];
        found.traverse((child) => {
          const mesh = child as Mesh;
          if (!mesh.isMesh) return;
          const position = mesh.geometry.getAttribute('position');
          const matrix = toKey.clone().multiply(mesh.matrixWorld);
          const index = mesh.geometry.getIndex();
          const corner = (i: number) =>
            new Vector3()
              .fromBufferAttribute(position, index ? index.getX(i) : i)
              .applyMatrix4(matrix).x;
          const count = index ? index.count : position.count;
          for (let i = 0; i < count; i += 3) out.push([corner(i), corner(i + 1), corner(i + 2)]);
        });
        return out;
      };
      /** Clear of the centre line by 0.3 mm: the bars' inner edges stand 0.75 mm off it. */
      const MARGIN = 0.0003;
      const play = trianglesX('icon_play');
      const pause = trianglesX('icon_pause');
      // Some face of the triangle has corners on both sides of the centre line.
      expect(play.some((x) => Math.min(...x) < -MARGIN && Math.max(...x) > MARGIN)).toBe(true);
      // No vertex of the bars is on or near it, and each side holds one.
      const xs = pause.flat();
      expect(xs.every((x) => Math.abs(x) > MARGIN)).toBe(true);
      expect(xs.some((x) => x < 0)).toBe(true);
      expect(xs.some((x) => x > 0)).toBe(true);
    });
  }

  it('hangs the Clear’s door on its hinge, turning about the world’s Y, with its shut box', () => {
    const hinge = node(scene('clear'), 'door_hinge');
    expectPosition(hinge, CLEAR_DOOR.hinge, 'door_hinge');
    expectTurn(hinge.getWorldQuaternion(new Quaternion()), new Euler(0, 0, 0), 'door_hinge');
    const box = new Box3().setFromPoints(vertices(hinge));
    for (let axis = 0; axis < 3; axis++) {
      expect(box.min.getComponent(axis), `min, axis ${axis}`).toBeCloseTo(
        CLEAR_DOOR.min[axis],
        PLACES,
      );
      expect(box.max.getComponent(axis), `max, axis ${axis}`).toBeCloseTo(
        CLEAR_DOOR.max[axis],
        PLACES,
      );
    }
  });

  it('seats the Clear’s disc on its spindle, upright behind the door', () => {
    const set = scene('clear');
    for (const name of ['disc_seat', 'disc']) {
      const seat = node(set, name);
      expectPosition(seat, CLEAR_SEAT.position, name);
      expectTurn(
        seat.getWorldQuaternion(new Quaternion()),
        new Euler(CLEAR_SEAT.rotationX, 0, 0),
        name,
      );
    }
  });

  it('stands the Clear’s rack where the rig test flies its discs, slot by slot', () => {
    const set = scene('clear');
    const stand = node(set, 'lid_hinge');
    expectPosition(stand, CLEAR_STAND.position, 'lid_hinge');
    expectTurn(
      stand.getWorldQuaternion(new Quaternion()),
      new Euler(0, CLEAR_STAND.rotationY, 0),
      'lid_hinge',
    );
    for (let k = 0; k < RACK_SLOTS; k++) {
      const slot = node(set, `rack_slot_${k}`);
      const expected = clearSlot(k);
      for (let axis = 0; axis < 3; axis++) {
        expect(slot.position.getComponent(axis), `slot ${k}, axis ${axis}`).toBeCloseTo(
          expected.position[axis],
          PLACES,
        );
      }
      expectTurn(slot.quaternion, new Euler(expected.rotationX, 0, 0), `slot ${k}`);
    }
  });

  it('hangs the Deck’s plate on its hinge, turning about the world’s X, with its shut box', () => {
    const hinge = node(scene('deck'), 'door_hinge');
    expect(DECK_DOOR.axis).toBe('x');
    expectPosition(hinge, DECK_DOOR.hinge, 'door_hinge');
    expectTurn(hinge.getWorldQuaternion(new Quaternion()), new Euler(0, 0, 0), 'door_hinge');
    const box = new Box3().setFromPoints(vertices(hinge));
    for (let axis = 0; axis < 3; axis++) {
      expect(box.min.getComponent(axis), `min, axis ${axis}`).toBeCloseTo(
        DECK_DOOR.shut.min[axis],
        PLACES,
      );
      expect(box.max.getComponent(axis), `max, axis ${axis}`).toBeCloseTo(
        DECK_DOOR.shut.max[axis],
        PLACES,
      );
    }
    // A negative turn about X lifts the plate's far edge clear of the deck.
    hinge.rotation.x = (-70 * Math.PI) / 180;
    hinge.updateMatrixWorld(true);
    const lifted = new Box3().setFromPoints(vertices(hinge));
    hinge.rotation.x = 0;
    hinge.updateMatrixWorld(true);
    expect(lifted.max.y).toBeGreaterThan(DECK_DOOR.hinge[1] + 0.15);
    expect(lifted.min.x).toBeCloseTo(box.min.x, PLACES);
    expect(lifted.max.x).toBeCloseTo(box.max.x, PLACES);
  });

  it('seats the Deck’s disc on its spindle, its up the world’s up', () => {
    const set = scene('deck');
    for (const name of ['disc_seat', 'disc']) {
      const seat = node(set, name);
      expectPosition(seat, DECK_SEAT.position, name);
      const up = new Vector3(0, 1, 0).applyQuaternion(seat.getWorldQuaternion(new Quaternion()));
      for (let axis = 0; axis < 3; axis++) {
        expect(up.getComponent(axis), `${name}, axis ${axis}`).toBeCloseTo(
          DECK_SEAT.up[axis],
          PLACES,
        );
      }
    }
  });

  it('stands the Deck’s rack in its case where the rig test flies its discs, slot by slot', () => {
    const set = scene('deck');
    const flightCase = node(set, 'lid_hinge');
    expectTurn(
      flightCase.getWorldQuaternion(new Quaternion()),
      new Euler(0, DECK_CASE.turn, 0),
      'lid_hinge',
    );
    for (let k = 0; k < RACK_SLOTS; k++) {
      const slot = node(set, `rack_slot_${k}`);
      const expected = deckSlot(k);
      for (let axis = 0; axis < 3; axis++) {
        expect(slot.position.getComponent(axis), `slot ${k}, axis ${axis}`).toBeCloseTo(
          expected.position[axis],
          PLACES,
        );
      }
      expectTurn(slot.quaternion, new Euler(expected.rotationX, 0, 0), `slot ${k}`);
    }
  });

  /** The box of the meshes under `root` that no `apart` node holds, in world space. */
  const boxOf = (root: Object3D, apart: Object3D[], within?: Object3D[]) => {
    const points: Vector3[] = [];
    root.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const chain: Object3D[] = [];
      for (let at: Object3D | null = child; at; at = at.parent) chain.push(at);
      if (chain.some((at) => apart.includes(at))) return;
      if (within && !chain.some((at) => within.includes(at))) return;
      points.push(...vertices(mesh));
    });
    return new Box3().setFromPoints(points);
  };
  const expectBox = (
    box: Box3,
    expected: { min: readonly number[]; max: readonly number[] },
    at: string,
  ) => {
    for (let axis = 0; axis < 3; axis++) {
      expect(box.min.getComponent(axis), `${at} min, axis ${axis}`).toBeCloseTo(
        expected.min[axis],
        PLACES,
      );
      expect(box.max.getComponent(axis), `${at} max, axis ${axis}`).toBeCloseTo(
        expected.max[axis],
        PLACES,
      );
    }
  };

  it('spans the Deck’s body, leaving its plate, cases and screen module out', () => {
    const set = scene('deck');
    const parts = ['door_hinge', 'lid_hinge', 'case', 'deck_screen_housing', 'deck_screen_face'];
    expectBox(
      boxOf(
        node(set, 'deck'),
        parts.map((name) => node(set, name)),
      ),
      DECK_CHASSIS,
      'chassis',
    );
  });

  it('spans the Deck’s screen module', () => {
    const set = scene('deck');
    const module = [node(set, 'deck_screen_housing'), node(set, 'deck_screen_face')];
    expectBox(boxOf(node(set, 'deck'), [], module), DECK_SCREEN, 'screen');
    // The glass, bezel and VU strip stand inside the housing's box.
    const face = new Box3().setFromPoints(vertices(module[1]));
    expect(DECK_SCREEN.min[0]).toBeLessThanOrEqual(face.min.x + EPSILON);
    expect(DECK_SCREEN.max[1]).toBeGreaterThanOrEqual(face.max.y - EPSILON);
  });

  it('spans the Deck’s case’s box in its own frame, and its well', () => {
    const set = scene('deck');
    const flightCase = node(set, 'lid_hinge');
    const own = flightCase.matrixWorld.clone().invert();
    const caseBox = new Box3().setFromPoints(
      vertices(flightCase).map((point) => point.applyMatrix4(own)),
    );
    expectBox(caseBox, DECK_CASE, 'case');
    // The well: the one `well` mesh whose box holds the spindle's seat (the fader's slot is `well`
    // too, far off, and so are the vents, but they lie below the disc), a pocket round DECK_WELL.centre,
    // wall and floor rim at the radius, floor at the floor.
    const [cx, , cz] = DECK_WELL.centre;
    const wells: Vector3[][] = [];
    node(set, 'deck').traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.material.name !== 'well') return;
      const points = vertices(mesh);
      if (new Box3().setFromPoints(points).containsPoint(new Vector3(...DECK_SEAT.position))) {
        wells.push(points);
      }
    });
    expect(wells).toHaveLength(1);
    const well = wells[0];
    const radii = well.map((p) => Math.hypot(p.x - cx, p.z - cz));
    expect(Math.max(...radii)).toBeCloseTo(DECK_WELL.radius, PLACES);
    expect(Math.min(...radii)).toBeCloseTo(DECK_WELL.radius, PLACES);
    expect(Math.min(...well.map((p) => p.y))).toBeCloseTo(DECK_WELL.floor, PLACES);
    expect(DECK_WELL.centre[1]).toBe(DECK_WELL.floor);
  });

  describe('the Clear’s shell, whose walls the rig test keeps the discs out of', () => {
    const { halfWidth, bottom, top, corner, band, front, back, opening } = CLEAR_SHELL;
    /** How far (x, y) stands outside the shell's outline, a rounded rectangle; negative inside. */
    const outside = (x: number, y: number) => {
      const qx = Math.abs(x) - (halfWidth - corner);
      const qy = Math.abs(y - (bottom + top) / 2) - ((top - bottom) / 2 - corner);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner;
    };
    const part = (name: string) => vertices(node(scene('clear'), name));

    it('spans the outline from the front plate to the back one, the band between them', () => {
      const spans = {
        clear_shell_front: front,
        clear_shell_band: [back[1], front[0]],
        clear_shell_back: back,
      } as const;
      for (const [name, z] of Object.entries(spans)) {
        const box = new Box3().setFromPoints(part(name));
        const expected = { min: [-halfWidth, bottom, z[0]], max: [halfWidth, top, z[1]] };
        for (let axis = 0; axis < 3; axis++) {
          expect(box.min.getComponent(axis), `${name} min, axis ${axis}`).toBeCloseTo(
            expected.min[axis],
            PLACES,
          );
          expect(box.max.getComponent(axis), `${name} max, axis ${axis}`).toBeCloseTo(
            expected.max[axis],
            PLACES,
          );
        }
      }
    });

    it('runs its band from the outline to its own thickness inside it, its corners round', () => {
      const points = part('clear_shell_band');
      const depths = points.map((p) => outside(p.x, p.y));
      expect(Math.max(...depths)).toBeCloseTo(0, PLACES);
      expect(Math.min(...depths)).toBeCloseTo(-band, PLACES);
      for (const depth of depths) {
        expect(depth).toBeGreaterThan(-band - TOLERANCE);
        expect(depth).toBeLessThan(TOLERANCE);
      }
      // In the corners: on arcs round each corner's centre, `corner` out and `band` in from it.
      const radii = points
        .filter((p) => Math.abs(p.x) > halfWidth - corner)
        .filter((p) => p.y < bottom + corner || p.y > top - corner)
        .map((p) => {
          const centre = p.y < bottom + corner ? bottom + corner : top - corner;
          return Math.hypot(Math.abs(p.x) - (halfWidth - corner), p.y - centre);
        });
      expect(radii.length).toBeGreaterThan(0);
      expect(Math.max(...radii)).toBeCloseTo(corner, PLACES);
      expect(Math.min(...radii)).toBeCloseTo(corner - band, PLACES);
    });

    it('opens its front plate round the window’s middle, as wide as the rig test lets a disc through', () => {
      const nearest = Math.min(
        ...part('clear_shell_front').map((p) => Math.hypot(p.x, p.y - opening.y)),
      );
      expect(nearest).toBeCloseTo(opening.radius, PLACES);
    });
  });
});
