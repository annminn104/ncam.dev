import { SPOTIFY_ID } from '../routes.js';
import { EmbedError, loadArtist, loadCollection, loadTrack } from '../spotify/embed.js';

/**
 * `GET /api/spotify?type=<playlist|album|track|artist>&id=<id>`: Spotify's embed data as this
 * remote's JSON. Served by the Vercel Function (api/spotify.ts) and by the Vite dev and preview
 * servers (vite.config.ts). The server render calls src/spotify/embed.ts directly instead.
 */
const TYPES = new Set(['playlist', 'album', 'track', 'artist']);
const CORS = { 'Access-Control-Allow-Origin': '*' };
/** "Top 50" changes daily: collections are shared for an hour, served stale for a day. */
const CACHE_COLLECTION = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_ITEM = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_MISSING = 'public, max-age=60, s-maxage=300';

function json(status: number, body: unknown, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

export async function handleSpotify(
  request: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { ...CORS, Allow: 'GET, HEAD, OPTIONS' } });
  }
  const params = new URL(request.url).searchParams;
  const type = params.get('type') ?? '';
  const id = params.get('id') ?? '';
  if (!TYPES.has(type) || !SPOTIFY_ID.test(id)) {
    return json(400, { error: 'bad_request' }, 'no-store');
  }
  try {
    if (type === 'playlist' || type === 'album') {
      return json(200, await loadCollection({ type, id }, fetchImpl), CACHE_COLLECTION);
    }
    const body =
      type === 'track' ? await loadTrack(id, fetchImpl) : await loadArtist(id, fetchImpl);
    return json(200, body, CACHE_ITEM);
  } catch (error) {
    if (error instanceof EmbedError && error.kind === 'not_found') {
      return json(404, { error: 'not_found' }, CACHE_MISSING);
    }
    return json(502, { error: 'upstream' }, 'no-store');
  }
}
