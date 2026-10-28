/** What a visitor does on the 3D player, sent from the scene to the app. */
export type PlayerAction =
  | { type: 'prev' }
  | { type: 'next' }
  | { type: 'toggle' }
  | { type: 'stop' }
  | { type: 'repeat' }
  | { type: 'shuffle' }
  /** The knob, turned: seek by this much (there is no volume to turn). */
  | { type: 'seek'; deltaMs: number };
