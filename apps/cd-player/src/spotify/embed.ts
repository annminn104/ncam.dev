import type { CollectionRef, CollectionType } from '../routes';
import {
  ArtistEntity,
  CollectionEntity,
  TrackEntity,
  TrackListItem,
  type VisualIdentityInput,
} from './schema';
import type { ArtistDetail, Collection, Palette, Picture, TrackDetail } from './types';

/**
 * Reads Spotify's public embed pages (open.spotify.com/embed/<type>/<id>). Each holds its data as
 * JSON in `__NEXT_DATA__`, at props.pageProps.state.data.entity. Undocumented and unofficial: all
 * of it stays in this file and schema.ts. Server-only.
 */
export type EmbedType = CollectionType | 'track' | 'artist';

export class EmbedError extends Error {
  constructor(
    readonly kind: 'not_found' | 'upstream',
    message: string,
  ) {
    super(message);
    this.name = 'EmbedError';
  }
}

/** Spotify answers some clients with a page without data; a desktop browser gets the full one. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/;

export function embedUrl(type: EmbedType, id: string): string {
  return `https://open.spotify.com/embed/${type}/${id}`;
}

/** The page's entity, or null: Spotify answers 200 with no entity for an unknown id. */
export function readEntity(html: string): unknown {
  const match = NEXT_DATA.exec(html);
  if (!match) throw new EmbedError('upstream', 'the page has no __NEXT_DATA__');
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new EmbedError('upstream', '__NEXT_DATA__ is not JSON');
  }
  type Shape = { props?: { pageProps?: { state?: { data?: { entity?: unknown } } } } };
  return (data as Shape)?.props?.pageProps?.state?.data?.entity ?? null;
}

const idOf = (uri: string) => uri.split(':').pop() ?? '';

const rgb = (color: { red: number; green: number; blue: number } | null | undefined) =>
  color ? `rgb(${color.red}, ${color.green}, ${color.blue})` : null;

function toPalette(identity: VisualIdentityInput): Palette | null {
  const background = rgb(identity?.backgroundBase);
  if (!background) return null;
  return {
    background,
    tinted: rgb(identity?.backgroundTintedBase) ?? background,
    text: rgb(identity?.textBase) ?? 'rgb(255, 255, 255)',
  };
}

function toPictures(identity: VisualIdentityInput): Picture[] {
  return (identity?.image ?? [])
    .map((image) => ({ url: image.url, width: image.maxWidth ?? image.width ?? 0 }))
    .sort((a, b) => a.width - b.width);
}

export function toCollection(entity: unknown, ref: CollectionRef): Collection {
  if (entity === null) throw new EmbedError('not_found', `${ref.type} ${ref.id} not found`);
  const parsed = CollectionEntity.safeParse(entity);
  if (!parsed.success) throw new EmbedError('upstream', `${ref.type} ${ref.id}: unexpected shape`);
  const data = parsed.data;
  if (data.type !== ref.type) throw new EmbedError('not_found', `${ref.id} is not a ${ref.type}`);
  // The entry shape is checked per item: one that does not fit is skipped, the list still loads.
  const items = data.trackList.flatMap((entry) => {
    const item = TrackListItem.safeParse(entry);
    return item.success ? [item.data] : [];
  });
  return {
    type: data.type,
    id: data.id,
    name: data.name,
    subtitle: data.subtitle ?? '',
    tracks: items
      .filter((item) => item.uri.startsWith('spotify:track:'))
      .map((item) => ({
        id: idOf(item.uri),
        uri: item.uri,
        title: item.title,
        artists: item.subtitle ?? '',
        durationMs: item.duration ?? 0,
        playable: item.isPlayable !== false,
        explicit: item.isExplicit === true,
      })),
  };
}

export function toTrackDetail(entity: unknown, id: string): TrackDetail {
  if (entity === null) throw new EmbedError('not_found', `track ${id} not found`);
  const parsed = TrackEntity.safeParse(entity);
  if (!parsed.success) throw new EmbedError('upstream', `track ${id}: unexpected shape`);
  return {
    id: parsed.data.id,
    art: toPictures(parsed.data.visualIdentity),
    palette: toPalette(parsed.data.visualIdentity),
    artists: (parsed.data.artists ?? []).map((artist) => ({
      id: idOf(artist.uri),
      name: artist.name,
    })),
  };
}

export function toArtistDetail(entity: unknown, id: string): ArtistDetail {
  if (entity === null) throw new EmbedError('not_found', `artist ${id} not found`);
  const parsed = ArtistEntity.safeParse(entity);
  if (!parsed.success) throw new EmbedError('upstream', `artist ${id}: unexpected shape`);
  return {
    id: parsed.data.id,
    name: parsed.data.name,
    images: toPictures(parsed.data.visualIdentity),
    palette: toPalette(parsed.data.visualIdentity),
  };
}

export async function fetchEntity(
  type: EmbedType,
  id: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(embedUrl(type, id), {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new EmbedError('upstream', `fetch failed: ${String(error)}`);
  }
  if (response.status === 404) throw new EmbedError('not_found', `${type} ${id}: 404`);
  if (!response.ok) throw new EmbedError('upstream', `${type} ${id}: status ${response.status}`);
  // The timeout signal governs the body too: a stall or a cut after the headers fails here.
  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    throw new EmbedError('upstream', `reading ${type} ${id} failed: ${String(error)}`);
  }
  return readEntity(body);
}

export async function loadCollection(
  ref: CollectionRef,
  fetchImpl?: typeof fetch,
  timeoutMs?: number,
) {
  return toCollection(await fetchEntity(ref.type, ref.id, fetchImpl, timeoutMs), ref);
}

export async function loadTrack(id: string, fetchImpl?: typeof fetch, timeoutMs?: number) {
  return toTrackDetail(await fetchEntity('track', id, fetchImpl, timeoutMs), id);
}

export async function loadArtist(id: string, fetchImpl?: typeof fetch, timeoutMs?: number) {
  return toArtistDetail(await fetchEntity('artist', id, fetchImpl, timeoutMs), id);
}
