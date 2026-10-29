import type { Object3D } from 'three';
import type { PlayerAction } from '../actions';

/** The deck's keys, by their GLB node (src/scene/contract.ts). Mode is shuffle. */
export const BUTTON_ACTIONS: Readonly<Record<string, PlayerAction>> = {
  btn_prev: { type: 'prev' },
  btn_next: { type: 'next' },
  btn_play: { type: 'toggle' },
  btn_stop: { type: 'stop' },
  btn_rpt: { type: 'repeat' },
  btn_mode: { type: 'shuffle' },
};

export type Hit = { kind: 'button'; node: string; action: PlayerAction } | { kind: 'knob' };

interface Named {
  name: string;
  parent: Named | null;
}

/** The control a hit mesh belongs to: the first key or knob among it and its parents. */
export function hitFor(object: Named | null): Hit | null {
  for (let node = object; node; node = node.parent) {
    const action = BUTTON_ACTIONS[node.name];
    if (action) return { kind: 'button', node: node.name, action };
    if (node.name === 'knob') return { kind: 'knob' };
  }
  return null;
}

/**
 * What the model hangs from the pivot of a key or the knob although it is printed on the deck: the
 * dark ring around a key and its label, the dial's ticks and its name.
 */
const PRINTED = /^player_(btn_gap_|btn_lbl_|tick_|vol$)/;

/** Hands a pivot's printed marks to the deck, so that only the key or the knob itself moves. */
export function leaveOnDeck(pivot: Object3D): void {
  const deck = pivot.parent;
  if (!deck) return;
  for (const child of [...pivot.children]) {
    if (PRINTED.test(child.name)) deck.attach(child);
  }
}

/** The iFrame API has no volume, so the knob scrubs: one full turn is this much time. */
export const KNOB_MS_PER_TURN = 30_000;

export function knobSeekMs(deltaRad: number): number {
  return Math.round((deltaRad / (2 * Math.PI)) * KNOB_MS_PER_TURN);
}

/** How far a pressed key sinks (metres), `elapsedMs` after the press. */
export function pressDepth(elapsedMs: number): number {
  const t = elapsedMs / 160;
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) * 0.0012;
}

/** The shortest signed turn from `from` to `to` (radians). */
export function angleDelta(from: number, to: number): number {
  const d = to - from;
  return Math.atan2(Math.sin(d), Math.cos(d));
}
