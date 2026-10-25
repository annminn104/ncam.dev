/**
 * What a click does to a group of house and garden items (interaction spec §3.2). Every group starts on 'auto', today's
 * behaviour: lights, screens and the grill's coals follow the night, showers stay off, the door shut, the bedrooms' air
 * conditioners off, the jacuzzi (and the basement spa's hot tub, jacuzzi:spa), the fountain and the waterfall run, the
 * basement's karaoke party mode and its sauna stay off.
 */
export type ToggleState = 'auto' | 'on' | 'off';

/**
 * Group kinds whose lights and emissive materials a toggle drives (the rest show, hide or play something): the house's
 * room lights, string lights and screens, the garden's lights (lights:garden), the grill (bbq), whose coals glow, the
 * air conditioners (ac), whose status LED shows that a unit runs, and the basement's karaoke party mode (party: its TV,
 * its LED strips and the light they cast) and sauna (its stove's stones).
 */
export const GLOW_KINDS: ReadonlySet<string> = new Set([
  'light',
  'lights',
  'tv',
  'pc',
  'bbq',
  'ac',
  'party',
  'sauna',
]);
/**
 * Glowing group kinds that are off while auto, night or not: an air conditioner only runs when a click starts it, and so
 * do the party and the sauna.
 */
const IDLE_KINDS: ReadonlySet<string> = new Set(['ac', 'party', 'sauna']);
/** Group kinds whose emissive screens a toggle drives. */
const SCREEN_KINDS: ReadonlySet<string> = new Set(['tv', 'pc']);
/**
 * A screen switched on glows only this share of its night strength in full daylight: at full strength the sun's light
 * on top pushes it to white, and a lit screen should read as a blue-ish panel. It rises to the full strength with the
 * night factor, so the night look is unchanged.
 */
export const DAY_SCREEN_GLOW = 0.1;
/** Group kinds that run while on auto: the jacuzzi, the house's wall fountain and the koi pond's waterfall. */
const RUNNING_KINDS: ReadonlySet<string> = new Set(['jacuzzi', 'fountain', 'waterfall']);
/** From this night factor on, auto lights count as lit: a click then switches them off. */
const LIT_FROM = 0.5;

/**
 * Group kinds a click does something else to than toggle: koi, the pond's water, where a click feeds the fish, and the
 * one-shot kinds.
 */
const UNTOGGLED: ReadonlySet<string> = new Set(['koi', 'dog']);
/**
 * Group kinds whose act_ clip a click plays once from its start (the dog, the Akita, its act_dog_happy), where the door's
 * runs forwards to open and back to shut with its toggle.
 */
const ONE_SHOT_KINDS: ReadonlySet<string> = new Set(['dog']);

/** Whether a click toggles a group of `kind` (or does something else, interact/Interaction: feeds the koi, pets the dog). */
export function isToggled(kind: string): boolean {
  return !UNTOGGLED.has(kind);
}

/** Whether a click plays the clip of a group of `kind` once (interact/effects playOnce) instead of toggling it. */
export function playsOnce(kind: string): boolean {
  return ONE_SHOT_KINDS.has(kind);
}

/** A click: from auto to the opposite of what shows now (`litNow`), then on and off in turn. */
export function nextToggle(state: ToggleState, litNow: boolean): ToggleState {
  if (state === 'auto') return litNow ? 'off' : 'on';
  return state === 'on' ? 'off' : 'on';
}

/** Whether a group of `kind` shows its on look in `state` at `nightFactor`: lit, running, flowing, open. */
export function isOn(kind: string, state: ToggleState | undefined, nightFactor: number): boolean {
  if (state === 'on' || state === 'off') return state === 'on';
  if (IDLE_KINDS.has(kind)) return false;
  if (GLOW_KINDS.has(kind)) return nightFactor >= LIT_FROM;
  return RUNNING_KINDS.has(kind);
}

/**
 * How strongly a glowing group of `kind` shines, as a share of its exported intensity: the night factor while auto (an
 * idle kind's nothing), nothing when off, and when on full strength, except for a screen by day (DAY_SCREEN_GLOW).
 * Without a kind: a light.
 */
export function glowFactor(
  state: ToggleState | undefined,
  nightFactor: number,
  kind = 'light',
): number {
  if (state === 'off') return 0;
  if (state !== 'on') return IDLE_KINDS.has(kind) ? 0 : nightFactor;
  return SCREEN_KINDS.has(kind) ? DAY_SCREEN_GLOW + (1 - DAY_SCREEN_GLOW) * nightFactor : 1;
}

/** The hover hint under an item's label: what a click will do. */
export function hintFor(kind: string, on: boolean): string {
  if (kind === 'koi') return 'Click to feed the koi';
  if (kind === 'dog') return 'Click to play with the pup';
  if (kind === 'door') return on ? 'Click to close' : 'Click to open';
  return on ? 'Click to switch off' : 'Click to switch on';
}
