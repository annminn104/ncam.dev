import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DYNAMIC_MATERIALS, REQUIRED_NODES } from './contract';
import { readGlbJson, triangleCount } from './glb';
import { MATERIAL_ROLES, SKIN_ROLES } from './material-roles';

const GLB = fileURLToPath(new URL('../../public/assets/cd-player.glb', import.meta.url));
/** Box-mapped in export.py (one UV unit per 5 cm), for the grain the page tiles over them. */
const TILED = ['leather', 'lining', 'fabric', 'deck', 'grille'];

describe('public/assets/cd-player.glb (art/pipeline/build.mjs)', () => {
  const json = readGlbJson(readFileSync(GLB));

  it('has every node the page drives', () => {
    const names = new Set(json.nodes.map((node) => node.name));
    for (const name of REQUIRED_NODES) expect(names.has(name), name).toBe(true);
  });

  it('has every printed material and a role for every material', () => {
    const names = json.materials.map((material) => material.name ?? '');
    for (const name of DYNAMIC_MATERIALS) expect(names).toContain(name);
    for (const name of names) expect(MATERIAL_ROLES[name], name).toBeDefined();
  });

  it('has every material a skin recolours', () => {
    const names = new Set(json.materials.map((material) => material.name ?? ''));
    for (const name of Object.keys(SKIN_ROLES)) expect(names.has(name), name).toBe(true);
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
