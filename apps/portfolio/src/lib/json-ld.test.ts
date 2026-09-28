import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getProject, projects } from '@ncam/project-registry';

type JsonLdModule = typeof import('./json-ld');
type SiteModule = typeof import('./site');

let jsonLd: JsonLdModule;
let site: SiteModule;

const SITE = 'https://ncam.dev';

beforeAll(async () => {
  // lib/site.ts bakes this in at build time from the Vite env; nothing defines
  // it under vitest, so stub it before the module graph is evaluated.
  vi.stubEnv('VITE_SITE_URL', SITE);
  jsonLd = await import('./json-ld');
  site = await import('./site');
});

type Node = Record<string, unknown> & { '@type': string };
const nodes = (graph: { '@graph': unknown[] }) => graph['@graph'] as Node[];
const ofType = (graph: { '@graph': unknown[] }, type: string) =>
  nodes(graph).find((node) => node['@type'] === type);

/** Every string in the graph under a key that holds a URL. */
function urls(value: unknown, key = ''): string[] {
  if (typeof value === 'string')
    return ['url', 'item', 'image', '@id', 'sameAs'].includes(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((entry) => urls(entry, key));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([name, entry]) => urls(entry, name));
  return [];
}

describe('homeJsonLd', () => {
  it('declares the WebSite and the Person, each under its own @id', () => {
    const graph = jsonLd.homeJsonLd();
    expect(ofType(graph, 'WebSite')?.['@id']).toBe(`${SITE}/#website`);
    expect(ofType(graph, 'Person')?.['@id']).toBe(`${SITE}/#person`);
    expect(ofType(graph, 'WebSite')?.publisher).toEqual({ '@id': site.PERSON_ID });
  });

  it('names the Person AUTHOR_NAME, with an image and what they know', () => {
    const person = ofType(jsonLd.homeJsonLd(), 'Person');
    expect(person?.name).toBe(site.AUTHOR_NAME);
    expect(person?.image).toBe(`${SITE}/og.png`);
    expect(person?.knowsAbout).toContain('Micro Frontends');
  });
});

describe('projectJsonLd', () => {
  it('credits the home page Person and WebSite by @id', () => {
    const home = jsonLd.homeJsonLd();
    const work = ofType(jsonLd.projectJsonLd(getProject('viktor')!), 'CreativeWork');
    const author = work?.author as Record<string, unknown>;
    // The same entity as `/` declares, so crawlers merge the two.
    expect(author['@id']).toBe(ofType(home, 'Person')?.['@id']);
    expect(author.name).toBe(ofType(home, 'Person')?.name);
    expect(work?.isPartOf).toEqual({ '@id': ofType(home, 'WebSite')?.['@id'] });
  });

  it("shows the project's thumbnail as its image", () => {
    const work = ofType(jsonLd.projectJsonLd(getProject('holodex')!), 'CreativeWork');
    expect(work?.image).toBe(`${SITE}/thumbnails/holodex.jpg`);
    expect(work?.url).toBe(`${SITE}/projects/holodex`);
  });

  it('uses absolute URLs only, on every project', () => {
    for (const project of projects) {
      for (const url of urls(jsonLd.projectJsonLd(project))) expect(url).toMatch(/^https:\/\//);
    }
    for (const url of urls(jsonLd.homeJsonLd())) expect(url).toMatch(/^https:\/\//);
  });
});

describe('serialiseJsonLd', () => {
  it('escapes < so no value can close the script tag, and parses back the same', () => {
    const value = { name: '</script><script>alert(1)</script>' };
    const serialised = jsonLd.serialiseJsonLd(value);
    expect(serialised).not.toContain('<');
    expect(JSON.parse(serialised)).toEqual(value);
  });
});
