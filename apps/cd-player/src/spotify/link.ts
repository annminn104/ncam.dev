import { SPOTIFY_ID, type CollectionRef } from '../routes';

export type LinkFailure = 'empty' | 'unsupported' | 'invalid';
export type LinkResult = { ok: true; ref: CollectionRef } | { ok: false; reason: LinkFailure };

const HOSTS = new Set(['open.spotify.com', 'play.spotify.com']);
const OTHER_KINDS = new Set(['track', 'artist', 'episode', 'show', 'user']);
const URI = /^spotify:([a-z]+):([A-Za-z0-9]{22})$/;

function kindResult(kind: string, id: string): LinkResult {
  if (!SPOTIFY_ID.test(id)) return { ok: false, reason: 'invalid' };
  if (kind === 'playlist' || kind === 'album') return { ok: true, ref: { type: kind, id } };
  return { ok: false, reason: OTHER_KINDS.has(kind) ? 'unsupported' : 'invalid' };
}

/**
 * A playlist or album from what a visitor pastes: an open.spotify.com link (with or without
 * `https://`, `intl-xx/`, `embed/` or a query string), a `spotify:` URI, or a bare 22-character id,
 * which is taken as a playlist. Short `spotify.link` URLs are not followed.
 */
export function parseSpotifyLink(input: string): LinkResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (SPOTIFY_ID.test(text)) return { ok: true, ref: { type: 'playlist', id: text } };
  const uri = URI.exec(text);
  if (uri) return kindResult(uri[1], uri[2]);
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!HOSTS.has(url.hostname)) return { ok: false, reason: 'invalid' };
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0]?.startsWith('intl-')) parts.shift();
  if (parts[0] === 'embed') parts.shift();
  const [kind, id] = parts;
  if (!kind || !id || parts.length > 2) return { ok: false, reason: 'invalid' };
  return kindResult(kind, id);
}

export function linkErrorMessage(reason: LinkFailure): string {
  switch (reason) {
    case 'empty':
      return 'Paste a Spotify playlist or album link.';
    case 'unsupported':
      return 'That link is not a playlist or an album. Paste a playlist or album link.';
    case 'invalid':
      return "That doesn't look like a Spotify playlist or album link.";
  }
}
