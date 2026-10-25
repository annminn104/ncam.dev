import { Box3, type Intersection, type Material, type Mesh, type Object3D } from 'three';
import { isGlass, isSheer } from '../scene/extras';
import { interactiveNode } from './groups';

function hitMaterial(hit: Intersection): Material | null {
  const material = (hit.object as Mesh).material;
  if (!material) return null;
  return Array.isArray(material) ? (material[hit.face?.materialIndex ?? 0] ?? null) : material;
}

/**
 * Whether the renderer draws `object`: it and every parent visible (the hover leaves a node a click hid, Interaction),
 * and it on the camera's layer (the cut leaves what it takes away whole off it, cutaway.ts HIDDEN_LAYER, and the
 * basement what none of its openings shows, UNSEEN_LAYER).
 */
export function shown(object: Object3D): boolean {
  if (!object.layers.isEnabled(0)) return false;
  for (let node: Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}

/**
 * Whether a raycast hit is what the user points at. three's raycaster sees what the renderer hides, so this drops hits
 * on hidden objects (a shower that is off) and hidden materials, on light pools, on glass and frosted panes and the
 * curtains' voile (a click goes through to the room behind) unless the pane belongs to an interactive item (a shower's
 * enclosure, the glass door), and on the parts of a material its clipping planes cut away (the roof the dollhouse
 * cutaway removes). filterRaycasts applies it to every mesh.
 */
export function pickable(hit: Intersection): boolean {
  if (!shown(hit.object)) return false;
  const material = hitMaterial(hit);
  if (!material) return true;
  // a hidden material (a light pool by day) is not there, and a shown pool is light on the lawn, not the lamp it is under
  if (!material.visible || material.userData.glow) return false;
  if ((isGlass(material) || isSheer(material)) && !interactiveNode(hit.object)) return false;
  return !(material.clippingPlanes ?? []).some((plane) => plane.distanceToPoint(hit.point) < 0);
}

/**
 * The highest a material draws in world space: the lowest of its clipping planes that keep what lies below them (the
 * cutaway's, normal (0, -1, 0)); Infinity when none does.
 */
function drawnTop(material: Material): number {
  let top = Infinity;
  for (const { normal, constant } of material.clippingPlanes ?? []) {
    if (normal.y < 0 && Math.abs(normal.x) < 1e-9 && Math.abs(normal.z) < 1e-9)
      top = Math.min(top, constant / -normal.y);
  }
  return top;
}

const meshBox = new Box3();

/**
 * Sets `target` to the world box round what the renderer draws of `object` (the hover frame, Interaction): every shown
 * mesh's box, its top cut down to where its materials' clipping planes stop them, so the frame round the chandelier ends
 * where the cut ends its cord, not at the void's ceiling. A mesh cut away whole adds nothing; an object with nothing
 * drawn leaves `target` empty.
 */
export function shownBox(object: Object3D, target: Box3): Box3 {
  target.makeEmpty();
  object.updateWorldMatrix(true, true);
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !shown(mesh)) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    meshBox.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const top = Math.max(...materials.map(drawnTop));
    if (top <= meshBox.min.y) return; // cut away whole; a flat mesh under the cut (the pond's water) still counts
    meshBox.max.y = Math.min(meshBox.max.y, top);
    target.union(meshBox);
  });
  return target;
}

const wrapped = new WeakSet<Mesh>();

/**
 * Makes the meshes under `root` report only the hits the user can reach (pickable). R3F keeps just the first hit per
 * object (uuid, index and instance) before events.filter sees the list, so one mesh spanning storeys (Walls_white,
 * Floors_stone) whose nearest hit is cut away would hide the visible hits behind it and the pointer would go through
 * the walls: the drop has to happen in the raycast itself. A hidden object is not raycast at all. Wraps each mesh
 * once, and only the meshes of the (cloned) scene it is given.
 */
export function filterRaycasts(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || wrapped.has(mesh)) return;
    wrapped.add(mesh);
    const raycast = mesh.raycast;
    mesh.raycast = function (raycaster, intersects) {
      if (!shown(this)) return;
      const first = intersects.length;
      raycast.call(this, raycaster, intersects);
      let kept = first;
      for (let i = first; i < intersects.length; i++)
        if (pickable(intersects[i])) intersects[kept++] = intersects[i];
      intersects.length = kept;
    };
  });
}
