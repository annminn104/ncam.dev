import { z } from 'zod';

/**
 * The parts of Spotify's embed-page entity this remote reads, checked so a change on Spotify's
 * side becomes a clean upstream error. Unknown keys are dropped. Server-only: zod must not reach
 * the client bundle (src/ssr-graph.test.ts).
 */
const Color = z.object({ red: z.number(), green: z.number(), blue: z.number() });

const Image = z.object({
  url: z.string().regex(/^https:\/\//),
  maxWidth: z.number().nullish(),
  width: z.number().nullish(),
});

export const VisualIdentity = z
  .object({
    backgroundBase: Color.nullish(),
    backgroundTintedBase: Color.nullish(),
    textBase: Color.nullish(),
    image: z.array(Image).nullish(),
  })
  .nullish();

export type VisualIdentityInput = z.infer<typeof VisualIdentity>;

export const CollectionEntity = z.object({
  type: z.enum(['playlist', 'album']),
  id: z.string(),
  name: z.string(),
  subtitle: z.string().nullish(),
  trackList: z.array(
    z.object({
      uri: z.string(),
      title: z.string(),
      subtitle: z.string().nullish(),
      duration: z.number().nullish(),
      isPlayable: z.boolean().nullish(),
      isExplicit: z.boolean().nullish(),
    }),
  ),
});

export const TrackEntity = z.object({
  type: z.literal('track'),
  id: z.string(),
  artists: z.array(z.object({ name: z.string(), uri: z.string() })).nullish(),
  visualIdentity: VisualIdentity,
});

export const ArtistEntity = z.object({
  type: z.literal('artist'),
  id: z.string(),
  name: z.string(),
  visualIdentity: VisualIdentity,
});
