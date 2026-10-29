import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  BUTTON_ACTIONS,
  hitFor,
  knobSeekMs,
  leaveOnDeck,
  pressDepth,
} from './controls';
import { readGlbJson } from './glb';

const GLB = fileURLToPath(new URL('../../public/assets/cd-player.glb', import.meta.url));

type Node = { name: string; parent: Node | null };
const chain = (...names: string[]): Node => {
  let node: Node | null = null;
  for (const name of names) node = { name, parent: node };
  return node!;
};

describe('controls', () => {
  it('finds the key or the knob above a hit mesh', () => {
    expect(hitFor(chain('player', 'btn_play', 'player_btn_cap_play'))).toEqual({
      kind: 'button',
      node: 'btn_play',
      action: { type: 'toggle' },
    });
    expect(hitFor(chain('player', 'knob', 'player_knob_body'))).toEqual({ kind: 'knob' });
    expect(hitFor(chain('player', 'player_frame'))).toBeNull();
    expect(hitFor(null)).toBeNull();
  });

  it('turns the knob into seconds: a full turn is 30 s', () => {
    expect(knobSeekMs(2 * Math.PI)).toBe(30_000);
    expect(knobSeekMs(-Math.PI / 2)).toBe(-7_500);
  });

  it('presses a key down and back within 160 ms', () => {
    expect(pressDepth(0)).toBe(0);
    expect(pressDepth(80)).toBeCloseTo(0.0012);
    expect(pressDepth(200)).toBe(0);
  });

  it('measures the shortest turn between two angles', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDelta(0, 0.5)).toBeCloseTo(0.5);
  });
});

describe('leaving the printed marks on the deck', () => {
  const part = (name: string, parent: Object3D, x = 0, y = 0, z = 0) => {
    const object = new Object3D();
    object.name = name;
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const worldOf = (object: Object3D) => object.getWorldPosition(new Vector3());

  it('keeps the dial still while the knob turns', () => {
    const player = new Object3D();
    const knob = part('knob', player, 0.1, 0.078, 0.058);
    const body = part('player_knob_body', knob, 0, 0.01, 0);
    const dot = part('player_knob_dot', knob, 0.0036, 0.0183, -0.0099);
    const tick = part('player_tick_3', knob, -0.0214, 0, -0.0089);
    const label = part('player_vol', knob, 0, 0, 0.0274);
    player.updateMatrixWorld(true);
    const [tickAt, labelAt, dotAt] = [tick, label, dot].map(worldOf);

    leaveOnDeck(knob);
    expect([body.parent, dot.parent]).toEqual([knob, knob]);
    expect([tick.parent, label.parent]).toEqual([player, player]);
    // Handed over where they stood.
    expect(worldOf(tick).distanceTo(tickAt)).toBeLessThan(1e-9);
    expect(worldOf(label).distanceTo(labelAt)).toBeLessThan(1e-9);

    knob.rotation.y = 1.2;
    player.updateMatrixWorld(true);
    expect(worldOf(tick).distanceTo(tickAt)).toBeLessThan(1e-9);
    expect(worldOf(label).distanceTo(labelAt)).toBeLessThan(1e-9);
    expect(worldOf(dot).distanceTo(dotAt)).toBeGreaterThan(0.005);
  });

  it('keeps a key’s ring and its label on the deck while the key sinks', () => {
    const player = new Object3D();
    const key = part('btn_play', player, 0.086, 0.078, -0.01);
    const ring = part('player_btn_gap_play', key);
    const label = part('player_btn_lbl_play', key, 0, 0, 0.0104);
    const cap = part('player_btn_cap_play', key);
    const icon = part('player_btn_icon_play', key, 0, 0.0037, 0);
    player.updateMatrixWorld(true);
    const [ringAt, labelAt, capAt] = [ring, label, cap].map(worldOf);

    leaveOnDeck(key);
    expect([cap.parent, icon.parent]).toEqual([key, key]);
    expect([ring.parent, label.parent]).toEqual([player, player]);

    key.position.y -= 0.0012;
    player.updateMatrixWorld(true);
    expect(worldOf(ring).distanceTo(ringAt)).toBeLessThan(1e-9);
    expect(worldOf(label).distanceTo(labelAt)).toBeLessThan(1e-9);
    expect(worldOf(cap).y).toBeCloseTo(capAt.y - 0.0012, 9);
  });

  it('hands over what the committed model prints around each key and the knob, and only that', () => {
    const json = readGlbJson(readFileSync(GLB));
    for (const pivot of [...Object.keys(BUTTON_ACTIONS), 'knob']) {
      const node = json.nodes.find((candidate) => candidate.name === pivot);
      const deck = new Object3D();
      const control = part(pivot, deck);
      for (const child of node?.children ?? []) part(json.nodes[child].name ?? '', control);
      const before = control.children.length;

      leaveOnDeck(control);
      const kept = control.children.map((child) => child.name);
      expect(kept.length, pivot).toBeGreaterThan(0);
      expect(kept.length, pivot).toBeLessThan(before);
      for (const name of kept) expect(name, pivot).toMatch(/^player_(btn_(cap|icon|txt)|knob)_/);
    }
  });

  it('is harmless to repeat, and to a pivot with no parent', () => {
    const player = new Object3D();
    const knob = part('knob', player);
    const tick = part('player_tick_0', knob);
    leaveOnDeck(knob);
    leaveOnDeck(knob);
    expect(tick.parent).toBe(player);
    expect(() => leaveOnDeck(new Object3D())).not.toThrow();
  });
});
