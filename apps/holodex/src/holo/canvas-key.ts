import type { HoloSelection } from './select';

export interface CanvasKeyInput {
  cardId: string;
  /** The card art the scene samples, or null when there is none. */
  src: string | null;
  selection: HoloSelection;
  /** HoloCard's rebuild counter, bumped when a lost context is restored. */
  generation: number;
}

/**
 * The React `key` of HoloCard's `<canvas>`, and the one dependency its scene
 * effect re-runs on — so a scene can never be rebuilt on a canvas an earlier
 * scene used.
 *
 * A canvas only ever has one WebGL context. A scene's `dispose()` calls
 * `renderer.forceContextLoss()` (browsers cap live contexts near 16, so it
 * must), and from then on `getContext()` on that canvas hands back the dead
 * context, which three.js's `WebGLRenderer` constructor throws on. A new key
 * mounts a new `<canvas>` element, and with it a fresh context.
 *
 * Every value the scene effect reads is here: the image it textures, the
 * six selection fields it sets, the card it logs, and `generation`. Leave
 * one out and a change to that value alone re-runs the effect on the canvas the
 * key kept — the bug this exists to prevent. JSON-encoded so that no two
 * different inputs can produce the same string.
 */
export function holoCanvasKey({ cardId, src, selection, generation }: CanvasKeyInput): string {
  return JSON.stringify([
    cardId,
    src,
    selection.effect,
    selection.shape,
    selection.layout,
    selection.invert,
    selection.glow,
    selection.foilBrightness,
    generation,
  ]);
}
