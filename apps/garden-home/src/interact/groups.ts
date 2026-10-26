import type { Object3D } from 'three';

/**
 * A group id from the node extras of the house (houses/interact.py) or the garden (garden/interact.py): a kind, then ':'
 * and a name unless there is one only.
 */
export const GROUP_RE = /^[a-z]+(:[A-Za-z0-9_]+)?$/;

/** The items one click toggles together (AGENTS.md, Art pipeline), within a module or across modules (lights:garden). */
export interface InteractGroup {
  id: string;
  /** light, lights, tv, pc, bbq, shower, door, jacuzzi, fountain or waterfall: what a toggle does to the group. */
  kind: string;
  /** Name shown on hover. */
  label: string;
  /** The glTF nodes that carry the group's extras. */
  nodes: Object3D[];
  /** The clip the group plays (door, jacuzzi), or null. */
  clip: string | null;
}

export function groupKind(group: string): string {
  const colon = group.indexOf(':');
  return colon < 0 ? group : group.slice(0, colon);
}

/**
 * The interactive node an object belongs to: the nearest ancestor (the object itself included) whose glTF extras name
 * a group. GLTFLoader puts extras on the node, while a pointer hits one of its meshes: a primitive of a multi-material
 * mesh, or the unnamed child gltf-transform moves an animated node's mesh into.
 */
export function interactiveNode(object: Object3D | null): Object3D | null {
  for (let node = object; node; node = node.parent) {
    if (typeof node.userData.interact === 'string') return node;
  }
  return null;
}

/** Every interact group under `root`; malformed ids are skipped with a warning, like malformed hotspots. */
export function collectGroups(root: Object3D): Map<string, InteractGroup> {
  const groups = new Map<string, InteractGroup>();
  root.traverse((node) => {
    const { interact, label, clip } = node.userData as Record<string, unknown>;
    if (typeof interact !== 'string') return;
    if (!GROUP_RE.test(interact)) {
      console.warn(`[interact] ${node.name}: group ${interact} is not a group id, skipped`);
      return;
    }
    let group = groups.get(interact);
    if (!group) {
      group = { id: interact, kind: groupKind(interact), label: interact, nodes: [], clip: null };
      groups.set(interact, group);
    }
    group.nodes.push(node);
    if (typeof label === 'string' && label.trim() && group.label === interact) group.label = label;
    if (typeof clip === 'string') group.clip = clip;
  });
  return groups;
}
