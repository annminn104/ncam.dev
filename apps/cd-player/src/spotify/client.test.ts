import { describe, expect, it, vi } from 'vitest';
import { createSpotifyClient, requestErrorMessage, SpotifyRequestError } from './client';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const ID = '37i9dQZEVXbMDoHDwVN2tF';

describe('createSpotifyClient', () => {
  it('asks the proxy at the root of the remote origin', async () => {
    const fetchImpl = vi.fn(async () => ok({ name: 'x' }));
    const client = createSpotifyClient('http://localhost:9011/some/base/', fetchImpl);
    await client.collection({ type: 'album', id: ID });
    expect(fetchImpl).toHaveBeenCalledWith(`http://localhost:9011/api/spotify?type=album&id=${ID}`);
  });

  it('shares one request per item and keeps the answer', async () => {
    const fetchImpl = vi.fn(async () => ok({ id: 't' }));
    const client = createSpotifyClient('http://localhost:9011/', fetchImpl);
    const [a, b] = await Promise.all([client.track('t'), client.track('t')]);
    expect(a).toBe(b);
    await client.track('t');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('forgets a failure so the next call asks again', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(ok({ id: 'a' }));
    const client = createSpotifyClient('http://localhost:9011/', fetchImpl);
    await expect(client.artist('a')).rejects.toMatchObject({ code: 'upstream', status: 502 });
    await expect(client.artist('a')).resolves.toEqual({ id: 'a' });
  });

  it('maps statuses and network failures to codes', async () => {
    const statuses: [number, string][] = [
      [400, 'bad_request'],
      [404, 'not_found'],
      [500, 'upstream'],
    ];
    for (const [status, code] of statuses) {
      const client = createSpotifyClient('http://x/', async () => new Response('{}', { status }));
      await expect(client.track('t')).rejects.toMatchObject({ code });
    }
    const offline = createSpotifyClient('http://x/', async () => {
      throw new TypeError('offline');
    });
    await expect(offline.track('t')).rejects.toMatchObject({ code: 'network', status: 0 });
  });

  it('answers seeded items without asking', async () => {
    const fetchImpl = vi.fn();
    const client = createSpotifyClient('http://x/', fetchImpl);
    client.seed('track', 't', { id: 't' });
    await expect(client.track('t')).resolves.toEqual({ id: 't' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('words errors for people, naming what could not be opened', () => {
    const missing = new SpotifyRequestError('not_found', 404);
    expect(requestErrorMessage(missing, 'playlist')).toBe(
      "We couldn't open that playlist. It may be private or deleted.",
    );
    expect(requestErrorMessage(missing, 'album')).toBe(
      "We couldn't open that album. It may be private or deleted.",
    );
    expect(requestErrorMessage(new SpotifyRequestError('upstream', 502), 'album')).toMatch(
      /try again/i,
    );
    expect(requestErrorMessage(new Error('x'), 'playlist')).toMatch(/try again/i);
  });
});
