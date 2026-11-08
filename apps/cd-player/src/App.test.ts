import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import { DEFAULT_CLEAR_LOOK } from './clear-looks';
import { DEFAULT_LOOK_STATE, lookAccent, lookOf, type LookState } from './looks';
import { LOOK_SCRIPT } from './persist';
import type { InitialData } from './playback/engine';
import { createRouteController } from './route-controller';
import { DEFAULT_SKIN, skinById } from './skins';
import { textOf } from './testing/markup';

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

describe('App and the view (zoom)', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

  it('says how to zoom on the help line', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    expect(textOf(/<p class="cdp-hud">[\s\S]*?<\/p>/.exec(html)?.[0] ?? '')).toBe(
      'Space play or pause · N next · P previous · drag to look around · scroll or pinch to zoom',
    );
  });

  it('leaves the view’s buttons out of the server’s markup: they come once the scene is live', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    expect(html).not.toContain('cdp-zoom');
    expect(html).not.toContain('Zoom in');
    // In the stage, after the help line, and only once live (read from the JSX: the server renders
    // the waiting phase).
    const stage = source.indexOf('<div className="cdp-stage">');
    const buttons = source.indexOf('{live && <ZoomControls camera={camera} />}');
    expect(buttons).toBeGreaterThan(source.indexOf('<Hud />'));
    expect(buttons).toBeGreaterThan(stage);
    expect(buttons).toBeLessThan(source.indexOf('<div className="cdp-side">'));
  });

  it('hands the scene the camera’s channel, made once per mount, as it hands it the bridge', () => {
    expect(source).toMatch(/const \[camera\] = useState\(createCameraChannel\);/);
    expect(source).toMatch(/<SceneHost[^>]*\bcamera=\{camera\}/);
  });

  it('sends +, - and 0 to the camera from the page’s key handler, behind its guards', () => {
    // Ctrl, ⌘ or Alt, a field or a focused control, and a held key all come first (src/keys.ts
    // maps the keys).
    const handler = /const onKey = \(event: KeyboardEvent\) => \{([\s\S]*?)\n {4}\};/.exec(
      source,
    )?.[1];
    const order = [
      'if (event.metaKey || event.ctrlKey || event.altKey) return;',
      'if (target?.closest?.(\'input, textarea, select, button, [contenteditable="true"]\')) return;',
      'const command = keyCommand(event);',
      'if (event.repeat) return;',
      'else if (live) camera.send(command);',
    ].map((line) => handler?.indexOf(line) ?? -1);
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('keeps the view’s keys, like its buttons, for a live scene, so it never comes live zoomed', () => {
    // The camera listens from the moment the scene mounts, while it still boots unseen.
    expect(source).toMatch(/\}, \[act, camera, live\]\);/);
    expect(source.match(/camera\.send\(/g)).toHaveLength(1);
  });
});

describe('App and the presets', () => {
  it('marks the collection on show as the current preset in the server markup', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(
      /class="cdp-preset is-current" aria-current="true">[\s\S]*?Top 50 - Global/,
    );
  });

  it('stops the link loader as it unmounts, so a late load neither saves nor navigates', () => {
    // No effect runs in a server render: the wiring is read from the source, as the loader's
    // place is below (src/link-loader.test.ts holds what a stopped loader does).
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*loader\.start\(\);\s*return loader\.stop;\s*\}, \[loader\]\);/,
    );
    expect(source).toMatch(/open: \(next\) => engine\.open\(next\)/);
  });

  it('marks none while nothing is on show, so the default can be pressed after a failure', () => {
    const html = renderToString(
      createElement(App, {
        controller: createRouteController({ route: '/' }),
        initial: { ...initial, collection: null, firstTrack: null },
      }),
    );
    expect(html).not.toContain('aria-current');
  });
});

