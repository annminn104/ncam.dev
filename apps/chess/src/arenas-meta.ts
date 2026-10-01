import { assetUrl } from './lib/asset-url';

export type ArenaId = 'cloud-peak' | 'blood-moon' | 'lotus-lake';

export interface ArenaMeta {
  id: ArenaId;
  name: string;
  lore: string;
  accent: string;
  /** Painted behind the preview image, and alone if it fails to load. */
  fallback: string;
}

export const ARENAS: readonly ArenaMeta[] = [
  {
    id: 'cloud-peak',
    name: 'Jade Cloud Peak',
    lore: 'A floating summit above a sea of clouds, where the Righteous Sect trains at dawn.',
    accent: '#7fd6b5',
    fallback: 'linear-gradient(180deg,#bfe3f2 0%,#f4efe2 55%,#d9e8e2 100%)',
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon Abyss',
    lore: 'A demonic canyon of molten stone under a crimson moon.',
    accent: '#e0475b',
    fallback: 'linear-gradient(180deg,#14060a 0%,#3a0d14 55%,#ff6a2a 100%)',
  },
  {
    id: 'lotus-lake',
    name: 'Lotus Moon Lake',
    lore: 'A still mirror lake at dusk, lit by fireflies and a pale blue moon.',
    accent: '#8fb7ff',
    fallback: 'linear-gradient(180deg,#1b2440 0%,#3b4a7a 55%,#9fb7d8 100%)',
  },
];

export function arenaPreview(id: ArenaId, width: 320 | 640, base: string): string {
  return assetUrl(`arenas/${id}-${width}.avif`, base);
}
