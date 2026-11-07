import type { SsrHead } from '@ncam/mf-remote';
import type { Collection } from './spotify/types';

/** The page a shared link names: the visitor's playlist or album (the host adds its branding). */
export function collectionHead(collection: Collection): SsrHead {
  const by = collection.subtitle ? ` by ${collection.subtitle}` : '';
  return {
    title: collection.name,
    description: `${collection.name}${by}: a ${collection.tracks.length}-track ${collection.type} on a suitcase CD player. Paste your own Spotify playlist to make the page yours.`,
  };
}
