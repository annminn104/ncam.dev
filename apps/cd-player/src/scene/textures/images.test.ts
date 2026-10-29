import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * An `Image` that loads by itself (as a cached one would) unless `hold` is set, when it waits for
 * the test to load or fail it; every request is kept.
 */
class FakeImage {
  static requests: FakeImage[] = [];
  static hold = false;
  crossOrigin = '';
  decoding = '';
  url = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    this.url = url;
    FakeImage.requests.push(this);
    if (!FakeImage.hold) queueMicrotask(() => this.onload?.());
  }
}

/** The module with an empty cache (it keeps one for the page's life) and the fake `Image`. */
async function fresh() {
  vi.resetModules();
  FakeImage.requests = [];
  FakeImage.hold = false;
  vi.stubGlobal('Image', FakeImage);
  return import('./images');
}

/** How many times `url` has been asked for. */
const askedFor = (url: string) =>
  FakeImage.requests.filter((request) => request.url === url).length;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadImage', () => {
  it('asks for each address once, anonymously, and gives every caller the same image', async () => {
    const images = await fresh();
    const first = images.loadImage('a');
    const second = images.loadImage('a');
    expect(FakeImage.requests.map((request) => request.url)).toEqual(['a']);
    expect(FakeImage.requests[0].crossOrigin).toBe('anonymous');
    expect(await first).toBe(await second);
    await images.loadImage('a');
    expect(askedFor('a')).toBe(1);
  });

  it('does not keep a failed load: the next call asks again', async () => {
    const images = await fresh();
    FakeImage.hold = true;
    const failing = images.loadImage('a');
    FakeImage.requests[0].onerror?.();
    await expect(failing).rejects.toThrow('could not load a');
    const retry = images.tryImage('a');
    FakeImage.requests[1].onerror?.();
    await expect(retry).resolves.toBeNull();
    expect(askedFor('a')).toBe(2);
  });

  it('keeps the most recent images only, and drops the oldest first', async () => {
    const images = await fresh();
    for (let i = 0; i <= images.IMAGE_CACHE_LIMIT; i++) await images.loadImage(`u${i}`);
    // The oldest is gone, so it is asked for again; the newest are still there.
    await images.loadImage('u0');
    await images.loadImage('u2');
    expect(askedFor('u0')).toBe(2);
    expect(askedFor('u2')).toBe(1);
  });

  it('counts a use as recent: the image looked at again outlives an older one', async () => {
    const images = await fresh();
    for (let i = 0; i < images.IMAGE_CACHE_LIMIT; i++) await images.loadImage(`u${i}`);
    await images.loadImage('u0');
    await images.loadImage('new');
    // `u1` is the oldest now that `u0` was used again.
    await images.loadImage('u1');
    await images.loadImage('u0');
    expect(askedFor('u0')).toBe(1);
    expect(askedFor('u1')).toBe(2);
  });

  it("lets an evicted load's failure leave the entry that replaced it alone", async () => {
    const images = await fresh();
    FakeImage.hold = true;
    void images.loadImage('slow').catch(() => {});
    const slow = FakeImage.requests[0];
    // Enough others to push it out while it is still loading, then ask for it again.
    FakeImage.hold = false;
    for (let i = 0; i < images.IMAGE_CACHE_LIMIT; i++) await images.loadImage(`u${i}`);
    FakeImage.hold = true;
    const again = images.loadImage('slow');
    expect(askedFor('slow')).toBe(2);
    slow.onerror?.();
    const hit = images.loadImage('slow');
    expect(askedFor('slow')).toBe(2);
    FakeImage.requests.at(-1)?.onload?.();
    expect(await hit).toBe(await again);
  });
});

describe('tryImage', () => {
  it('answers null with no address, without asking', async () => {
    const images = await fresh();
    await expect(images.tryImage(null)).resolves.toBeNull();
    await expect(images.tryImage('')).resolves.toBeNull();
    expect(FakeImage.requests).toEqual([]);
  });
});
