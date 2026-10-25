import type { JSX } from 'react';
import type { ArenaId } from '../../../arenas-meta';
import type { BoardSkin } from '../Board';
import type { CaptureView } from '../CaptureCamera';
import { BLOOD_MOON_SKY, BloodMoon } from './BloodMoon';
import { CLOUD_PEAK_SKY, CloudPeak } from './CloudPeak';
import { LOTUS_LAKE_SKY, LotusLake } from './LotusLake';
import { ARENA_SKINS } from './skins';

export interface ArenaDef {
  skin: BoardSkin;
  /** Canvas clear colour, matching the sky's horizon (and the arena's fog). */
  background: string;
  /** The arena's sky, fog, lights (one of them casting the shadows) and ambient effects. */
  Environment: () => JSX.Element;
  /**
   * The lobby preview's camera (capture mode, scripts/capture-arenas.mjs): the board with the
   * arena's sun or moon in the same 16:10 frame.
   */
  capture: CaptureView;
}

export const ARENA_DEFS: Record<ArenaId, ArenaDef> = {
  'cloud-peak': {
    skin: ARENA_SKINS['cloud-peak'],
    background: CLOUD_PEAK_SKY.horizon,
    Environment: CloudPeak,
    // From the white player's left, towards the dawn sun: the summit over the cloud sea.
    capture: { position: [-9.19, 4.5, 9.19], target: [0, 0.8, 0], fov: 60 },
  },
  'blood-moon': {
    skin: ARENA_SKINS['blood-moon'],
    background: BLOOD_MOON_SKY.horizon,
    Environment: BloodMoon,
    // Behind the white player, the moon on the canyon's rim and the lava on either side.
    capture: { position: [2.08, 5.5, 11.82], target: [0, 1.5, 0], fov: 58 },
  },
  'lotus-lake': {
    skin: ARENA_SKINS['lotus-lake'],
    background: LOTUS_LAKE_SKY.horizon,
    Environment: LotusLake,
    // Low over the white player's end, looking up enough for the moon over the lake.
    capture: { position: [-2.36, 3.2, 10.23], target: [0, 2.6, 0], fov: 52 },
  },
};
