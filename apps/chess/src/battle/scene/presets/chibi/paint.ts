import { BufferAttribute, type BufferGeometry, Color } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const tmp = new Color();

/** Bakes one colour into a geometry's vertices, so differently coloured parts merge into one draw. */
export function paint<T extends BufferGeometry>(g: T, color: string): T {
  tmp.set(color);
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([tmp.r, tmp.g, tmp.b], i * 3);
  g.setAttribute('color', new BufferAttribute(c, 3));
  return g;
}

/** Merge painted parts (position, normal, colour only; indexed or not, consistently). */
export function mergePainted(parts: BufferGeometry[]): BufferGeometry {
  const clean = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p.clone();
    for (const name of Object.keys(g.attributes))
      if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(clean, false);
  if (!merged) throw new Error('mergePainted: parts have mismatched attributes');
  for (const g of clean) g.dispose();
  return merged;
}

/** The ink outline: a copy pushed out along welded (smooth) normals, drawn back-faced. */
export function outlineHull(g: BufferGeometry, thickness: number): BufferGeometry {
  const pos = g.clone();
  for (const name of Object.keys(pos.attributes))
    if (name !== 'position') pos.deleteAttribute(name);
  const welded = mergeVertices(pos, 1e-4);
  welded.computeVertexNormals();
  const p = welded.getAttribute('position');
  const n = welded.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      p.getX(i) + n.getX(i) * thickness,
      p.getY(i) + n.getY(i) * thickness,
      p.getZ(i) + n.getZ(i) * thickness,
    );
  }
  p.needsUpdate = true;
  pos.dispose();
  return welded;
}

export function triangles(g: BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
}
