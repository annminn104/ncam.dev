const wrap = (data: unknown) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;

/** An embed page as Spotify serves it: the entity inside __NEXT_DATA__ (fields measured 2026-10-28). */
export function page(entity: unknown): string {
  return wrap({ props: { pageProps: { state: { data: { entity } } } } });
}

/** The page for an unknown id: HTTP 200, no `state`, only a 404 status (measured 2026-10-29). */
export function notFoundPage(): string {
  return wrap({ props: { pageProps: { status: 404, title: 'Page not found' } } });
}

export const PLAYLIST = {
  type: 'playlist',
  id: '37i9dQZEVXbMDoHDwVN2tF',
  name: 'Top 50 - Global',
  subtitle: 'Spotify',
  trackList: [
    {
      uri: 'spotify:track:2sFepQNyl1WjpROruP8bJ0',
      uid: 'a',
      title: 'Housewife',
      subtitle: 'Tate McRae',
      isExplicit: false,
      duration: 208810,
      isPlayable: true,
      audioPreview: { format: 'MP3_96', url: 'https://p.scdn.co/mp3-preview/x' },
      entityType: 'track',
    },
    {
      uri: 'spotify:track:3h5T5JypYU7huFiVYhv1dr',
      uid: 'b',
      title: 'BbY WOW',
      subtitle: 'KAROL G, Judeline, rusowsky',
      isExplicit: true,
      duration: 225834,
      isPlayable: false,
      entityType: 'track',
    },
    {
      uri: 'spotify:episode:0000000000000000000000',
      title: 'An episode',
      subtitle: 'A show',
      duration: 1,
    },
  ],
};

export const TRACK = {
  type: 'track',
  id: '2sFepQNyl1WjpROruP8bJ0',
  name: 'Housewife',
  artists: [{ name: 'Tate McRae', uri: 'spotify:artist:45dkTj5sMRSjrmBSBeiHym' }],
  visualIdentity: {
    backgroundBase: { alpha: 255, blue: 32, green: 24, red: 152 },
    backgroundTintedBase: { alpha: 255, blue: 1, green: 0, red: 92 },
    textBase: { alpha: 255, blue: 255, green: 255, red: 255 },
    image: [
      { url: 'https://image-cdn-ak.spotifycdn.com/image/300', maxWidth: 300, maxHeight: 300 },
      { url: 'https://image-cdn-ak.spotifycdn.com/image/64', maxWidth: 64, maxHeight: 64 },
      { url: 'https://image-cdn-ak.spotifycdn.com/image/640', maxWidth: 640, maxHeight: 640 },
    ],
  },
};

export const ARTIST = {
  type: 'artist',
  id: '45dkTj5sMRSjrmBSBeiHym',
  name: 'Tate McRae',
  visualIdentity: {
    backgroundBase: { alpha: 255, blue: 116, green: 87, red: 40 },
    image: [
      { url: 'https://image-cdn-fa.spotifycdn.com/image/320', width: 320 },
      { url: 'https://image-cdn-fa.spotifycdn.com/image/640', width: 640 },
    ],
  },
};
