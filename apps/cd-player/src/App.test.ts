import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import type { InitialData } from './playback/engine';
import { createRouteController } from './route-controller';
import { DEFAULT_SKIN, skinById } from './skins';

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

  it("holds the scene's place with the loader, and leaves the way in for after the page settles", () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    expect(html).toContain('<div class="cdp-loader">');
    expect(html).toContain('<p class="cdp-loader__line">Loading the player</p>');
    expect(html).not.toContain('Open the player');
    // The presets' covers are the page's only pictures: the stage holds none.
    const stage = html.slice(
      html.indexOf('<div class="cdp-stage">'),
      html.indexOf('<div class="cdp-side">'),
    );
    expect(stage).not.toContain('<img');
    for (const img of html.match(/<img [^>]*>/g) ?? []) {
      expect(img).toMatch(/^<img class="cdp-preset__cover" [^>]*loading="lazy"/);
    }
  });
});

describe('App (the layout)', () => {
  it('renders the bar, the stage with the loader and the help line, then the card over the tracks', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    // The DOM order is the reading order, and Tab's: choose, the player, what plays, the list.
    const bar = html.indexOf('<header class="cdp-bar"');
    const stage = html.indexOf('<div class="cdp-stage">');
    const side = html.indexOf('<div class="cdp-side">');
    expect(bar).toBeGreaterThan(-1);
    expect(stage).toBeGreaterThan(bar);
    expect(side).toBeGreaterThan(stage);
    expect(html).toContain('<div class="cdp-stage"><div class="cdp-loader">');
    expect(html.indexOf('<p class="cdp-hud">')).toBeGreaterThan(stage);
    expect(html.indexOf('<p class="cdp-hud">')).toBeLessThan(side);
    expect(html).toContain('<div class="cdp-side"><section class="cdp-now"');
    expect(html.indexOf('<aside class="cdp-tracks"')).toBeGreaterThan(side);
  });
});

describe('App (the loader and the scene layer)', () => {
  it('draws the loader after the scene layer, so it fades out with the canvas', () => {
    // `.cdp-scene.is-live ~ .cdp-loader` (styles/app.css) matches only a loader that comes later in
    // the DOM than the scene layer. The server renders the waiting phase, which mounts no scene
    // layer, so its markup cannot show the order: it is read from the JSX instead.
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const scene = source.search(/<SceneHost\b/);
    const loader = source.search(/<Loader\b/);
    expect(scene, 'App.tsx renders <SceneHost>').toBeGreaterThan(-1);
    expect(loader, 'App.tsx renders <Loader> after <SceneHost>').toBeGreaterThan(scene);
  });
});

describe('App and the skins', () => {
  it('renders the default skin accent inline on the root, and Player closed', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    const { accent, onAccent } = skinById(DEFAULT_SKIN);
    expect(html).toMatch(
      new RegExp(
        `<div class="cdp-root"[^>]*style="--cdp-accent:${accent};--cdp-on-accent:${onAccent}"`,
      ),
    );
    expect(html).toContain('class="cdp-button cdp-skin__button" aria-expanded="false"');
  });
});
