/**
 * Shared registry of showcase projects.
 *
 * The shell reads this to render its gallery. `remote` + `module` describe how
 * to load the project's federated micro-frontend; the shell keeps a matching
 * loader whose import specifier is static (required by the federation plugin).
 */
export interface ProjectEntry {
  /** Stable id, also used as the gallery route key. */
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Brand accent colour (used for the gallery card). */
  accent: string;
  /**
   * Gallery card thumbnail (served from the host's /public), also used as OG image.
   * A 1200×630 capture of the project page — regenerate with `pnpm thumbnails`.
   */
  thumbnail?: string;
  /** Module Federation remote name, e.g. 'holodex'. */
  remote: string;
  /** Exposed module on that remote, e.g. './mount'. */
  module: string;
  status: 'live' | 'coming-soon';
  /**
   * Whether the remote owns URLs below its project path — i.e. it implements
   * the route-aware half of the mount contract (`MountConfig.route` +
   * `MountHandle.update`, see packages/mf-remote).
   *
   * Absent means no, which is right for every remote that renders a single
   * page. The host's splat route answers 200 for any depth, so without this
   * flag `/projects/<id>/anything/at/all` is an indexable duplicate of the
   * project page for those remotes; `projectHead` reads it to send `noindex`
   * and a canonical back to the project root instead.
   */
  routeAware?: boolean;
  /**
   * The static top-level pages a route-aware remote owns below its project
   * path, relative to it (`'sets'` is `/projects/holodex/sets`). The host's
   * sitemap lists them after the project page. Pages per item (one set, one
   * card) stay out: there are thousands, and links reach them anyway.
   */
  sitemapPaths?: readonly string[];
}

export const projects: ProjectEntry[] = [
  {
    id: 'holodex',
    name: 'Holodex',
    tagline: 'Pokémon TCG explorer',
    description:
      'A Pokémon TCG database explorer built on the TCGdex API — browse every series, set and card, filter by type and rarity, track a collection, and inspect a card rendered with a WebGL holo foil keyed to its rarity.',
    accent: '#7C5CFF',
    thumbnail: '/thumbnails/holodex.jpg',
    remote: 'holodex',
    module: './mount',
    status: 'live',
    // Sets, cards, search and the collection are all real Holodex URLs.
    routeAware: true,
    // apps/holodex/src/routes.ts. Not `effects`: that is the root page again
    // under a second name, and the remote itself links it as `/`. Not
    // `search` or `collection` either: a crawler gets an empty search form
    // and an empty collection (it lives in the visitor's browser), thin pages
    // a sitemap should not ask to have indexed.
    sitemapPaths: ['sets'],
  },
  {
    id: 'chess',
    name: 'Cultivation Chess',
    tagline: '3D xianxia chess',
    description:
      'International chess where the pieces are floating cultivation treasures — seals, flying swords, cauldrons, mirrors, spirit bells and pearls — fought in three 3D arenas with a free camera. Play a friend on one device or Stockfish at five realms. React Three Fiber + drei + chess.js.',
    accent: '#7FD6B5',
    thumbnail: '/thumbnails/chess.jpg',
    // Single-word name → already a valid identifier.
    remote: 'chess',
    module: './mount',
    status: 'live',
  },
  {
    id: 'mini-store',
    name: 'Mini Store',
    tagline: 'Rainy-night corner store diorama',
    description:
      'A Saigon street corner on a rainy night, built as a miniature diorama with a hand-written WebGL2 renderer: PBR, shadowed spotlights, volumetric fog, wet-road reflections, SSAO and bloom. No three.js.',
    accent: '#E4211B',
    thumbnail: '/thumbnails/mini-store.jpg',
    // MF remote name must be a valid identifier → underscore (route id stays kebab).
    remote: 'mini_store',
    module: './mount',
    status: 'live',
  },
  {
    id: 'garden-home',
    name: 'Garden Home',
    tagline: 'A glass villa and its garden island, cut away floor by floor',
    description:
      'A glass villa and its garden island, built from Blender modules and drawn with React Three Fiber: orbit it, zoom in to cut the house away floor by floor like a dollhouse, and switch its lights, screens, shower and fountains on and off.',
    accent: '#6BA368',
    thumbnail: '/thumbnails/garden-home.jpg',
    // MF remote name must be a valid identifier → underscore (route id stays kebab).
    remote: 'garden_home',
    module: './mount',
    status: 'live',
  },
  {
    id: 'cd-player',
    name: 'CD Player',
    tagline: 'Any Spotify playlist on a suitcase CD player',
    description:
      "Paste a Spotify playlist or album and it plays on a 3D suitcase CD player: the next five discs wait in a rack in the lid, each printed with its artist, and fly onto the spindle as the tracks change, over the album art. Four colourways. Spotify's embed and iFrame API, React Three Fiber, a model generated in Blender.",
    accent: '#E296A4',
    thumbnail: '/thumbnails/cd-player.jpg',
    // MF remote name must be a valid identifier → underscore (route id stays kebab).
    remote: 'cd_player',
    module: './mount',
    status: 'live',
    // /playlist/<id> and /album/<id> are the visitor's own pages (apps/cd-player/src/routes.ts).
    // None is listed in the sitemap: they are whatever visitors bring.
    routeAware: true,
  },
];

export function getProject(id: string): ProjectEntry | undefined {
  return projects.find((project) => project.id === id);
}
