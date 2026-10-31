import { DEFAULT_COLLECTION, type CollectionRef } from './routes';

/** One playlist of "Popular on Spotify" (src/shell/Presets.tsx). */
export interface Preset {
  ref: CollectionRef;
  /** Spotify's own name for it. */
  name: string;
  /** What it plays, in a word or two: a genre does not drift as a track count does. */
  tag: string;
  /** Its cover, the embed page's `coverArt` on Spotify's CDN: hotlinked, never stored here. */
  cover: string;
}

const IMAGES = 'https://i.scdn.co/image/';

const playlist = (id: string, name: string, tag: string, cover: string): Preset => ({
  ref: { type: 'playlist', id },
  name,
  tag,
  cover,
});

/**
 * Twelve of Spotify's most followed playlists, each opened through the proxy when the list was
 * made (2026-10-31), the page's default first. Spotify renews some editorial covers; an old URL
 * keeps answering, and a new one is an edit here. A playlist Spotify retires answers 404, with the
 * message a pasted link gets: replace it here.
 */
export const PRESETS: readonly Preset[] = [
  {
    ref: DEFAULT_COLLECTION,
    name: 'Top 50 - Global',
    tag: 'Global chart',
    cover:
      'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_global_default.jpg',
  },
  playlist(
    '37i9dQZF1DXcBWIGoYBM5M',
    'Today’s Top Hits',
    'Pop',
    `${IMAGES}ab67706f00000002960019ea66cba66a44fdd4c2`,
  ),
  playlist(
    '37i9dQZF1DX0XUsuxWHRQd',
    'RapCaviar',
    'Hip-hop',
    `${IMAGES}ab67706f00000002876581e4be85838f0e1ad09d`,
  ),
  playlist(
    '37i9dQZF1DX0F4i7Q9pshJ',
    'Hot Hits Vietnam',
    'V-pop',
    `${IMAGES}ab67706f000000022ae3d1c33118a23660468485`,
  ),
  playlist(
    '37i9dQZF1DX10zKzsJ2jva',
    'Viva Latino',
    'Latin',
    `${IMAGES}ab67706f000000023b6ddcec7a45de2957049bd4`,
  ),
  playlist(
    '37i9dQZF1DX9tPFwDMOaN1',
    'K-Pop ON! (온)',
    'K-pop',
    `${IMAGES}ab67706f00000002c2e163f18888d6a2907c6f3d`,
  ),
  playlist(
    '37i9dQZF1DWXRqgorJj26U',
    'Rock Classics',
    'Rock',
    `${IMAGES}ab67706f00000002694bf33281695f3b7542a09a`,
  ),
  playlist(
    '37i9dQZF1DX4o1oenSJRJd',
    'All Out 2000s',
    '2000s',
    `${IMAGES}ab67706f00000002043bfef44142136749fc2917`,
  ),
  playlist(
    '37i9dQZF1DWWMOmoXKqHTD',
    'Songs to Sing in the Car',
    'Sing-along',
    `${IMAGES}ab67706f0000000292af799a11403259b8474500`,
  ),
  playlist(
    '37i9dQZF1DWWQRwui0ExPn',
    'lofi beats',
    'Lo-fi',
    `${IMAGES}ab67706f00000002266beb50b0032b0f140a749e`,
  ),
  playlist(
    '37i9dQZF1DX4sWSpwq3LiO',
    'Peaceful Piano',
    'Piano',
    `${IMAGES}ab67706f0000000270e1fb7db7b45809d6a80377`,
  ),
  playlist(
    '37i9dQZF1DX4WYpdgoIcn6',
    'Chill Hits',
    'Chill',
    `${IMAGES}ab67706f000000020408713c731caaf1f800615a`,
  ),
];
