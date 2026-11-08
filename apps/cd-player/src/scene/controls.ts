import type { PlayerAction } from '../actions';
import type { RequiredNode } from './contract';
import { TAP_SLOP_PX } from './orbit';

/** The deck's keys: the `btn_` nodes of the model contract (src/scene/contract.ts). */
export type ButtonNode = Extract<RequiredNode, `btn_${string}`>;

/** What each key does, by its GLB node. Mode is shuffle. */
export const BUTTON_ACTIONS: Readonly<Record<ButtonNode, PlayerAction>> = {
  btn_prev: { type: 'prev' },
  btn_next: { type: 'next' },
  btn_play: { type: 'toggle' },
  btn_stop: { type: 'stop' },
  btn_rpt: { type: 'repeat' },
  btn_mode: { type: 'shuffle' },
};

/** The keys, in the order above. */
export const BUTTON_NODES = Object.keys(BUTTON_ACTIONS) as ButtonNode[];

export type Hit = { kind: 'button'; node: ButtonNode; action: PlayerAction } | { kind: 'knob' };

interface Named {
  name: string;
  parent: Named | null;
}

const isButton = (name: string): name is ButtonNode => Object.hasOwn(BUTTON_ACTIONS, name);

/** The control a hit mesh belongs to: the first key or knob among it and its parents. */
export function hitFor(object: Named | null): Hit | null {
  for (let node = object; node; node = node.parent) {
    const { name } = node;
    if (isButton(name)) return { kind: 'button', node: name, action: BUTTON_ACTIONS[name] };
    if (name === 'knob') return { kind: 'knob' };
  }
  return null;
}

/**
 * Whether a press fires a key as it goes down: a mouse's or a pen's does. A touch's fires only as
 * it lifts, if it stayed a tap (`stillTap`), since a pinch's first finger may land on a key.
 */
export function pressesOnDown(pointerType: string): boolean {
  return pointerType !== 'touch';
}

/** A touch on a key, waiting to lift. */
export interface KeyTouch {
  id: number;
  node: ButtonNode;
  /** Where it went down (CSS px). */
  x: number;
  y: number;
  /** interaction.pinches as it went down: a pinch begun since lets go of it. */
  pinches: number;
}

/**
 * Whether a pinch has begun since a touch went down, `since` being interaction.pinches then and
 * `pinches` now: the count only grows, so a second finger that has already lifted still counts.
 * A key's touch and a knob's turn that saw one begin let go.
 */
export function pinchedSince(since: number, pinches: number): boolean {
  return pinches !== since;
}

/**
 * Whether `touch`, seen at (x, y) with `pinches` pinches begun so far, is still a tap: within the
 * slop of where it went down (a drag presses nothing) and no pinch begun since.
 */
export function stillTap(touch: KeyTouch, x: number, y: number, pinches: number): boolean {
  return (
    !pinchedSince(touch.pinches, pinches) && Math.hypot(x - touch.x, y - touch.y) <= TAP_SLOP_PX
  );
}

/** The iFrame API has no volume, so the knob scrubs: one full turn is this much time. */
export const KNOB_MS_PER_TURN = 30_000;

export function knobSeekMs(deltaRad: number): number {
  return Math.round((deltaRad / (2 * Math.PI)) * KNOB_MS_PER_TURN);
}

/**
 * What the display shows during a turn of the knob: the position plus the turn's seek, held
 * between 0 and the duration (only above 0 while the duration is unknown). With no turn going on,
 * the position.
 */
export function scrubTargetMs(
  positionMs: number,
  durationMs: number,
  scrubMs: number | null,
): number {
  if (scrubMs === null) return positionMs;
  const target = Math.max(0, positionMs + scrubMs);
  return durationMs > 0 ? Math.min(durationMs, target) : target;
}

/** A press on the knob turns it only while its model's door is shut (the deck's jog is the door). */
export function knobTakesTurn(doorOpen: number): boolean {
  return doorOpen === 0;
}

/** The spin after a finished turn the disc followed, within one revolution. */
export function foldTurn(spin: number, turn: number): number {
  const full = 2 * Math.PI;
  return (((spin + turn) % full) + full) % full;
}

/** How long a pressed key takes to sink and come back (ms). */
export const PRESS_MS = 160;

/** How far a pressed key sinks (metres), `elapsedMs` after the press. */
export function pressDepth(elapsedMs: number): number {
  const t = elapsedMs / PRESS_MS;
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) * 0.0012;
}

/** The shortest signed turn from `from` to `to` (radians). */
export function angleDelta(from: number, to: number): number {
  const d = to - from;
  return Math.atan2(Math.sin(d), Math.cos(d));
}
