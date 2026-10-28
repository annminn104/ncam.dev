import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import type { InitialData } from './playback/engine';
import { createRouteController } from './route-controller';

const initial: InitialData = {
  ref: { type: 'playlist', id: '37i9dQZEVXbMDoHDwVN2tF' },
  collection: {
    type: 'playlist',
    id: '37i9dQZEVXbMDoHDwVN2tF',
    name: 'Top 50 - Global',
    subtitle: 'Spotify',
    tracks: [
      {
        id: 'a',
        uri: 'spotify:track:a',
        title: 'Housewife',
        artists: 'Tate McRae',
        durationMs: 208_810,
        playable: true,
        explicit: false,
      },
      {
        id: 'b',
        uri: 'spotify:track:b',
        title: 'BbY WOW',
        artists: 'KAROL G',
        durationMs: 225_834,
        playable: false,
        explicit: true,
      },
    ],
  },
  firstTrack: {
    id: 'a',
    art: [{ url: 'https://image-cdn-ak.spotifycdn.com/image/640', width: 640 }],
    palette: {
      background: 'rgb(152, 24, 32)',
      tinted: 'rgb(92, 0, 1)',
      text: 'rgb(255, 255, 255)',
    },
    artists: [{ id: 'x', name: 'Tate McRae' }],
  },
  firstArtist: null,
};

describe('App (server render)', () => {
  it('renders the collection, its tracks, the backdrop and the play prompt', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    expect(html).toContain('Top 50 - Global');
    expect(html).toContain('Housewife');
    expect(html).toContain('3:28');
    expect(html).toContain('image-cdn-ak.spotifycdn.com/image/640');
    expect(html).toContain('Press play to connect Spotify');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*BbY WOW/s);
  });

  it('renders a loading state without data', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }) }),
    );
    expect(html).toContain('Loading');
  });
});
