import { Group, Mesh, MeshStandardMaterial, type Object3D, PointLight } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { collectGroups, groupKind, interactiveNode } from './groups';

/** A glTF node as GLTFLoader builds it: the node name and the extras in userData. */
function node<T extends Object3D>(
  object: T,
  name: string,
  extras: Record<string, unknown> = {},
): T {
  object.name = name;
  object.userData = { name, ...extras };
  return object;
}

describe('groupKind', () => {
  it('is the part of the group id before the colon', () => {
    expect(groupKind('light:living')).toBe('light');
    expect(groupKind('tv:TV_wall')).toBe('tv');
    expect(groupKind('jacuzzi')).toBe('jacuzzi');
  });
});

describe('interactiveNode', () => {
  it('walks up from what the pointer hit to the node whose extras name a group', () => {
    const tv = node(new Group(), 'TV_wall', { interact: 'tv:TV_wall', label: 'Living room TV' });
    const screen = new Mesh(); // a primitive of a multi-material mesh: no extras of its own
    const inner = new Group(); // gltf-transform moves an animated node's mesh into an unnamed child
    tv.add(inner);
    inner.add(screen);
    expect(interactiveNode(screen)).toBe(tv);
    expect(interactiveNode(tv)).toBe(tv);
  });

  it('is null for anything that is not interactive', () => {
    const root = new Group();
    const wall = node(new Mesh(), 'Walls_white');
    root.add(wall);
    expect(interactiveNode(wall)).toBeNull();
    expect(interactiveNode(null)).toBeNull();
  });
});

describe('collectGroups', () => {
  it('gathers every node of a group with its label, kind and clip', () => {
    const root = new Group();
    const light = node(new PointLight(), 'L_living', {
      interact: 'light:living',
      label: 'Living room lights',
      night_light: true,
    });
    const lamp = node(new Mesh(undefined, new MeshStandardMaterial()), 'Floor_lamp', {
      interact: 'light:living',
      label: 'Living room lights',
    });
    const door = node(new Mesh(), 'Door_main', {
      interact: 'door:main',
      label: 'Front door',
      clip: 'act_door_open',
    });
    root.add(light, lamp, door, node(new Mesh(), 'Sofa'));
    const groups = collectGroups(root);
    expect([...groups.keys()].sort()).toEqual(['door:main', 'light:living']);
    expect(groups.get('light:living')).toEqual({
      id: 'light:living',
      kind: 'light',
      label: 'Living room lights',
      nodes: [light, lamp],
      clip: null,
    });
    expect(groups.get('door:main')).toMatchObject({
      kind: 'door',
      label: 'Front door',
      nodes: [door],
      clip: 'act_door_open',
    });
  });

  it('skips a malformed group id with a warning, and labels a group by its id when no node names it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = new Group();
    root.add(
      node(new Mesh(), 'Odd', { interact: 'TV wall', label: 'TV' }),
      node(new Mesh(), 'Bare', { interact: 'fountain' }),
    );
    const groups = collectGroups(root);
    expect([...groups.keys()]).toEqual(['fountain']);
    expect(groups.get('fountain')!.label).toBe('fountain');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
