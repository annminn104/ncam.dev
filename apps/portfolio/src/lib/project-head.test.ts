import { beforeAll, describe, expect, it, vi } from 'vitest';

type ProjectHeadModule = typeof import('./project-head');

let projectHead: ProjectHeadModule['projectHead'];
let isRealProjectPath: ProjectHeadModule['isRealProjectPath'];

const SITE = 'https://ncam.dev';

beforeAll(async () => {
  // lib/site.ts bakes this in at build time from the Vite env; nothing defines
  // it under vitest, so stub it before the module graph is evaluated.
  vi.stubEnv('VITE_SITE_URL', SITE);
  ({ projectHead, isRealProjectPath } = await import('./project-head'));
});

const metaValue = (head: ReturnType<typeof projectHead>, name: string) =>
  head.meta.find((entry) => 'name' in entry && entry.name === name) as
    { name: string; content: string } | undefined;

const canonical = (head: ReturnType<typeof projectHead>) =>
  ('links' in head ? head.links : [])?.[0]?.href;

describe('isRealProjectPath', () => {
  it('treats the bare project path as real for every project', () => {
    expect(isRealProjectPath('bali')).toBe(true);
    expect(isRealProjectPath('holodex')).toBe(true);
    expect(isRealProjectPath('bali', '')).toBe(true);
  });

  it('accepts a deep link only into a route-aware remote', () => {
    expect(isRealProjectPath('holodex', 'sets/swsh3')).toBe(true);
    // The other five render one page; the splat route answers 200 regardless.
    expect(isRealProjectPath('bali', 'anything/at/all')).toBe(false);
    expect(isRealProjectPath('toonhub', 'x')).toBe(false);
    expect(isRealProjectPath('mindloop', 'x')).toBe(false);
    expect(isRealProjectPath('immersive-ocean', 'x')).toBe(false);
    expect(isRealProjectPath('viktor', 'x')).toBe(false);
  });

  it('defaults to not-route-aware for an unknown project', () => {
    expect(isRealProjectPath('does-not-exist', 'x')).toBe(false);
  });
});

describe('projectHead', () => {
  it('indexes the bare project page with a self canonical', () => {
    const head = projectHead('bali');
    expect(metaValue(head, 'robots')?.content).toBe('index,follow');
    expect(canonical(head)).toBe(`${SITE}/projects/bali`);
  });

  it('gives a route-aware remote its deep link its own canonical', () => {
    const head = projectHead('holodex', 'sets/swsh3');
    expect(metaValue(head, 'robots')?.content).toBe('index,follow');
    expect(canonical(head)).toBe(`${SITE}/projects/holodex/sets/swsh3`);
  });

  it('noindexes an invented path under a remote with no internal routes', () => {
    // Without this every typo below /projects/bali was a distinct indexable
    // duplicate carrying a self-referential canonical.
    const head = projectHead('bali', 'anything/at/all');
    expect(metaValue(head, 'robots')?.content).toBe('noindex');
    expect(canonical(head)).toBe(`${SITE}/projects/bali`);
  });

  it('points og:url at the canonical it chose, not at the requested path', () => {
    const head = projectHead('bali', 'anything/at/all');
    const og = head.meta.find((entry) => 'property' in entry && entry.property === 'og:url') as
      { property: string; content: string } | undefined;
    expect(og?.content).toBe(`${SITE}/projects/bali`);
  });

  it('still noindexes an unknown project', () => {
    const head = projectHead('does-not-exist');
    expect(metaValue(head, 'robots')?.content).toBe('noindex');
  });
});
