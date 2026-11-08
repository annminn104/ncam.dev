import { beforeAll, describe, expect, it, vi } from 'vitest';

type ProjectHeadModule = typeof import('./project-head');

let projectHead: ProjectHeadModule['projectHead'];
let isRealProjectPath: ProjectHeadModule['isRealProjectPath'];
let remoteHead: ProjectHeadModule['remoteHead'];
let withStageExpect: ProjectHeadModule['withStageExpect'];
let STAGE_END_ID: ProjectHeadModule['STAGE_END_ID'];

const SITE = 'https://ncam.dev';

beforeAll(async () => {
  // lib/site.ts bakes this in at build time from the Vite env; nothing defines
  // it under vitest, so stub it before the module graph is evaluated.
  vi.stubEnv('VITE_SITE_URL', SITE);
  ({ projectHead, isRealProjectPath, remoteHead, withStageExpect, STAGE_END_ID } =
    await import('./project-head'));
});

const metaValue = (head: ReturnType<typeof projectHead>, name: string) =>
  head.meta.find((entry) => 'name' in entry && entry.name === name) as
    { name: string; content: string } | undefined;

const propertyValue = (head: ReturnType<typeof projectHead>, property: string) =>
  head.meta.find((entry) => 'property' in entry && entry.property === property) as
    { property: string; content: string } | undefined;

const canonical = (head: ReturnType<typeof projectHead>) =>
  ('links' in head ? head.links : [])?.[0]?.href;

describe('isRealProjectPath', () => {
  it('treats the bare project path as real for every project', () => {
    expect(isRealProjectPath('chess')).toBe(true);
    expect(isRealProjectPath('holodex')).toBe(true);
    expect(isRealProjectPath('chess', '')).toBe(true);
  });

  it('accepts a deep link only into a route-aware remote', () => {
    expect(isRealProjectPath('holodex', 'sets/swsh3')).toBe(true);
    // The others render one page; the splat route answers 200 regardless.
    expect(isRealProjectPath('chess', 'anything/at/all')).toBe(false);
    expect(isRealProjectPath('mini-store', 'x')).toBe(false);
    expect(isRealProjectPath('garden-home', 'x')).toBe(false);
  });

  it('defaults to not-route-aware for an unknown project', () => {
    expect(isRealProjectPath('does-not-exist', 'x')).toBe(false);
  });
});

describe('remoteHead', () => {
  it('keeps the non-empty strings, whitespace collapsed', () => {
    expect(
      remoteHead({ title: '  Base Set\n card list ', description: 'All  102 cards.' }),
    ).toEqual({
      title: 'Base Set card list',
      description: 'All 102 cards.',
    });
    expect(remoteHead({ title: 'Base Set card list', description: '   ' })).toEqual({
      title: 'Base Set card list',
    });
  });

  it('drops anything else: a remote is another deployment answering over the wire', () => {
    expect(remoteHead(undefined)).toBeUndefined();
    expect(remoteHead('Base Set')).toBeUndefined();
    expect(remoteHead({})).toBeUndefined();
    expect(remoteHead({ title: 42, description: ['x'] })).toBeUndefined();
    expect(remoteHead({ title: '', description: '' })).toBeUndefined();
  });
});

