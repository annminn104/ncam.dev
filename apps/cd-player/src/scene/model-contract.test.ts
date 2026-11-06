import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DYNAMIC_MATERIALS, OPTIONAL_NODES, REQUIRED_NODES } from './contract';
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
    for (const name of [...REQUIRED_NODES, ...OPTIONAL_NODES])
      expect(names.has(name), name).toBe(true);
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

  it('stays inside its budget, meshopt-compressed, with meshes on leaf nodes only', () => {
    expect(statSync(CLEAR_GLB).size).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(triangleCount(json)).toBeLessThanOrEqual(150_000);
    expect(json.extensionsUsed).toContain('EXT_meshopt_compression');
    for (const n of json.nodes) if (n.children?.length) expect(n.mesh, n.name).toBeUndefined();
  });
});
