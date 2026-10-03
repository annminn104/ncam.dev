import type { JSX } from 'react';
import type { ArenaId } from '../../../arenas-meta';
import type { BoardSkin } from '../Board';
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
}

export const ARENA_DEFS: Record<ArenaId, ArenaDef> = {
  'cloud-peak': {
    skin: ARENA_SKINS['cloud-peak'],
    background: CLOUD_PEAK_SKY.horizon,
    Environment: CloudPeak,
  },
  'blood-moon': {
    skin: ARENA_SKINS['blood-moon'],
    background: BLOOD_MOON_SKY.horizon,
    Environment: BloodMoon,
  },
  'lotus-lake': {
    skin: ARENA_SKINS['lotus-lake'],
    background: LOTUS_LAKE_SKY.horizon,
    Environment: LotusLake,
  },
};