describe('projectHead', () => {
  it('indexes the bare project page with a self canonical', () => {
    const head = projectHead('chess');
    expect(metaValue(head, 'robots')?.content).toBe('index,follow');
    expect(canonical(head)).toBe(`${SITE}/projects/chess`);
  });

  it('gives a route-aware remote its deep link its own canonical', () => {
    const head = projectHead('holodex', 'sets/swsh3');
    expect(metaValue(head, 'robots')?.content).toBe('index,follow');
    expect(canonical(head)).toBe(`${SITE}/projects/holodex/sets/swsh3`);
  });

  it('noindexes an invented path under a remote with no internal routes', () => {
    // Without this every typo below /projects/chess was a distinct indexable
    // duplicate carrying a self-referential canonical.
    const head = projectHead('chess', 'anything/at/all');
    expect(metaValue(head, 'robots')?.content).toBe('noindex');
    expect(canonical(head)).toBe(`${SITE}/projects/chess`);
  });

  it('points og:url at the canonical it chose, not at the requested path', () => {
    const head = projectHead('chess', 'anything/at/all');
    const og = head.meta.find((entry) => 'property' in entry && entry.property === 'og:url') as
      { property: string; content: string } | undefined;
    expect(og?.content).toBe(`${SITE}/projects/chess`);
  });

  it('still noindexes an unknown project, under the 404 title', () => {
    const head = projectHead('does-not-exist');
    expect(metaValue(head, 'robots')?.content).toBe('noindex');
    expect(head.meta.find((entry) => 'title' in entry)).toEqual({
      title: 'Page not found · ncam.dev',
    });
  });

  describe("with the remote's own head", () => {
    const SETS = {
      title: 'Pokémon TCG sets',
      description: 'All 172 Pokémon TCG sets on TCGdex, A to Z.',
    };
    const title = (head: ReturnType<typeof projectHead>) =>
      (head.meta.find((entry) => 'title' in entry) as { title: string } | undefined)?.title;

    it("titles and describes a route-aware remote's deep link with it", () => {
      const head = projectHead('holodex', 'sets', SETS);
      expect(title(head)).toBe('Pokémon TCG sets · Holodex · ncam.dev');
      expect(propertyValue(head, 'og:title')?.content).toBe(title(head));
      expect(metaValue(head, 'twitter:title')?.content).toBe(title(head));
      expect(metaValue(head, 'description')?.content).toBe(SETS.description);
      expect(propertyValue(head, 'og:description')?.content).toBe(SETS.description);
      expect(metaValue(head, 'twitter:description')?.content).toBe(SETS.description);
      // Everything else is the deep link's as before.
      expect(canonical(head)).toBe(`${SITE}/projects/holodex/sets`);
      expect(metaValue(head, 'robots')?.content).toBe('index,follow');
    });

    it("keeps the project's title and description without one", () => {
      // A client navigation, `vite dev`, or a page the remote could not name.
      const head = projectHead('holodex', 'sets');
      expect(title(head)).toBe('Holodex — Pokémon TCG explorer · ncam.dev');
      expect(metaValue(head, 'description')?.content).toMatch(/^A Pokémon TCG database explorer/);
    });

    it("keeps the project's description when the remote names only the title", () => {
      const head = projectHead('holodex', 'collection', { title: 'Your collection' });
      expect(title(head)).toBe('Your collection · Holodex · ncam.dev');
      expect(metaValue(head, 'description')?.content).toMatch(/^A Pokémon TCG database explorer/);
    });

    it('never retitles the project page itself, or a path the remote does not own', () => {
      expect(title(projectHead('holodex', undefined, SETS))).toBe(
        'Holodex — Pokémon TCG explorer · ncam.dev',
      );
      const chess = projectHead('chess', 'anything', SETS);
      expect(title(chess)).toBe('Cultivation Chess — 3D xianxia chess · ncam.dev');
      expect(metaValue(chess, 'robots')?.content).toBe('noindex');
    });
  });

  it('describes its own thumbnail, absolutely, rather than inherit the site image alt', () => {
    // The root route sends og.png with its own alt text; tags merge by name.
    const head = projectHead('chess');
    expect(propertyValue(head, 'og:image')?.content).toBe(`${SITE}/thumbnails/chess.jpg`);
    expect(propertyValue(head, 'og:image:alt')?.content).toBe(
      'Screenshot of Cultivation Chess — 3D xianxia chess',
    );
    expect(metaValue(head, 'twitter:image:alt')?.content).toBe(
      'Screenshot of Cultivation Chess — 3D xianxia chess',
    );
  });
});

describe('withStageExpect', () => {
  it('holds the first paint for the end of a server-rendered stage', () => {
    const head = withStageExpect(projectHead('chess'), true);
    expect(head.links?.at(-1)).toEqual({
      rel: 'expect',
      href: `#${STAGE_END_ID}`,
      blocking: 'render',
    });
    // The canonical keeps its place.
    expect(canonical(head)).toBe(`${SITE}/projects/chess`);
  });

  it('leaves the head alone when the stage has no server markup to wait for', () => {
    const head = projectHead('chess');
    expect(withStageExpect(head, false)).toBe(head);
  });
});