describe('App (the loader and the scene layer)', () => {
  it('draws the loader after the scene layer, so it fades out with the canvas', () => {
    // `.cdp-scene.is-live ~ .cdp-loader` (styles/app.css) matches only a loader that comes later in
    // the DOM than the scene layer. The server renders the waiting phase, which mounts no scene
    // layer, so its markup cannot show the order: it is read from the JSX instead.
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const stage = source.indexOf('<div className="cdp-stage">');
    const side = source.indexOf('<div className="cdp-side">');
    const scene = source.search(/<SceneHost\b/);
    const loader = source.search(/<Loader\b/);
    expect(scene, 'App.tsx renders <SceneHost>').toBeGreaterThan(-1);
    expect(loader, 'App.tsx renders <Loader> after <SceneHost>').toBeGreaterThan(scene);
    // Siblings in the stage, which the `~` selector needs, and the canvas fills (styles/app.css).
    expect(scene, '<SceneHost> inside the stage').toBeGreaterThan(stage);
    expect(stage, 'the stage before the side column').toBeLessThan(side);
    expect(loader, '<Loader> inside the stage').toBeLessThan(side);
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

  it('opens the root with LOOK_SCRIPT, so the saved accent is painted before the rest parses', () => {
    const html = renderToString(
      createElement(App, { controller: createRouteController({ route: '/' }), initial }),
    );
    const open = /<div class="cdp-root"[^>]*>/.exec(html);
    expect(open).not.toBeNull();
    const after = html.slice((open?.index ?? 0) + (open?.[0].length ?? 0));
    expect(after.startsWith(`<script>${LOOK_SCRIPT}</script>`)).toBe(true);
  });

  it('starts in the look it is given, the Clear model’s light as the accent, with no script', () => {
    const look: LookState = {
      ...DEFAULT_LOOK_STATE,
      model: 'clear',
      clear: { ...DEFAULT_CLEAR_LOOK, light: 'pink' },
    };
    const html = renderToString(
      createElement(App, {
        controller: createRouteController({ route: '/' }),
        initial,
        initialLook: look,
      }),
    );
    const { accent, onAccent } = lookAccent(lookOf(look));
    expect(html).toContain(`style="--cdp-accent:${accent};--cdp-on-accent:${onAccent}"`);
    // Its markup is already in the saved look; a script it rendered would never run on the client.
    expect(html).not.toContain(LOOK_SCRIPT);
  });
});

describe('App and the model on the stage', () => {
  it('keeps a model through the keeper, which follows the scene’s stage, never the phase', () => {
    // The scene reports through effects and callbacks a server render never runs: the wiring is
    // read from the source, as the loader's place is above (model-keeper.test.ts holds what the
    // keeper keeps: a choice at once while nothing is on the stage, a change once it is drawn).
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(
      /const \[keeper\] = useState\(\(\) =>\s*createModelKeeper\(\(model\) => writeModel\(safeStorage\(\), model\)\),?\s*\);/,
    );
    // The keeper's is the only write of a model.
    expect(source.match(/writeModel\(/g)).toHaveLength(1);
    expect(source).toMatch(
      /writeClearLook\(storage, next\.clear\);\s*(\/\/[^\n]*\n\s*)*keeper\.choose\(next\.model\);/,
    );
    expect(source).toMatch(
      /if \(load\.status === 'ready'\) \{[^}]*\bkeeper\.drawn\(load\.model\);[^}]*\}/,
    );
    // The stage, as the scene tells it, the boot's first swap included.
    expect(source).toMatch(/keeper\.stage\(model\);/);
    expect(source).toMatch(/onStage=\{onStage\}/);
  });

  it('goes back to the model on the stage when a change fails, before the boot’s model is drawn too', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(
      /if \(load\.status === 'failed'\) \{\s*const back = keeper\.staged;\s*if \(back\) setLookState\(\(state\) => \(\{ \.\.\.state, model: back \}\)\);/,
    );
    expect(source).not.toMatch(/shownModel/);
  });

  it('ends the boot’s stall watch once its model takes the stage: its first frames are all it waits on', () => {
    // A hidden page draws no frames, and is no stalled boot.
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(
      /const onStage = useCallback\(\s*\(model: ModelId \| null\) => \{\s*keeper\.stage\(model\);\s*if \(model !== null\) stall\.current\?\.stop\(\);/,
    );
    expect(source).toMatch(
      /watchStall\(\(part\) => onFail\(new BootStallError\(part\)\), PAGE_TIMERS\)/,
    );
  });

  it('makes the root’s accent from the model on show once live, never the chosen one alone', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/accentModelFor\(\s*live,\s*onShow,\s*lookState\.model\s*\)/);
    // A `ready` notes the model on show, which turns the page as it comes.
    expect(source).toMatch(
      /if \(load\.status === 'ready'\) \{[^}]*\bsetOnShow\(load\.model\);[^}]*\}/,
    );
  });
});
