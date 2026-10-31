import { describe, expect, it, vi } from 'vitest';
import { createLinkLoader, IDLE_LINK, type LinkLoaderDeps, type LinkState } from './link-loader';
import type { CollectionRef } from './routes';
import { SpotifyRequestError } from './spotify/client';

const RAP: CollectionRef = { type: 'playlist', id: '37i9dQZF1DX0XUsuxWHRQd' };
const ROCK: CollectionRef = { type: 'playlist', id: '37i9dQZF1DWXRqgorJj26U' };

/** A collection request the test answers itself, when it chooses. */
interface Asked {
  ref: CollectionRef;
  answer(): void;
  fail(error: unknown): void;
}

function setup(route = '/') {
  const asked: Asked[] = [];
  const client = {
    collection: vi.fn(
      (ref: CollectionRef) =>
        new Promise<never>((resolve, reject) => {
          asked.push({ ref, answer: () => resolve(undefined as never), fail: reject });
        }),
    ),
  } as unknown as LinkLoaderDeps['client'];
  const controller = {
    route,
    getRoute: () => controller.route,
    navigate: vi.fn((to: string) => {
      controller.route = to;
    }),
  };
  const save = vi.fn();
  const states: LinkState[] = [];
  const loader = createLinkLoader({ client, controller, save }, (state) => states.push(state));
  /** Lets the loader's own continuation run after an answer. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { loader, client, controller, save, states, asked, settle };
}

describe('the link loader', () => {
  it('fetches first, then saves the collection as the last and navigates there', async () => {
    const { loader, controller, save, states, asked, settle } = setup();
    void loader.load(RAP, 'preset');
    expect(states.at(-1)).toEqual({ pending: RAP, error: null });
    expect(save).not.toHaveBeenCalled();
    expect(controller.navigate).not.toHaveBeenCalled();
    asked[0].answer();
    await settle();
    expect(save).toHaveBeenCalledWith(RAP);
    expect(controller.navigate).toHaveBeenCalledWith(`/playlist/${RAP.id}`);
    expect(states.at(-1)).toEqual(IDLE_LINK);
  });

  it('keeps one load at a time: a choice made while one loads is dropped', async () => {
    const { loader, client, controller, asked, settle } = setup();
    void loader.load(RAP, 'preset');
    void loader.load(ROCK, 'preset');
    void loader.load(ROCK, 'link');
    expect(client.collection).toHaveBeenCalledTimes(1);
    asked[0].answer();
    await settle();
    expect(controller.navigate).toHaveBeenCalledTimes(1);
    expect(controller.navigate).toHaveBeenCalledWith(`/playlist/${RAP.id}`);
    // Once it is over, the next choice loads.
    void loader.load(ROCK, 'preset');
    expect(client.collection).toHaveBeenCalledTimes(2);
  });

  it('drops a load that lands after the page moved on, saving nothing', async () => {
    const { loader, controller, save, states, asked, settle } = setup(`/playlist/${ROCK.id}`);
    void loader.load(RAP, 'preset');
    // The visitor presses Back while it loads: the route moves without it.
    controller.route = '/';
    asked[0].answer();
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(controller.navigate).not.toHaveBeenCalled();
    expect(controller.route).toBe('/');
    expect(states.at(-1)).toEqual(IDLE_LINK);
  });

  it('drops a load that lands once the App has gone, and tells it nothing more', async () => {
    const { loader, controller, save, states, asked, settle } = setup();
    void loader.load(RAP, 'preset');
    const told = states.length;
    loader.stop();
    asked[0].answer();
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(controller.navigate).not.toHaveBeenCalled();
    expect(states).toHaveLength(told);
  });

  it('loads again once shown again: StrictMode stops and starts it on mount', async () => {
    const { loader, controller, asked, settle } = setup();
    loader.stop();
    loader.start();
    void loader.load(RAP, 'preset');
    asked[0].answer();
    await settle();
    expect(controller.navigate).toHaveBeenCalledWith(`/playlist/${RAP.id}`);
  });

  it('says why a load failed, offering Retry only where trying again may help', async () => {
    const { loader, controller, save, states, asked, settle } = setup();
    void loader.load(RAP, 'preset');
    asked[0].fail(new SpotifyRequestError('upstream', 502));
    await settle();
    expect(states.at(-1)).toEqual({
      pending: null,
      error: { message: "Spotify didn't answer. Try again in a moment.", retry: RAP, field: false },
    });
    void loader.load(ROCK, 'preset');
    asked[1].fail(new SpotifyRequestError('not_found', 404));
    await settle();
    expect(states.at(-1)?.error).toEqual({
      message: "We couldn't open that playlist. It may be private or deleted.",
      retry: null,
      field: false,
    });
    expect(save).not.toHaveBeenCalled();
    expect(controller.navigate).not.toHaveBeenCalled();
  });

  it('lays a failure at the field only when a pasted link failed', async () => {
    const { loader, states, asked, settle } = setup();
    void loader.load(RAP, 'link');
    asked[0].fail(new TypeError('Failed to fetch'));
    await settle();
    expect(states.at(-1)?.error).toEqual({
      message: "Spotify didn't answer. Try again in a moment.",
      retry: RAP,
      field: true,
    });
    loader.refuse('That link is not a playlist or an album.');
    expect(states.at(-1)).toEqual({
      pending: null,
      error: { message: 'That link is not a playlist or an album.', retry: null, field: true },
    });
  });

  it('clears the last failure as the next load starts', async () => {
    const { loader, states, asked, settle } = setup();
    void loader.load(RAP, 'preset');
    asked[0].fail(new SpotifyRequestError('upstream', 502));
    await settle();
    void loader.load(RAP, 'preset');
    expect(states.at(-1)).toEqual({ pending: RAP, error: null });
  });
});
