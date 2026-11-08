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
} from '../testing/model-measures';
import { RACK_SLOTS } from './stage';
import { DYNAMIC_MATERIALS, REQUIRED_NODES } from './contract';
import { readGlbJson, triangleCount } from './glb';
import { CLEAR_ROLES, MATERIAL_ROLES, SKIN_ROLES } from './material-roles';

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
  const models = { suitcase: GLB, clear: CLEAR_GLB } as const;
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

  for (const id of ['suitcase', 'clear'] as const) {
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
  for (const id of ['suitcase', 'clear'] as const) {
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
