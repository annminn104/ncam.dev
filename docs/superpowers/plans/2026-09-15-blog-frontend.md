# Blog Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Strapi blog in the portfolio — `/blog`, `/blog/$slug` and real cards in the home page's federated blog section — with all CMS traffic server-side.

**Architecture:** A framework-free workspace package `@ncam/cms` (Strapi types, query builders, mapper to a `BlogPost` view-model, fetch client with injectable `fetch`) is consumed by TanStack Start server functions in the host. Two new file routes render the index and article pages (Blocks rendered by `@strapi/blocks-react-renderer`, SEO in `head()`, Nitro `swr` caching). The `profile` remote's section-module contract gains optional props so the host can pass `{ posts }` into `ssr/hydrate/mount`; the blog section maps `BlogPost` onto its existing card and falls back to the current placeholders.

**Tech Stack:** TypeScript 5.9, TanStack Start 1.168 / Router 1.170 (pinned), React 19.2, Nitro 3 (vite plugin), Vite 8, Module Federation (`@module-federation/vite` 1.17), Vitest 4, `@strapi/blocks-react-renderer` ^1.0.2, Strapi 5.53 (already in `apps/strapi`), pnpm 11.13, Node 22.

**Spec:** `docs/superpowers/specs/2026-09-15-blog-frontend-design.md` (phase 1 spec: `docs/superpowers/specs/2026-09-15-strapi-blog-cms-design.md`)

## Global Constraints

- Branch `feat/blog-frontend` (holds the spec commit 316b877). One commit per task; Conventional Commits with an app/package scope, imperative lowercase, no trailing period, as written in each task; husky runs lint-staged (eslint --fix + prettier) and commitlint on commit. End each commit message with a blank line and a `Co-Authored-By:` trailer naming your model.
- pnpm 11.13.0 only, Node 22. Shell is zsh: no `PIPESTATUS`; a bare foreground `sleep` is blocked; wait for servers with `curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors`.
- Pinned versions stay pinned: `@tanstack/react-router` 1.170.18, `@tanstack/react-start` 1.168.28, `nitro` 3.0.260311-beta, `@module-federation/vite` 1.17.0, `react`/`react-dom` 19.2.7. New dependency: `@strapi/blocks-react-renderer` `^1.0.2` (host only). `@ncam/cms` has **no runtime dependencies**.
- `@ncam/cms` is framework-free and browser-safe (no `process`, no Node APIs beyond `fetch`/`URL`/`AbortSignal`/`Intl`, which exist in Node 22 and browsers). The remote imports it **type-only**.
- Server functions use `createServerFn({ method: 'GET' })` and `.inputValidator(...)` (the method name in the pinned version). CMS env is read at request time from `process.env` (`STRAPI_URL`, `STRAPI_PUBLIC_URL`), never via `import.meta.env`/`define`.
- Labels are computed on the server (`dateLabel` = `en-US`, UTC, e.g. "Sep 15, 2026"; `readingLabel` = `"9 min"`); the same `posts` array flows from loader data into SSR and hydration.
- Prettier: printWidth 100, singleQuote, trailingComma all, semi. ESLint root config (typescript-eslint recommended, react-hooks). Run `pnpm prettier --write <paths>` before every commit. Never edit `apps/portfolio/src/routeTree.gen.ts` by hand (the build regenerates it; commit the regenerated file).
- Never commit `.output/`, `dist/`, `apps/strapi/.tmp/`, `apps/strapi/.env`. Never print `apps/strapi/.env`.
- Verification servers: Strapi on 1337 (`apps/strapi`, SQLite, already has the Public read grants), host preview on 9000, profile remote preview on 9006. Always stop what you start (`kill $(lsof -ti :<port>)`) and confirm the port is free before reporting.

### Verified facts (do not re-derive)

- `createServerFn`, `createServerOnlyFn`, `createMiddleware` are exported by `@tanstack/react-start`; the validator step is `.inputValidator()`. Router routes accept `staleTime`, `headers`, `head({ loaderData, params })`; `notFound()` comes from `@tanstack/react-router`; `navigate({ href })` is a valid `NavigateOptions` shape.
- Nitro's config accepts `routeRules: { '<pattern>': { swr: number } }`; the host already passes `nitro: { traceDeps }` at the top level of `defineConfig` — add `routeRules` there.
- `@strapi/blocks-react-renderer` 1.0.2 peer-depends on React ^18 || ^19; exports `BlocksRenderer`, types `BlocksContent`, `BlocksComponents`. Block override props: `image: ({ image }) => …` (`image.url`, `image.alternativeText`, `image.width`, `image.height`, `image.caption`), `link: ({ url, children }) => …`.
- Strapi API on this repo: `GET /api/articles` (public), `rest.strictParams: true` (unknown query params are rejected), `status` forced to published, media URLs relative (`/uploads/…`) unless `PUBLIC_URL` is set. Article attributes: `title slug excerpt cover body readingTime tags seo`, plus `documentId`, `publishedAt`.
- The remote's `createClientModule` currently builds the React element once at module scope and `ssr()` takes no arguments; `apps/portfolio/src/types/remote/profile.d.ts` declares the six `profile/*` modules with a shared `ProfileSectionModule` interface.
- Root Vitest `include` covers `packages/*/src/**/*.test.ts` (node environment) — tests in `packages/cms` need no config change.
- The Nitro server does **not** load the monorepo root `.env` at runtime; only `vite.config.ts` reads it (via `@ncam/mf-remote`'s `env()`). Hence `getCmsEnv()` defaults to `http://localhost:1337` when `STRAPI_URL` is unset (dev/preview convenience) and Docker/Vercel set the variables explicitly.
- TanStack Router types `Link to="…"` against the generated route tree, so both blog routes are created in one task (Task 3) before the host is typechecked.

---

### Task 1: `@ncam/cms` — types, mapper and query builders

**Files:**

- Create: `packages/cms/package.json`, `packages/cms/tsconfig.json`
- Create: `packages/cms/src/types.ts`, `packages/cms/src/map.ts`, `packages/cms/src/query.ts`, `packages/cms/src/index.ts`
- Test: `packages/cms/src/map.test.ts`, `packages/cms/src/query.test.ts`

**Interfaces:**

- Produces (consumed by Tasks 2–5): types `StrapiMedia`, `StrapiTag`, `StrapiSeo`, `StrapiArticle`, `StrapiList<T>`, `BlogImage`, `BlogPost`; functions `resolveMediaUrl(url: string, mediaBase: string): string`, `formatDateLabel(iso: string): string`, `absolutizeBlockImages(blocks: unknown, mediaBase: string): unknown`, `mapArticle(raw: StrapiArticle, options: { mediaBase: string }): BlogPost`, `buildListQuery(): string`, `buildBySlugQuery(slug: string): string`.

- [ ] **Step 1: Package manifest and tsconfig**

`packages/cms/package.json`:

```json
{
  "name": "@ncam/cms",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@ncam/tsconfig": "workspace:*",
    "@types/node": "^26.1.1",
    "typescript": "^5.9.0"
  }
}
```

`packages/cms/tsconfig.json`:

```json
{
  "extends": "@ncam/tsconfig/base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```

Run `pnpm install` (links the new workspace package; the lockfile gains an importer).

- [ ] **Step 2: Write the failing mapper tests** — `packages/cms/src/map.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { absolutizeBlockImages, formatDateLabel, mapArticle, resolveMediaUrl } from './map';
import type { StrapiArticle } from './types';

const MEDIA_BASE = 'http://cms.test:1337';

const raw: StrapiArticle = {
  documentId: 'doc-1',
  title: 'Federating React 19',
  slug: 'federating-react-19',
  excerpt: 'Why every remote bundles its own React.',
  readingTime: 9,
  publishedAt: '2026-09-15T08:30:00.000Z',
  cover: { url: '/uploads/cover.png', alternativeText: 'Cover art', width: 1200, height: 630 },
  tags: [
    { name: 'Module Federation', slug: 'module-federation' },
    { name: 'React', slug: 'react' },
  ],
  seo: {
    metaTitle: 'Federating React 19 — notes',
    metaDescription: 'SEO description.',
    ogImage: { url: 'https://cdn.example/og.png', alternativeText: null, width: 1200, height: 630 },
  },
  body: [
    { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] },
    {
      type: 'image',
      image: { url: '/uploads/inline.png', alternativeText: 'Inline', width: 10, height: 20 },
      children: [{ type: 'text', text: '' }],
    },
  ],
};

describe('resolveMediaUrl', () => {
  it('resolves relative upload paths against the media base', () => {
    expect(resolveMediaUrl('/uploads/a.png', MEDIA_BASE)).toBe(
      'http://cms.test:1337/uploads/a.png',
    );
  });

  it('leaves absolute URLs untouched', () => {
    expect(resolveMediaUrl('https://cdn.example/a.png', MEDIA_BASE)).toBe(
      'https://cdn.example/a.png',
    );
  });
});

describe('formatDateLabel', () => {
  it('formats in UTC as "Mon D, YYYY"', () => {
    expect(formatDateLabel('2026-09-15T23:59:00.000Z')).toBe('Sep 15, 2026');
    expect(formatDateLabel('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatDateLabel('not-a-date')).toBe('');
  });
});

describe('absolutizeBlockImages', () => {
  it('rewrites only image nodes, recursively, without mutating the input', () => {
    const input = [
      { type: 'paragraph', children: [{ type: 'text', text: 'x' }] },
      { type: 'image', image: { url: '/uploads/i.png', width: 1, height: 1 }, children: [] },
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'y' }] }],
      },
    ];
    const snapshot = JSON.stringify(input);
    const out = absolutizeBlockImages(input, MEDIA_BASE) as Array<Record<string, unknown>>;
    expect((out[1].image as { url: string }).url).toBe('http://cms.test:1337/uploads/i.png');
    expect(out[0]).toEqual(input[0]);
    expect(out[2]).toEqual(input[2]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('passes through non-object input', () => {
    expect(absolutizeBlockImages(null, MEDIA_BASE)).toBeNull();
    expect(absolutizeBlockImages('text', MEDIA_BASE)).toBe('text');
  });
});

describe('mapArticle', () => {
  it('maps every field of a full article', () => {
    const post = mapArticle(raw, { mediaBase: MEDIA_BASE });
    expect(post).toEqual({
      id: 'doc-1',
      slug: 'federating-react-19',
      title: 'Federating React 19',
      excerpt: 'Why every remote bundles its own React.',
      publishedAt: '2026-09-15T08:30:00.000Z',
      dateLabel: 'Sep 15, 2026',
      readingTime: 9,
      readingLabel: '9 min',
      tags: ['Module Federation', 'React'],
      cover: {
        url: 'http://cms.test:1337/uploads/cover.png',
        alt: 'Cover art',
        width: 1200,
        height: 630,
      },
      body: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] },
        {
          type: 'image',
          image: {
            url: 'http://cms.test:1337/uploads/inline.png',
            alternativeText: 'Inline',
            width: 10,
            height: 20,
          },
          children: [{ type: 'text', text: '' }],
        },
      ],
      seo: {
        title: 'Federating React 19 — notes',
        description: 'SEO description.',
        image: {
          url: 'https://cdn.example/og.png',
          alt: 'Federating React 19',
          width: 1200,
          height: 630,
        },
      },
    });
  });

  it('fills defaults when relations and optional fields are missing', () => {
    const post = mapArticle(
      { ...raw, readingTime: null, cover: null, tags: null, seo: null, body: undefined },
      { mediaBase: MEDIA_BASE },
    );
    expect(post.readingTime).toBe(1);
    expect(post.readingLabel).toBe('1 min');
    expect(post.tags).toEqual([]);
    expect(post.cover).toBeNull();
    expect(post.body).toBeNull();
    expect(post.seo).toEqual({ title: raw.title, description: raw.excerpt, image: null });
  });

  it('uses the cover as the social image when seo has none', () => {
    const post = mapArticle(
      { ...raw, seo: { metaTitle: null, metaDescription: null, ogImage: null } },
      {
        mediaBase: MEDIA_BASE,
      },
    );
    expect(post.seo.image?.url).toBe('http://cms.test:1337/uploads/cover.png');
    expect(post.seo.title).toBe(raw.title);
  });
});
```

- [ ] **Step 3: Run — must fail (module missing)**

Run: `pnpm vitest run packages/cms/src/map.test.ts`
Expected: FAIL, "Failed to load url ./map" (or "Cannot find module").

- [ ] **Step 4: Types** — `packages/cms/src/types.ts`

```ts
/** Strapi 5 REST shapes for `api::article.article` (only the fields the site reads). */
export interface StrapiMedia {
  url: string;
  alternativeText: string | null;
  width: number | null;
  height: number | null;
}

export interface StrapiTag {
  name: string;
  slug: string;
}

export interface StrapiSeo {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
}

export interface StrapiArticle {
  documentId: string;
  title: string;
  slug: string;
  excerpt: string;
  readingTime: number | null;
  publishedAt: string;
  cover: StrapiMedia | null;
  tags: StrapiTag[] | null;
  seo: StrapiSeo | null;
  /** Strapi Blocks JSON — only requested by the by-slug query. */
  body?: unknown;
}

export interface StrapiList<T> {
  data: T[];
  meta: {
    pagination: { page: number; pageSize: number; pageCount: number; total: number };
  };
}

/** Image ready for an `<img>`: absolute URL, alt text resolved. */
export interface BlogImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** View-model shared by the portfolio host and the profile remote. Plain JSON, no Dates. */
export interface BlogPost {
  /** Strapi documentId. */
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** ISO timestamp. */
  publishedAt: string;
  /** "Sep 15, 2026" — computed server-side (en-US, UTC). */
  dateLabel: string;
  /** Minutes, ≥ 1. */
  readingTime: number;
  /** "9 min". */
  readingLabel: string;
  tags: string[];
  cover: BlogImage | null;
  /** Blocks JSON with absolute image URLs, or null when not fetched. */
  body: unknown | null;
  seo: { title: string; description: string; image: BlogImage | null };
}
```

- [ ] **Step 5: Mapper** — `packages/cms/src/map.ts`

```ts
import type { BlogImage, BlogPost, StrapiArticle, StrapiMedia } from './types';

export interface MapOptions {
  /** Origin the browser can reach for `/uploads/…` (Strapi returns relative URLs). */
  mediaBase: string;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Absolute URLs pass through; relative upload paths resolve against the media base. */
export function resolveMediaUrl(url: string, mediaBase: string): string {
  return new URL(url, mediaBase).href;
}

/** "Sep 15, 2026" in UTC so server and client never disagree; '' for garbage input. */
export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

function mapImage(
  media: StrapiMedia | null | undefined,
  fallbackAlt: string,
  mediaBase: string,
): BlogImage | null {
  if (!media?.url) return null;
  return {
    url: resolveMediaUrl(media.url, mediaBase),
    alt: media.alternativeText ?? fallbackAlt,
    width: media.width ?? null,
    height: media.height ?? null,
  };
}

/**
 * Returns a copy of a Blocks tree in which every `image` node carries an absolute URL.
 * Other nodes are copied unchanged; non-object input is returned as is.
 */
export function absolutizeBlockImages(blocks: unknown, mediaBase: string): unknown {
  if (Array.isArray(blocks)) return blocks.map((node) => absolutizeBlockImages(node, mediaBase));
  if (blocks === null || typeof blocks !== 'object') return blocks;

  const node = blocks as Record<string, unknown>;
  const next: Record<string, unknown> = { ...node };
  if (node.type === 'image' && node.image && typeof node.image === 'object') {
    const image = node.image as Record<string, unknown>;
    if (typeof image.url === 'string') {
      next.image = { ...image, url: resolveMediaUrl(image.url, mediaBase) };
    }
  }
  if (Array.isArray(node.children)) {
    next.children = absolutizeBlockImages(node.children, mediaBase);
  }
  return next;
}

/** Strapi article → site view-model. Total: missing relations never throw. */
export function mapArticle(raw: StrapiArticle, { mediaBase }: MapOptions): BlogPost {
  const readingTime = Math.max(1, Math.round(raw.readingTime ?? 1));
  const cover = mapImage(raw.cover, raw.title, mediaBase);
  const ogImage = mapImage(raw.seo?.ogImage, raw.title, mediaBase);
  return {
    id: raw.documentId,
    slug: raw.slug,
    title: raw.title,
    excerpt: raw.excerpt,
    publishedAt: raw.publishedAt,
    dateLabel: formatDateLabel(raw.publishedAt),
    readingTime,
    readingLabel: `${readingTime} min`,
    tags: (raw.tags ?? []).map((tag) => tag.name),
    cover,
    body: raw.body ? absolutizeBlockImages(raw.body, mediaBase) : null,
    seo: {
      title: raw.seo?.metaTitle ?? raw.title,
      description: raw.seo?.metaDescription ?? raw.excerpt,
      image: ogImage ?? cover,
    },
  };
}
```

- [ ] **Step 6: Run — mapper tests pass**

Run: `pnpm vitest run packages/cms/src/map.test.ts`
Expected: `9 passed`.

- [ ] **Step 7: Write the failing query tests** — `packages/cms/src/query.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildBySlugQuery, buildListQuery } from './query';

function params(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

describe('buildListQuery', () => {
  it('asks only for the card fields, newest first, one page of 100', () => {
    expect(params(buildListQuery())).toEqual({
      sort: 'publishedAt:desc',
      'pagination[pageSize]': '100',
      'fields[0]': 'title',
      'fields[1]': 'slug',
      'fields[2]': 'excerpt',
      'fields[3]': 'readingTime',
      'fields[4]': 'publishedAt',
      'populate[cover][fields][0]': 'url',
      'populate[cover][fields][1]': 'alternativeText',
      'populate[cover][fields][2]': 'width',
      'populate[cover][fields][3]': 'height',
      'populate[tags][fields][0]': 'name',
      'populate[tags][fields][1]': 'slug',
    });
  });

  it('encodes brackets so the string is URL-safe', () => {
    expect(buildListQuery()).not.toContain('[');
    expect(buildListQuery()).toContain('pagination%5BpageSize%5D=100');
  });
});

describe('buildBySlugQuery', () => {
  it('filters by exact slug and populates cover, tags and seo.ogImage', () => {
    expect(params(buildBySlugQuery('hello-world'))).toEqual({
      'filters[slug][$eq]': 'hello-world',
      'populate[cover]': 'true',
      'populate[tags]': 'true',
      'populate[seo][populate]': 'ogImage',
    });
  });

  it('encodes the slug', () => {
    expect(params(buildBySlugQuery('a b&c'))['filters[slug][$eq]']).toBe('a b&c');
    expect(buildBySlugQuery('a b&c')).toContain('a+b%26c');
  });
});
```

- [ ] **Step 8: Run — must fail (module missing)**

Run: `pnpm vitest run packages/cms/src/query.test.ts`
Expected: FAIL, "Failed to load url ./query".

- [ ] **Step 9: Query builders** — `packages/cms/src/query.ts`

```ts
/** Query strings for Strapi's REST API — only parameters `rest.strictParams` accepts. */

const LIST_FIELDS = ['title', 'slug', 'excerpt', 'readingTime', 'publishedAt'] as const;
const MEDIA_FIELDS = ['url', 'alternativeText', 'width', 'height'] as const;

/** Newest first, one page of up to 100 cards, cover + tag names only. */
export function buildListQuery(): string {
  const params = new URLSearchParams();
  params.set('sort', 'publishedAt:desc');
  params.set('pagination[pageSize]', '100');
  LIST_FIELDS.forEach((field, index) => params.set(`fields[${index}]`, field));
  MEDIA_FIELDS.forEach((field, index) => params.set(`populate[cover][fields][${index}]`, field));
  params.set('populate[tags][fields][0]', 'name');
  params.set('populate[tags][fields][1]', 'slug');
  return params.toString();
}

/** One article by slug with everything the article page needs (body included by default). */
export function buildBySlugQuery(slug: string): string {
  const params = new URLSearchParams();
  params.set('filters[slug][$eq]', slug);
  params.set('populate[cover]', 'true');
  params.set('populate[tags]', 'true');
  params.set('populate[seo][populate]', 'ogImage');
  return params.toString();
}
```

- [ ] **Step 10: Run — query tests pass; add the barrel**

Run: `pnpm vitest run packages/cms/src/query.test.ts` → `4 passed`.

`packages/cms/src/index.ts`:

```ts
export type {
  BlogImage,
  BlogPost,
  StrapiArticle,
  StrapiList,
  StrapiMedia,
  StrapiSeo,
  StrapiTag,
} from './types';
export { absolutizeBlockImages, formatDateLabel, mapArticle, resolveMediaUrl } from './map';
export type { MapOptions } from './map';
export { buildBySlugQuery, buildListQuery } from './query';
```

- [ ] **Step 11: Gates + commit**

```bash
pnpm prettier --write packages/cms
pnpm --filter @ncam/cms typecheck && pnpm lint && pnpm format:check && pnpm test
git add packages/cms pnpm-lock.yaml
git commit -m "feat(cms): add Strapi article types, mapper and query builders"
```

Expected: typecheck clean; `pnpm test` shows 13 new tests (42 total).

---

### Task 2: `@ncam/cms` — fetch client + package AGENTS.md

**Files:**

- Create: `packages/cms/src/client.ts`, `packages/cms/AGENTS.md`
- Modify: `packages/cms/src/index.ts`
- Test: `packages/cms/src/client.test.ts`

**Interfaces:**

- Consumes: `mapArticle`, `buildListQuery`, `buildBySlugQuery`, `StrapiList`, `StrapiArticle`, `BlogPost` (Task 1).
- Produces (consumed by Task 3): `class CmsError extends Error { status: number }`, `interface CmsOptions { fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number }`, `articlesUrl(baseUrl: string, query: string): string`, `fetchArticles(baseUrl: string, mediaBase: string, options?: CmsOptions): Promise<BlogPost[]>`, `fetchArticleBySlug(baseUrl: string, slug: string, mediaBase: string, options?: CmsOptions): Promise<BlogPost | null>`.

- [ ] **Step 1: Write the failing client tests** — `packages/cms/src/client.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { CmsError, articlesUrl, fetchArticleBySlug, fetchArticles } from './client';
import type { StrapiArticle } from './types';

const BASE = 'http://cms.test:1337/';
const MEDIA = 'http://media.test';

const article: StrapiArticle = {
  documentId: 'doc-1',
  title: 'Hello',
  slug: 'hello',
  excerpt: 'Hi.',
  readingTime: 3,
  publishedAt: '2026-09-15T00:00:00.000Z',
  cover: null,
  tags: [{ name: 'React', slug: 'react' }],
  seo: null,
};

function fakeFetch(status: number, body: unknown) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('articlesUrl', () => {
  it('joins base (with or without trailing slash) and query', () => {
    expect(articlesUrl('http://a/', 'x=1')).toBe('http://a/api/articles?x=1');
    expect(articlesUrl('http://a', 'x=1')).toBe('http://a/api/articles?x=1');
  });
});

describe('fetchArticles', () => {
  it('requests the list query with a JSON accept header and maps the result', async () => {
    const fetch = fakeFetch(200, { data: [article], meta: { pagination: {} } });
    const posts = await fetchArticles(BASE, MEDIA, { fetch });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith('http://cms.test:1337/api/articles?')).toBe(true);
    expect(url).toContain('sort=publishedAt%3Adesc');
    expect((init.headers as Record<string, string>).accept).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe('hello');
    expect(posts[0].readingLabel).toBe('3 min');
  });

  it('throws CmsError with the status on a non-2xx response', async () => {
    const fetch = fakeFetch(503, { error: 'down' });
    await expect(fetchArticles(BASE, MEDIA, { fetch })).rejects.toBeInstanceOf(CmsError);
    await expect(fetchArticles(BASE, MEDIA, { fetch })).rejects.toMatchObject({ status: 503 });
  });

  it('hands an already-aborted caller signal to fetch', async () => {
    const fetch = fakeFetch(200, { data: [], meta: { pagination: {} } });
    await fetchArticles(BASE, MEDIA, { fetch, signal: AbortSignal.abort() });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal?.aborted).toBe(true);
  });
});

describe('fetchArticleBySlug', () => {
  it('returns the mapped first match', async () => {
    const fetch = fakeFetch(200, { data: [article], meta: { pagination: {} } });
    const post = await fetchArticleBySlug(BASE, 'hello', MEDIA, { fetch });
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('filters%5Bslug%5D%5B%24eq%5D=hello');
    expect(post?.title).toBe('Hello');
  });

  it('returns null when nothing matches', async () => {
    const fetch = fakeFetch(200, { data: [], meta: { pagination: {} } });
    expect(await fetchArticleBySlug(BASE, 'nope', MEDIA, { fetch })).toBeNull();
  });
});
```

- [ ] **Step 2: Run — must fail (module missing)**

Run: `pnpm vitest run packages/cms/src/client.test.ts`
Expected: FAIL, "Failed to load url ./client".

- [ ] **Step 3: Client** — `packages/cms/src/client.ts`

```ts
import { mapArticle } from './map';
import { buildBySlugQuery, buildListQuery } from './query';
import type { BlogPost, StrapiArticle, StrapiList } from './types';

/** A non-2xx answer from the CMS. `status` is the HTTP status code. */
export class CmsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CmsError';
  }
}

export interface CmsOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Per-request timeout, default 5 s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** `${origin}/api/articles?${query}` — tolerates a trailing slash on the base. */
export function articlesUrl(baseUrl: string, query: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/articles?${query}`;
}

async function getJson<T>(url: string, options: CmsOptions): Promise<T> {
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(url, {
    headers: { accept: 'application/json' },
    signal: withTimeout(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new CmsError(response.status, `CMS request failed with ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

/** Every published article as cards, newest first (≤ 100). */
export async function fetchArticles(
  baseUrl: string,
  mediaBase: string,
  options: CmsOptions = {},
): Promise<BlogPost[]> {
  const list = await getJson<StrapiList<StrapiArticle>>(
    articlesUrl(baseUrl, buildListQuery()),
    options,
  );
  return list.data.map((raw) => mapArticle(raw, { mediaBase }));
}

/** One published article with its body, or null when the slug is unknown. */
export async function fetchArticleBySlug(
  baseUrl: string,
  slug: string,
  mediaBase: string,
  options: CmsOptions = {},
): Promise<BlogPost | null> {
  const list = await getJson<StrapiList<StrapiArticle>>(
    articlesUrl(baseUrl, buildBySlugQuery(slug)),
    options,
  );
  const raw = list.data[0];
  return raw ? mapArticle(raw, { mediaBase }) : null;
}
```

Append to `packages/cms/src/index.ts`:

```ts
export { CmsError, articlesUrl, fetchArticleBySlug, fetchArticles } from './client';
export type { CmsOptions } from './client';
```

- [ ] **Step 4: Run — client tests pass**

Run: `pnpm vitest run packages/cms/src/client.test.ts`
Expected: `6 passed`.

- [ ] **Step 5: Package docs** — `packages/cms/AGENTS.md`

````markdown
# AGENTS.md — @ncam/cms

Typed client for the blog CMS (`apps/strapi`, Strapi 5). Framework-free, **no
runtime dependencies**, ships raw TypeScript (`src/index.ts`) like the other
packages. Used by the portfolio host **inside server functions**; the `profile`
remote imports only the `BlogPost` type.

## API

```ts
import { fetchArticles, fetchArticleBySlug, CmsError, type BlogPost } from '@ncam/cms';

const posts = await fetchArticles(apiBase, mediaBase); // BlogPost[] — cards, newest first, ≤ 100
const post = await fetchArticleBySlug(apiBase, 'my-slug', mediaBase); // BlogPost | null (body included)
```

- `apiBase` = the Strapi origin the caller can reach (`STRAPI_URL`);
  `mediaBase` = the origin browsers can reach for `/uploads/…`
  (`STRAPI_PUBLIC_URL`). Strapi returns relative media URLs; the mapper makes
  them absolute (cover, seo image and every image block in `body`).
- `BlogPost` is plain JSON (no `Date`): labels (`dateLabel` "Sep 15, 2026" in
  UTC, `readingLabel` "9 min") are computed here so SSR and hydration agree.
- Options: `{ fetch, signal, timeoutMs = 5000 }` — `fetch` is injectable for
  tests. Non-2xx → `CmsError(status)`; network/timeout errors propagate.
- Query strings (`query.ts`) use only parameters Strapi's `rest.strictParams`
  accepts; change them together with the Strapi schema.

## Rules

- Keep it dependency-free and browser-safe (`fetch`, `URL`, `AbortSignal`,
  `Intl` only). No `process.env` here — callers pass URLs in.
- Pure mapping/query code is unit-tested (`*.test.ts`, root Vitest); tests never
  hit the network (fake `fetch`).
````

- [ ] **Step 6: Gates + commit**

```bash
pnpm prettier --write packages/cms
pnpm --filter @ncam/cms typecheck && pnpm lint && pnpm format:check && pnpm test
git add packages/cms
git commit -m "feat(cms): add the Strapi articles client"
```

Expected: `pnpm test` → 48 tests (19 in `packages/cms`).

---

### Task 3: Host — CMS env, server functions and the blog routes

**Files:**

- Create: `apps/portfolio/src/server/cms-env.ts`, `apps/portfolio/src/functions/blog.functions.ts`, `apps/portfolio/src/routes/blog/index.tsx`, `apps/portfolio/src/routes/blog/$slug.tsx`, `apps/portfolio/src/blog.css`
- Modify: `apps/portfolio/package.json` (deps), `apps/portfolio/src/app.css`, `apps/portfolio/vite.config.ts:59-69` (nitro block), `.env` (root), `docker-compose.yml` (portfolio `environment`), `docs/superpowers/specs/2026-09-15-blog-frontend-design.md` (§4 default), `apps/portfolio/src/routeTree.gen.ts` (regenerated by the build)
- Throwaway (gitignored): `apps/strapi/.tmp/seed-smoke-article.cjs`

**Interfaces:**

- Consumes: `@ncam/cms` (Tasks 1–2).
- Produces (consumed by Task 5): `getCmsEnv(env?: NodeJS.ProcessEnv): { apiBase: string; mediaBase: string }`; server functions `getBlogPosts(): Promise<BlogPost[]>` and `getBlogPost({ data: slug }): Promise<BlogPost | null>`; routes `/blog` and `/blog/$slug` (404 via `notFound()` for unknown slugs); CSS classes `.blog`, `.blog__head/.blog__label/.blog__title/.blog__lead/.blog__empty/.blog__list`, `.blog-card*`, `.article*`; the seed article `hello-blog-smoke`.

- [ ] **Step 1: Dependencies**

In `apps/portfolio/package.json` `dependencies`, add (keep alphabetical order):

```json
    "@ncam/cms": "workspace:*",
    "@strapi/blocks-react-renderer": "^1.0.2",
```

Run `pnpm install`.

- [ ] **Step 2: Runtime CMS env** — `apps/portfolio/src/server/cms-env.ts`

```ts
/**
 * Where the server finds the CMS. Read at request time from process.env so the
 * same build runs everywhere (Vercel env, docker-compose `environment`, shell).
 * The monorepo root `.env` is NOT loaded by the Nitro server, hence the local
 * default. Server-only: only import this from server-function handlers.
 */
export interface CmsEnv {
  /** Origin the server fetches from, e.g. http://strapi:1337 inside Docker. */
  apiBase: string;
  /** Origin browsers can reach for media, e.g. http://cms.localhost:1337. */
  mediaBase: string;
}

export const DEFAULT_STRAPI_URL = 'http://localhost:1337';

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getCmsEnv(env: NodeJS.ProcessEnv = process.env): CmsEnv {
  const configured = env.STRAPI_URL?.trim();
  if (!configured && env.NODE_ENV === 'production') {
    console.warn(`[cms] STRAPI_URL is not set — falling back to ${DEFAULT_STRAPI_URL}`);
  }
  const apiBase = trimSlash(configured || DEFAULT_STRAPI_URL);
  const mediaBase = trimSlash(env.STRAPI_PUBLIC_URL?.trim() || apiBase);
  return { apiBase, mediaBase };
}
```

- [ ] **Step 3: Server functions** — `apps/portfolio/src/functions/blog.functions.ts`

```ts
import { createServerFn } from '@tanstack/react-start';
import { fetchArticleBySlug, fetchArticles, type BlogPost } from '@ncam/cms';
import { getCmsEnv } from '../server/cms-env';

/** All published posts as cards (newest first). Runs on the server only. */
export const getBlogPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BlogPost[]> => {
    const { apiBase, mediaBase } = getCmsEnv();
    return fetchArticles(apiBase, mediaBase);
  },
);

/** One published post with its body, or null for an unknown slug. */
export const getBlogPost = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<BlogPost | null> => {
    const { apiBase, mediaBase } = getCmsEnv();
    return fetchArticleBySlug(apiBase, slug, mediaBase);
  });
```

- [ ] **Step 4: Index route** — `apps/portfolio/src/routes/blog/index.tsx`

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import type { BlogPost } from '@ncam/cms';
import { createLogger } from '@ncam/logger';
import { getBlogPosts } from '../../functions/blog.functions';

const log = createLogger({ scope: 'portfolio' });
const SITE_URL = 'https://ncam.dev';
const TITLE = 'Blog — ncam.dev';
const DESCRIPTION =
  'Long-form write-ups on micro-frontends, SSR and motion — the things this site is made of.';

interface LoaderData {
  posts: BlogPost[];
  /** True when the CMS could not be reached (renders a softer empty state). */
  unavailable: boolean;
}

export const Route = createFileRoute('/blog/')({
  loader: async (): Promise<LoaderData> => {
    try {
      return { posts: await getBlogPosts(), unavailable: false };
    } catch (error) {
      log.warn('blog.index-unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { posts: [], unavailable: true };
    }
  },
  staleTime: 60_000,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index,follow' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: `${SITE_URL}/blog` },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/blog` }],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { posts, unavailable } = Route.useLoaderData();
  return (
    <div className="stage blog">
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Home
      </Link>
      <header className="blog__head">
        <p className="blog__label">Blog</p>
        <h1 className="blog__title">Notes from the build</h1>
        <p className="blog__lead">{DESCRIPTION}</p>
      </header>
      {posts.length === 0 ? (
        <p className="blog__empty" role="status">
          {unavailable
            ? 'The blog is taking a short break — please try again in a minute.'
            : 'Nothing published yet.'}
        </p>
      ) : (
        <ul className="blog__list">
          {posts.map((post) => (
            <li key={post.id}>
              <Link to="/blog/$slug" params={{ slug: post.slug }} className="blog-card">
                <p className="blog-card__meta">
                  <time dateTime={post.publishedAt}>{post.dateLabel}</time>
                  <span>{post.readingLabel} read</span>
                </p>
                <h2 className="blog-card__title">{post.title}</h2>
                <p className="blog-card__excerpt">{post.excerpt}</p>
                {post.tags.length > 0 ? (
                  <ul className="blog-card__tags" aria-label="Topics">
                    {post.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Article route** — `apps/portfolio/src/routes/blog/$slug.tsx`

```tsx
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import {
  BlocksRenderer,
  type BlocksComponents,
  type BlocksContent,
} from '@strapi/blocks-react-renderer';
import type { BlogPost } from '@ncam/cms';
import { getBlogPost } from '../../functions/blog.functions';

const SITE_URL = 'https://ncam.dev';

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }): Promise<BlogPost> => {
    const post = await getBlogPost({ data: params.slug });
    if (!post) throw notFound();
    return post;
  },
  staleTime: 60_000,
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: 'Post not found — ncam.dev' }, { name: 'robots', content: 'noindex' }],
      };
    }
    const { seo, slug, publishedAt } = loaderData;
    const title = `${seo.title} · ncam.dev`;
    const url = `${SITE_URL}/blog/${slug}`;
    return {
      meta: [
        { title },
        { name: 'description', content: seo.description },
        { name: 'robots', content: 'index,follow' },
        { property: 'og:type', content: 'article' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: seo.description },
        { property: 'og:url', content: url },
        { property: 'article:published_time', content: publishedAt },
        ...(seo.image
          ? [
              { property: 'og:image', content: seo.image.url },
              { name: 'twitter:image', content: seo.image.url },
            ]
          : []),
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: seo.description },
      ],
      links: [{ rel: 'canonical', href: url }],
    };
  },
  component: BlogPostPage,
});

/** Only two overrides: images are already absolute (mapper), links open safely. */
const blocks: Partial<BlocksComponents> = {
  image: ({ image }) => (
    <figure className="article__figure">
      <img
        src={image.url}
        alt={image.alternativeText ?? ''}
        width={image.width}
        height={image.height}
        loading="lazy"
      />
      {image.caption ? <figcaption>{image.caption}</figcaption> : null}
    </figure>
  ),
  link: ({ url, children }) => {
    const external = /^https?:\/\//i.test(url) && !url.startsWith(SITE_URL);
    return external ? (
      <a href={url} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ) : (
      <a href={url}>{children}</a>
    );
  },
};

function BlogPostPage() {
  const post = Route.useLoaderData();
  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    url,
    ...(post.cover ? { image: post.cover.url } : {}),
    author: { '@type': 'Person', name: 'Minh Nguyen', url: `${SITE_URL}/` },
    keywords: post.tags.join(', '),
  };

  return (
    <div className="stage blog">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link to="/blog" className="stage__back">
        <span aria-hidden="true">←</span> Blog
      </Link>
      <article className="article">
        <header className="article__head">
          <p className="article__meta">
            <time dateTime={post.publishedAt}>{post.dateLabel}</time>
            <span>{post.readingLabel} read</span>
          </p>
          <h1 className="article__title">{post.title}</h1>
          <p className="article__excerpt">{post.excerpt}</p>
          {post.tags.length > 0 ? (
            <ul className="article__tags" aria-label="Topics">
              {post.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}
          {post.cover ? (
            <img
              className="article__cover"
              src={post.cover.url}
              alt={post.cover.alt}
              width={post.cover.width ?? undefined}
              height={post.cover.height ?? undefined}
            />
          ) : null}
        </header>
        <div className="article__body">
          {Array.isArray(post.body) ? (
            <BlocksRenderer content={post.body as BlocksContent} blocks={blocks} />
          ) : null}
        </div>
      </article>
    </div>
  );
}
```

- [ ] **Step 6: Styles** — `apps/portfolio/src/blog.css`

```css
/* Blog pages (/blog, /blog/$slug): the .stage shell plus reading typography.
   Tokens come from @ncam/design-tokens; the stage inset is the host's contract
   with the fixed back button (see styles.css). */
.blog {
  padding: calc(var(--stage-top-inset) + 1.5rem) var(--gutter, 1.5rem) 6rem;
  max-width: 72rem;
  margin: 0 auto;
  color: var(--text);
}

.blog__head {
  max-width: 40rem;
  margin-bottom: 3rem;
}
.blog__label,
.blog-card__meta,
.article__meta {
  font: 500 0.8rem/1.4 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.blog__title,
.article__title {
  font: 700 clamp(2rem, 4vw, 3rem) / 1.1 var(--font-display);
  letter-spacing: -0.02em;
  margin: 0.5rem 0 1rem;
}
.blog__lead,
.article__excerpt {
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--text-muted);
  margin: 0;
}
.blog__empty {
  padding: 2rem;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  color: var(--text-muted);
}

.blog__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
}
.blog-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.2s var(--ease-out),
    transform 0.2s var(--ease-out);
}
.blog-card:hover,
.blog-card:focus-visible {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.blog-card__meta,
.article__meta {
  display: flex;
  gap: 1rem;
  margin: 0;
}
.blog-card__title {
  font: 600 1.25rem/1.3 var(--font-display);
  margin: 0;
}
.blog-card__excerpt {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.55;
}
.blog-card__tags,
.article__tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: auto 0 0;
  padding: 0;
}
.blog-card__tags li,
.article__tags li {
  font: 500 0.75rem/1 var(--font-mono);
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
}

/* Article page */
.article {
  max-width: 44rem;
  margin: 0 auto;
}
.article__head {
  margin-bottom: 2.5rem;
}
.article__tags {
  margin-top: 1rem;
}
.article__cover {
  display: block;
  width: 100%;
  height: auto;
  margin-top: 2rem;
  border-radius: 1rem;
  border: 1px solid var(--border);
}
.article__body {
  font-size: 1.0625rem;
  line-height: 1.75;
}
.article__body > * + * {
  margin-top: 1.25em;
}
.article__body h2,
.article__body h3,
.article__body h4 {
  font-family: var(--font-display);
  line-height: 1.25;
  margin-top: 2.25em;
  letter-spacing: -0.01em;
}
.article__body h2 {
  font-size: 1.75rem;
}
.article__body h3 {
  font-size: 1.375rem;
}
.article__body h4 {
  font-size: 1.125rem;
}
.article__body a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
.article__body ul,
.article__body ol {
  padding-left: 1.5rem;
}
.article__body li + li {
  margin-top: 0.4em;
}
.article__body blockquote {
  margin: 1.5em 0;
  padding: 0.25em 0 0.25em 1.25em;
  border-left: 3px solid var(--accent);
  color: var(--text-muted);
  font-style: italic;
}
.article__body pre {
  padding: 1.25rem;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-2);
  font: 0.875rem/1.6 var(--font-mono);
}
.article__body code {
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.article__body :not(pre) > code {
  padding: 0.15em 0.4em;
  border-radius: 0.35em;
  background: var(--surface-2);
}
.article__figure {
  margin: 2em 0;
}
.article__figure img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
}
.article__figure figcaption {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  text-align: center;
}
```

In `apps/portfolio/src/app.css` append after the `home.css` import:

```css
@import './blog.css';
```

- [ ] **Step 7: Cache rules** — in `apps/portfolio/vite.config.ts`, replace the top-level `nitro: { … }` block (lines 59–69) with:

```ts
  nitro: {
    // Keep react/react-dom + MF runtime as Node externals so all server-side
    // code shares one require() module instance (hooks/context stay intact).
    traceDeps: [
      'react',
      'react-dom',
      '@module-federation/runtime',
      '@module-federation/runtime-core',
      '@module-federation/sdk',
    ],
    // Blog content changes without a deploy: serve cached HTML for 60 s and
    // revalidate in the background (Vercel maps swr to ISR; node-server caches in memory).
    routeRules: {
      '/': { swr: 60 },
      '/blog': { swr: 60 },
      '/blog/**': { swr: 60 },
    },
  },
```

- [ ] **Step 8: Env documentation and Docker runtime env**

Append to the root `.env` (after the `PROFILE_BASE` comment block):

```
# ── Blog CMS (Strapi) — read at RUNTIME by the portfolio server ─────────
# The Nitro server reads process.env, not this file: set these in the shell,
# docker-compose (`portfolio.environment`) or the Vercel project. Defaults below
# match local dev (`pnpm --filter @ncam/strapi dev`).
# STRAPI_URL        = origin the server fetches articles from
# STRAPI_PUBLIC_URL = origin browsers reach for media (defaults to STRAPI_URL)
STRAPI_URL=http://localhost:1337
# STRAPI_PUBLIC_URL=http://localhost:1337
```

In `docker-compose.yml`, the `portfolio` service `environment:` block becomes:

```yaml
environment:
  NODE_ENV: production
  HOST: 0.0.0.0
  PORT: '9000'
  # Blog CMS (runtime; see .env). Needs the `cms` profile up — otherwise the
  # host renders placeholders / an empty blog instead of failing.
  STRAPI_URL: http://strapi:1337
  STRAPI_PUBLIC_URL: http://cms.localhost:1337
```

In the spec `docs/superpowers/specs/2026-09-15-blog-frontend-design.md` §4, replace the bullet starting "- Read **at request time** in the Nitro server via a tiny `src/server/cms-env.ts` helper" so it reads:

```markdown
- Read **at request time** in the Nitro server via a tiny `src/server/cms-env.ts`
  helper (`getCmsEnv()` → `{ apiBase, mediaBase }`). When `STRAPI_URL` is unset it
  falls back to `http://localhost:1337` (the Nitro server never loads the root
  `.env`, so this keeps `vite dev`/`preview` zero-config) and warns in production.
  Never through `import.meta.env`/`define`, so nothing is baked and the same image
  runs in every environment.
```

- [ ] **Step 9: Build (regenerates the route tree), then typecheck**

```bash
pnpm prettier --write apps/portfolio/src apps/portfolio/vite.config.ts docker-compose.yml docs/superpowers/specs/2026-09-15-blog-frontend-design.md
pnpm --filter @ncam/portfolio build 2>&1 | tail -5
git status --short
pnpm --filter @ncam/portfolio typecheck
```

Expected: the build ends with the Nitro output lines; `git status` shows `apps/portfolio/src/routeTree.gen.ts` modified (new `/blog/` and `/blog/$slug` routes) — commit it with this task; typecheck clean (the typed `Link to` targets exist once the tree is regenerated). If `tsc` rejects the renderer's `image` props (`width`/`height`/`alternativeText` typing), keep the JSX for the optional numbers and switch to `alt={image.alternativeText ?? undefined}` — record the exact error in the report.

- [ ] **Step 10: Seed one published article (throwaway, idempotent)**

Create `apps/strapi/.tmp/seed-smoke-article.cjs`:

```js
// Throwaway: makes sure one published article exists for the phase-2 smoke checks.
//   cd apps/strapi && pnpm build && NODE_ENV=production node .tmp/seed-smoke-article.cjs
const { createStrapi } = require('@strapi/strapi');

const SLUG = 'hello-blog-smoke';

(async () => {
  const app = await createStrapi({ distDir: './dist' }).load();
  const articles = app.documents('api::article.article');
  const tags = app.documents('api::tag.tag');

  const existing = await articles.findFirst({ filters: { slug: SLUG }, status: 'published' });
  if (existing) {
    console.log('SEED OK (already published)', SLUG);
  } else {
    let tag = await tags.findFirst({ filters: { slug: 'react' } });
    tag ??= await tags.create({ data: { name: 'React', slug: 'react' } });
    await articles.create({
      data: {
        title: 'Hello from the blog smoke test',
        slug: SLUG,
        excerpt: 'A published article the phase-2 smoke checks read through the portfolio host.',
        body: [
          { type: 'heading', level: 2, children: [{ type: 'text', text: 'Smoke heading' }] },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Smoke paragraph body text with a ' },
              {
                type: 'link',
                url: 'https://strapi.io',
                children: [{ type: 'text', text: 'link' }],
              },
              { type: 'text', text: '.' },
            ],
          },
          { type: 'code', children: [{ type: 'text', text: 'const smoke = true;' }] },
        ],
        tags: [tag.documentId],
      },
      status: 'published',
    });
    console.log('SEED OK (created)', SLUG);
  }
  await app.destroy();
  process.exit(0);
})().catch((error) => {
  console.error('SEED FAILED', error);
  process.exit(1);
});
```

Run (Strapi must NOT be running while the seed script holds the SQLite file):

```bash
lsof -ti :1337 && echo "stop Strapi first" || echo "1337 free"
pnpm --filter @ncam/strapi build 2>&1 | grep -E "✔|✖"
(cd apps/strapi && NODE_ENV=production node .tmp/seed-smoke-article.cjs 2>&1 | grep -E "SEED")
```

Expected: `SEED OK (created) hello-blog-smoke` (or "already published" on later runs).

- [ ] **Step 11: Smoke the blog pages against the built host**

```bash
(cd apps/strapi && NODE_ENV=production pnpm start > .tmp/phase2-strapi.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'strapi=%{http_code}\n' http://127.0.0.1:1337/_health
(cd apps/portfolio && STRAPI_URL=http://localhost:1337 PORT=9000 node .output/server/index.mjs > .output/host-smoke.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'index=%{http_code}\n' http://127.0.0.1:9000/blog
curl -s http://127.0.0.1:9000/blog > /tmp/blog-index.html
grep -c "Hello from the blog smoke test" /tmp/blog-index.html
grep -c 'href="/blog/hello-blog-smoke"' /tmp/blog-index.html
grep -o '<title>[^<]*</title>' /tmp/blog-index.html
curl -s -o /dev/null -w 'post=%{http_code}\n' http://127.0.0.1:9000/blog/hello-blog-smoke
curl -s http://127.0.0.1:9000/blog/hello-blog-smoke > /tmp/post.html
grep -c "Smoke paragraph body text" /tmp/post.html
grep -c "<h2>Smoke heading</h2>" /tmp/post.html
grep -c 'rel="noopener noreferrer" target="_blank"' /tmp/post.html
grep -o '<title>[^<]*</title>' /tmp/post.html
grep -c 'content="article"' /tmp/post.html
grep -c '"@type":"BlogPosting"' /tmp/post.html
curl -s -o /dev/null -w 'unknown=%{http_code}\n' http://127.0.0.1:9000/blog/does-not-exist
kill $(lsof -ti :9000); kill $(lsof -ti :1337); lsof -ti :9000 -i :1337 || echo "ports free"
```

Expected: `strapi=204`, `index=200`, index greps `1` each, `<title>Blog — ncam.dev</title>`; `post=200`, post greps `1` each, `<title>Hello from the blog smoke test · ncam.dev</title>`; `unknown=404`; `ports free`. Then the CMS-down path: with Strapi stopped, start only the host again and check `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9000/blog` → `200` and the body contains "taking a short break"; stop the host.

- [ ] **Step 12: Gates + commit**

```bash
pnpm lint && pnpm format:check && pnpm test && pnpm --filter @ncam/cms typecheck
git add apps/portfolio/package.json pnpm-lock.yaml apps/portfolio/src/server apps/portfolio/src/functions apps/portfolio/src/routes/blog apps/portfolio/src/blog.css apps/portfolio/src/app.css apps/portfolio/vite.config.ts apps/portfolio/src/routeTree.gen.ts .env docker-compose.yml docs/superpowers/specs/2026-09-15-blog-frontend-design.md
git commit -m "feat(portfolio): add the /blog pages backed by Strapi"
```

---

### Task 4: Remote — props-capable section modules and real blog cards

**Files:**

- Modify: `apps/profile/src/lib/section-module.tsx` (full replacement), `apps/profile/src/modules/blog.tsx` (full replacement), `apps/profile/src/components/blogs.tsx` (full replacement), `apps/profile/package.json` (devDependency)

**Interfaces:**

- Consumes: `BlogPost` type from `@ncam/cms` (Task 1).
- Produces (consumed by Task 5): `SectionModule<P = undefined>` with `ssr(props?: P)`, `hydrate(target, props?: P)`, `mount(target, props?: P)`; `renderSection<P>(renderToString, Component, props?)`, `createClientModule<P>(Component)`; `BlogSectionProps = { posts?: BlogPost[] }` exported from `components/blogs.tsx`; the blog module's `ssr/hydrate/mount` accept `BlogSectionProps`; cards link to `/blog/<slug>`.

- [ ] **Step 1: devDependency**

In `apps/profile/package.json` `devDependencies` add `"@ncam/cms": "workspace:*"` (alphabetical: after `@fontsource-variable/syne`, before `@ncam/mf-remote`). Run `pnpm install`. It is a devDependency on purpose: the remote imports only types, and the bundle stays self-contained (`shared: {}`).

- [ ] **Step 2: Section-module helpers** — replace `apps/profile/src/lib/section-module.tsx` with

```tsx
import { StrictMode, createElement, type Attributes, type ComponentType } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import css from '../styles/profile.css?inline';

export interface SectionSSRResult {
  html: string;
  /** The remote's compiled CSS — identical for every section; the host inlines it once. */
  css: string;
}

/**
 * Shape of every exposed `./<section>` module. `P` is the optional props object
 * the host may pass (only the blog section uses one today); the same value must
 * reach `ssr()` on the server and `hydrate()` on the client or hydration mismatches.
 */
export interface SectionModule<P = undefined> {
  /** Server: render the section to markup. Browser-free (react-dom/server is imported lazily). */
  ssr(props?: P): Promise<SectionSSRResult>;
  /** Client: attach React to server-rendered markup already inside `target`. Returns a disposer. */
  hydrate(target: HTMLElement, props?: P): () => void;
  /** Client: render from scratch into `target` (no SSR available). Returns a disposer. */
  mount(target: HTMLElement, props?: P): () => void;
}

const STYLE_ID = 'profile-styles';
const roots = new WeakMap<HTMLElement, Root>();

/** CSR path only — the SSR path gets `css` back from `ssr()` and inlines it itself. */
function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}

function dispose(target: HTMLElement): void {
  const root = roots.get(target);
  if (!root) return;
  roots.delete(target);
  // Six modules share one <style>; it stays for the page's lifetime.
  queueMicrotask(() => root.unmount());
}

/** The element a section renders: StrictMode around the component with the (optional) props. */
function sectionElement<P>(Component: ComponentType<P>, props: P | undefined) {
  return createElement(StrictMode, null, createElement(Component, (props ?? {}) as P & Attributes));
}

/**
 * Server half of a section module. Each `src/modules/*` entry passes in
 * `renderToString` from its OWN lazy `import('react-dom/server')`: that keeps the
 * server-only chunk a dependant of the shared chunk (this file + React) rather
 * than the other way round. If the lazy import lived here, the shared chunk and
 * the server chunk would import each other, and the host's SSR entry loader
 * (which fetches chunks into temp files) deadlocks on that cycle.
 */
export function renderSection<P>(
  renderToString: (node: React.ReactNode) => string,
  Component: ComponentType<P>,
  props?: P,
): SectionSSRResult {
  return { html: renderToString(sectionElement(Component, props)), css };
}

/**
 * Client half of a section module: hydrate / mount into a slot. Each section is
 * its own React root inside the same remote bundle, so the six sections share
 * one React and one GSAP instance while the host mounts them independently.
 * The element is built per call so the props the host passes reach the component.
 */
export function createClientModule<P>(
  Component: ComponentType<P>,
): Pick<SectionModule<P>, 'hydrate' | 'mount'> {
  return {
    hydrate(target, props) {
      dispose(target);
      const root = hydrateRoot(target, sectionElement(Component, props));
      roots.set(target, root);
      return () => dispose(target);
    },
    mount(target, props) {
      injectStyles(target.ownerDocument ?? document);
      dispose(target);
      const root = createRoot(target);
      root.render(sectionElement(Component, props));
      roots.set(target, root);
      return () => dispose(target);
    },
  };
}
```

The five other modules (`hero`, `stacks`, `experience`, `projects`, `contact`) keep their current code: `renderSection(renderToString, Hero)` infers `P` from the component and `SectionModule['ssr']` (P = `undefined`) still matches an `async () => …`. If `tsc` complains about one of them, the fix is to type the export as `SectionModule<Record<string, never>>['ssr']` — report it rather than changing behaviour.

- [ ] **Step 3: Blog module** — replace `apps/profile/src/modules/blog.tsx` with

```tsx
import { Blogs, type BlogSectionProps } from '../components/blogs';
import { createClientModule, renderSection, type SectionModule } from '../lib/section-module';

// The lazy react-dom/server import stays in this entry file on purpose (chunk
// cycle otherwise — see lib/section-module.tsx).
export const ssr: SectionModule<BlogSectionProps>['ssr'] = async (props) => {
  const { renderToString } = await import('react-dom/server');
  return renderSection(renderToString, Blogs, props);
};
export const { hydrate, mount } = createClientModule<BlogSectionProps>(Blogs);
```

- [ ] **Step 4: Blog section component** — replace `apps/profile/src/components/blogs.tsx` with

```tsx
import { ArrowUpRight } from 'lucide-react';
import type { BlogPost } from '@ncam/cms';
import { posts as placeholderPosts, type Post } from '../data/profile';
import { useRevealChildren } from '../lib/gsap';
import { SectionHead } from './section-head';

/** Props the portfolio host passes in (server-fetched from Strapi). Empty → placeholders. */
export interface BlogSectionProps {
  posts?: BlogPost[];
}

const LEAD_LIVE =
  'Long-form write-ups on micro-frontends, SSR and motion — the things this site is made of.';
const LEAD_DRAFTS = `${LEAD_LIVE} First posts land soon; titles below are the drafts in progress.`;

/** A published post → the card shape the placeholders already use. */
function toCard(post: BlogPost): Post {
  return {
    id: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.dateLabel,
    readingTime: post.readingLabel,
    tags: post.tags,
    href: `/blog/${post.slug}`,
  };
}

function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const className = `post${featured ? ' post--featured' : ''}`;
  const body = (
    <>
      <p className="post__meta">
        <span>{post.date}</span>
        <span>{post.readingTime} read</span>
      </p>
      <h3 className="post__title">{post.title}</h3>
      <p className="post__excerpt">{post.excerpt}</p>
      <ul className="post__tags" aria-label="Topics">
        {post.tags.map((tag) => (
          <li key={tag} className="chip">
            {tag}
          </li>
        ))}
      </ul>
      <p className="post__state">
        {post.href ? (
          <>
            Read the post <ArrowUpRight size={14} aria-hidden="true" />
          </>
        ) : (
          'Publishing soon'
        )}
      </p>
    </>
  );
  return post.href ? (
    <a href={post.href} className={className}>
      {body}
    </a>
  ) : (
    <article className={className}>{body}</article>
  );
}

export function Blogs({ posts }: BlogSectionProps = {}) {
  const live = posts !== undefined && posts.length > 0;
  const cards = live ? posts.map(toCard) : placeholderPosts;
  const [featured, ...rest] = cards;
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 36, stagger: 0.12 });

  return (
    <section id="blog" className="sec blog" aria-labelledby="blog-title">
      <div className="sec__inner">
        <SectionHead
          label="Blog"
          title={
            <span id="blog-title">
              Notes from the <em>build</em>
            </span>
          }
          lead={live ? LEAD_LIVE : LEAD_DRAFTS}
        />
        <div ref={gridRef} className="blog__grid">
          <PostCard post={featured} featured />
          <div className="blog__list">
            {rest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Typecheck, build, bundle check**

```bash
pnpm prettier --write apps/profile/src
pnpm --filter @ncam/profile typecheck
pnpm --filter @ncam/profile build 2>&1 | grep -E "remoteEntry|built in|error" | head -5
grep -l "ncam/cms" apps/profile/dist/assets/*.js || echo "no @ncam/cms runtime code in the bundle (expected)"
```

Expected: typecheck clean; the build emits `dist/remoteEntry.js` and `dist/remoteEntry.ssr.js`; the grep prints the "expected" line (type-only import leaves no trace). Then a quick standalone preview to prove the remote still serves without props: `(cd apps/profile && pnpm preview --port 9006 > /tmp/profile-preview.log 2>&1 &)`, `curl --retry-connrefused --retry 30 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'remote=%{http_code}\n' http://127.0.0.1:9006/remoteEntry.js` → `remote=200`, then `kill $(lsof -ti :9006)`.

- [ ] **Step 6: Gates + commit**

```bash
pnpm lint && pnpm format:check && pnpm test
git add apps/profile/package.json pnpm-lock.yaml apps/profile/src/lib/section-module.tsx apps/profile/src/modules/blog.tsx apps/profile/src/components/blogs.tsx
git commit -m "feat(profile): let section modules receive props and render real blog posts"
```

---

### Task 5: Host — feed the home blog section and intercept `/blog/*` links

**Files:**

- Modify: `apps/portfolio/src/routes/index.tsx` (full replacement below), `apps/portfolio/src/types/remote/profile.d.ts` (full replacement below)

**Interfaces:**

- Consumes: `getBlogPosts` (Task 3), `BlogPost` (Task 1), the props-capable module contract (Task 4).
- Produces: `LoaderData.posts`; `useInternalLinks` (replaces `useProjectLinks`).

- [ ] **Step 1: Ambient types** — replace `apps/portfolio/src/types/remote/profile.d.ts` with

```ts
// Type declarations for the federated `profile` remote: one module per home-page
// section, all with the same { ssr, hydrate, mount } shape (see
// apps/profile/src/lib/section-module.tsx). Modules may accept an optional props
// object — the host passes `{ posts }` to `profile/blog`, nothing to the others.

interface ProfileSectionSSRResult {
  html: string;
  css: string;
}

interface ProfileSectionModule<P = unknown> {
  ssr(props?: P): Promise<ProfileSectionSSRResult>;
  hydrate(target: HTMLElement, props?: P): () => void;
  mount(target: HTMLElement, props?: P): () => void;
}

declare module 'profile/hero' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/stacks' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/experience' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/projects' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/blog' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
declare module 'profile/contact' {
  export const ssr: ProfileSectionModule['ssr'];
  export const hydrate: ProfileSectionModule['hydrate'];
  export const mount: ProfileSectionModule['mount'];
  const module: ProfileSectionModule;
  export default module;
}
```

- [ ] **Step 2: Home route** — replace `apps/portfolio/src/routes/index.tsx` with

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlogPost } from '@ncam/cms';
import { createLogger } from '@ncam/logger';
import { HomeNav } from '../components/home/nav';
import { ManifestRail, type LoadState } from '../components/home/manifest-rail';
import { sections, type SectionMeta } from '../data/sections';
import { getBlogPosts } from '../functions/blog.functions';
import { loadRemoteModuleSSR, SSR_LOAD_TIMEOUT_MS } from '../lib/federation';
import { ScrollTrigger } from '../lib/gsap';
import { useSectionTracker } from '../lib/use-section-tracker';

const log = createLogger({ scope: 'portfolio' });

const SITE_URL = 'https://ncam.dev';
/** The remote that exposes the home-page sections (see apps/profile). */
const REMOTE = 'profile';
/** Total server-side budget for rendering the home sections (see the loader). */
const SSR_PAGE_BUDGET_MS = 4_000;
/** The one section that takes data from the host. */
const BLOG_MODULE = 'blog';

// Public facts for SEO (the full content lives in the remote's data file).
const PERSON = {
  name: 'Minh Nguyen',
  alternateName: ['Matthew', 'Nguyen Cao Anh Minh'],
  jobTitle: 'Frontend Developer',
  worksFor: 'NAVER Vietnam',
  sameAs: [
    'https://www.linkedin.com/in/nguyencaoanhminh',
    'https://github.com/annminn104',
    'https://www.facebook.com/Minhmin0507',
  ],
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'ncam.dev',
      url: `${SITE_URL}/`,
      description: `Portfolio of ${PERSON.alternateName[0]} (${PERSON.name}), ${PERSON.jobTitle} — micro-frontends, motion and high-performance web apps.`,
    },
    {
      '@type': 'Person',
      name: PERSON.name,
      alternateName: PERSON.alternateName,
      url: `${SITE_URL}/`,
      jobTitle: PERSON.jobTitle,
      worksFor: { '@type': 'Organization', name: PERSON.worksFor },
      sameAs: PERSON.sameAs,
    },
  ],
};

/** Props the host hands to a section module (only the blog section takes any). */
type SectionProps = { posts: BlogPost[] } | undefined;

/** Shape of every `profile/<module>` (see apps/profile/src/lib/section-module.tsx). */
type SectionModule = {
  ssr(props?: SectionProps): Promise<{ html: string; css: string }>;
  hydrate(target: HTMLElement, props?: SectionProps): () => void;
  mount(target: HTMLElement, props?: SectionProps): () => void;
};

// Static import specifiers so the Module Federation plugin can transform them —
// one per exposed module, keyed by `SectionMeta.module`.
const loaders: Record<string, () => Promise<SectionModule>> = {
  hero: () => import('profile/hero'),
  stacks: () => import('profile/stacks'),
  experience: () => import('profile/experience'),
  projects: () => import('profile/projects'),
  blog: () => import('profile/blog'),
  contact: () => import('profile/contact'),
};

interface LoaderData {
  /** Server-rendered markup per module (missing → client mount). */
  html: Record<string, string>;
  /** The remote's CSS (one copy — every module returns the same string). */
  css: string;
  /** Published blog posts from the CMS (empty when unavailable → the remote shows placeholders). */
  posts: BlogPost[];
}

function propsFor(module: string, posts: BlogPost[]): SectionProps {
  return module === BLOG_MODULE ? { posts } : undefined;
}

export const Route = createFileRoute('/')({
  // Server-render every section through the federation runtime so the page is
  // complete, styled and crawlable on first paint. Only wired in the production
  // server build (`vite dev` cannot resolve federated SSR) — otherwise, and for
  // any module that fails, the client mounts that section instead.
  loader: async (): Promise<LoaderData> => {
    // Blog posts come from the CMS in every mode (a server function: direct call
    // during SSR, RPC on client navigations). Unavailable → empty → placeholders.
    const posts = await getBlogPosts().catch((error: unknown) => {
      log.warn('home.blog-posts-unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [] as BlogPost[];
    });
    const data: LoaderData = { html: {}, css: '', posts };
    if (!import.meta.env.PROD || !import.meta.env.SSR) return data;
    // One budget for the whole page: serverless hosts cap a request (Vercel Hobby:
    // 10 s), so a slow remote must cost sections their SSR, never the response.
    const deadline = Date.now() + SSR_PAGE_BUDGET_MS;
    // Sequential on purpose: the first federated import also boots the host's MF
    // runtime for this process, and kicking six of those off concurrently
    // deadlocks the runtime's init. Later modules reuse the cached remote entry.
    for (const section of sections) {
      const load = loaders[section.module];
      if (!load) continue;
      const remaining = deadline - Date.now();
      if (remaining < 250) {
        log.warn('home.ssr-budget-exhausted', { module: section.module });
        continue;
      }
      try {
        const mod = await loadRemoteModuleSSR<SectionModule>(
          REMOTE,
          section.module,
          load,
          Math.min(SSR_LOAD_TIMEOUT_MS, remaining),
        );
        if (typeof mod.ssr !== 'function') {
          throw new Error(`${REMOTE}/${section.module} does not export ssr()`);
        }
        const { html, css } = await mod.ssr(propsFor(section.module, posts));
        data.html[section.module] = html;
        data.css ||= css;
      } catch (error) {
        log.warn('home.ssr-fallback', {
          module: section.module,
          error: error instanceof Error ? (error.stack ?? error.message) : String(error),
        });
      }
    }
    log.debug('home.ssr', { modules: Object.keys(data.html), posts: posts.length });
    return data;
  },
  head: () => ({
    meta: [
      { name: 'robots', content: 'index,follow' },
      { property: 'og:url', content: `${SITE_URL}/` },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/` }],
  }),
  component: HomePage,
});

/**
 * Re-measure every ScrollTrigger once late-arriving layout settles: fonts
 * swapping in, and hydration landing after the window `load` event.
 */
function useScrollTriggerRefresh() {
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    const timer = window.setTimeout(refresh, 800);
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) refresh();
    });
    window.addEventListener('load', refresh);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('load', refresh);
    };
  }, []);
}

/**
 * The remote renders plain `<a href="/projects/…">` and `<a href="/blog/…">`
 * links (it has no router); turn them into client-side navigations so the stage
 * and blog routes open without a full page load.
 */
function useInternalLinks(rootRef: React.RefObject<HTMLElement | null>) {
  const navigate = useNavigate();
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.(
        'a[href^="/projects/"], a[href^="/blog/"]',
      );
      const href = anchor?.getAttribute('href');
      if (!href) return;
      event.preventDefault();
      void navigate({ href });
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [navigate, rootRef]);
}

interface SectionSlotProps {
  section: SectionMeta;
  html: string | undefined;
  props: SectionProps;
  onState: (module: string, state: LoadState) => void;
}

/**
 * One federated section. The div is `display: contents`, so the module's own
 * <section> becomes the page-level element the nav/rail/tracker key off. With
 * SSR markup present the module hydrates it; otherwise it mounts from scratch.
 * `props` is the exact object the server rendered with (from loader data).
 */
function SectionSlot({ section, html, props, onState }: SectionSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = ref.current;
    const load = loaders[section.module];
    if (!target || !load) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    onState(section.module, 'loading');
    load()
      .then((mod) => {
        if (cancelled || !ref.current) return;
        dispose = html ? mod.hydrate(ref.current, props) : mod.mount(ref.current, props);
        log.info('home.module', {
          module: section.module,
          mode: html ? 'ssr-hydrate' : 'csr-mount',
        });
        onState(section.module, 'ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        log.error('home.module-failed', { module: section.module, error: message });
        setError(message);
        onState(section.module, 'error');
      });
    return () => {
      cancelled = true;
      try {
        dispose?.();
      } catch {
        /* ignore disposer errors */
      }
    };
  }, [section.module, html, props, onState]);

  return (
    <>
      <div
        ref={ref}
        className="mf-slot"
        data-module={`./${section.module}`}
        {...(html ? { dangerouslySetInnerHTML: { __html: html } } : {})}
      />
      {error ? (
        <div className="mf-slot__error" id={section.id} role="alert">
          <div className="mf-slot__error-card">
            <strong>./{section.module}</strong> could not be mounted — <code>{error}</code>
            <br />
            Make sure the <code>{REMOTE}</code> remote is running (<code>pnpm dev</code> at the repo
            root), then reload.
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * The portfolio home: a shell (nav + manifest rail + page-level transitions)
 * around six federated modules from the `profile` remote — each section is
 * loaded, server-rendered and mounted exactly like the project remotes are.
 */
function HomePage() {
  const { html, css, posts } = Route.useLoaderData();
  const homeRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] = useState<Record<string, LoadState>>(() =>
    Object.fromEntries(sections.map((section) => [section.module, 'idle'])),
  );
  const onState = useCallback((module: string, state: LoadState) => {
    setLoadState((prev) => (prev[module] === state ? prev : { ...prev, [module]: state }));
  }, []);
  // One stable props object per module: the slot effect depends on it, and the
  // rail's state updates re-render this component while modules are still loading.
  const sectionProps = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => [section.module, propsFor(section.module, posts)]),
      ) as Record<string, SectionProps>,
    [posts],
  );

  const settled = sections.every((section) => {
    const state = loadState[section.module];
    return state === 'ready' || state === 'error';
  });
  const { active, visited } = useSectionTracker(homeRef, settled);
  useScrollTriggerRefresh();
  useInternalLinks(homeRef);

  return (
    <div ref={homeRef} className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Remote CSS from the SSR pass; on the client-mount path the module injects it itself. */}
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <HomeNav active={active} />
      <ManifestRail active={active} visited={visited} loadState={loadState} />
      <main>
        {sections.map((section) => (
          <SectionSlot
            key={section.module}
            section={section}
            html={html[section.module]}
            props={sectionProps[section.module]}
            onState={onState}
          />
        ))}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build both apps**

```bash
pnpm prettier --write apps/portfolio/src
pnpm --filter @ncam/portfolio typecheck
pnpm --filter @ncam/profile build 2>&1 | grep -E "built in|error" | head -3
pnpm --filter @ncam/portfolio build 2>&1 | tail -3
```

Expected: clean typecheck; both builds succeed. If `navigate({ href })` fails to typecheck, use `void navigate({ to: href as '/' })` and note it in the report.

- [ ] **Step 4: Smoke the home page with real posts, then with the CMS down**

```bash
(cd apps/strapi && NODE_ENV=production pnpm start > .tmp/phase2-strapi.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'strapi=%{http_code}\n' http://127.0.0.1:1337/_health
(cd apps/profile && pnpm preview --port 9006 > /tmp/profile-preview.log 2>&1 &)
curl --retry-connrefused --retry 30 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'remote=%{http_code}\n' http://127.0.0.1:9006/remoteEntry.js
(cd apps/portfolio && STRAPI_URL=http://localhost:1337 PORT=9000 node .output/server/index.mjs > .output/host-smoke.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'home=%{http_code}\n' http://127.0.0.1:9000/
curl -s http://127.0.0.1:9000/ > /tmp/home.html
grep -c 'id="blog"' /tmp/home.html
grep -c "Hello from the blog smoke test" /tmp/home.html
grep -c 'href="/blog/hello-blog-smoke"' /tmp/home.html
grep -c "Publishing soon" /tmp/home.html
kill $(lsof -ti :1337)
kill $(lsof -ti :9000)
(cd apps/portfolio && STRAPI_URL=http://localhost:1337 PORT=9000 node .output/server/index.mjs > .output/host-smoke-down.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'home-cms-down=%{http_code}\n' http://127.0.0.1:9000/
curl -s http://127.0.0.1:9000/ | grep -c "Publishing soon"
grep -c "home.blog-posts-unavailable" apps/portfolio/.output/host-smoke-down.log
kill $(lsof -ti :9000); kill $(lsof -ti :9006); lsof -ti :9000 -i :9006 -i :1337 || echo "ports free"
```

Expected: `strapi=204`, `remote=200`, `home=200`; `id="blog"` ≥ 1; smoke title ≥ 1; blog link ≥ 1; "Publishing soon" `0` (real posts replace the placeholders); with the CMS down: `home-cms-down=200`, "Publishing soon" ≥ 1, the warn line ≥ 1; `ports free`. If the blog section SSR fell back (title count 0 but the page is 200), read `.output/host-smoke.log` for `home.ssr-fallback` — the remote build must be the Task 4 build (rebuild it) and the host build must be from this task.

- [ ] **Step 5: Gates + commit**

```bash
pnpm lint && pnpm format:check && pnpm test
git add apps/portfolio/src/routes/index.tsx apps/portfolio/src/types/remote/profile.d.ts
git commit -m "feat(portfolio): feed the home blog section from Strapi"
```

---

### Task 6: Documentation

**Files:**

- Modify: `apps/portfolio/AGENTS.md`, `apps/profile/AGENTS.md`, `AGENTS.md` (root layout), `README.md`

- [ ] **Step 1: `apps/portfolio/AGENTS.md`**

(a) In "How it works", after the `projects/$projectId.tsx` bullet, add:

```markdown
- `blog/index.tsx` and `blog/$slug.tsx` — the **blog**, read from the Strapi
  CMS (`apps/strapi`) through **server functions** in
  `src/functions/blog.functions.ts` (`getBlogPosts`, `getBlogPost`), which call
  `@ncam/cms` with the runtime env from `src/server/cms-env.ts`
  (`STRAPI_URL`, `STRAPI_PUBLIC_URL`; default `http://localhost:1337`). The
  browser never talks to Strapi. `$slug` throws `notFound()` for unknown slugs,
  sets full SEO meta in `head()` and renders the Blocks body with
  `@strapi/blocks-react-renderer` (overrides: `image`, `link`). Styles in
  `src/blog.css`. Nitro `routeRules` cache `/`, `/blog`, `/blog/**` with
  `swr: 60`, so a publish shows up within a minute.
```

(b) In "Home page (`/`) — six federated modules", change the shape sentence `all shaped `{ ssr(), hydrate(el), mount(el) }`.` to `all shaped `{ ssr(props?), hydrate(el, props?), mount(el, props?) }`— only`profile/blog` takes props (`{ posts }`).` and add a bullet after the "Route `loader` (prod server only)" bullet:

```markdown
- **Blog data.** The loader first calls the `getBlogPosts()` server function (in
  every mode; failure → `[]` + `home.blog-posts-unavailable` warn), stores the
  posts in loader data and passes `{ posts }` to `profile/blog`'s `ssr()` on the
  server and to `hydrate()`/`mount()` on the client — the same serialized array,
  so hydration matches. Empty posts → the remote renders its placeholders.
```

(c) Replace the bullet "Project cards inside the remote are plain `<a href="/projects/…">`; the route intercepts those clicks and navigates client-side." with:

```markdown
- Cards inside the remote are plain `<a href="/projects/…">` / `<a href="/blog/…">`;
  `useInternalLinks` intercepts those clicks and navigates client-side.
```

(d) In "Rules", change the "Registry drives display" bullet's last sentence to end with `+ `src/types/remote/profile.d.ts`.` (the file lives under `src/`), and add a rule:

```markdown
- **CMS access is server-only.** Fetch Strapi inside `createServerFn` handlers
  only (`src/functions/*.functions.ts`); read `STRAPI_URL`/`STRAPI_PUBLIC_URL`
  through `getCmsEnv()` at request time — never via `import.meta.env`/`define`.
```

(e) In "Deploy", append: `Set `STRAPI_URL`and`STRAPI_PUBLIC_URL`on the Vercel project (both`https://cms.<domain>`); docker-compose sets them on the `portfolio` service.`

- [ ] **Step 2: `apps/profile/AGENTS.md`**

(a) Replace the shape block

```ts
ssr(): Promise<{ html, css }>   // server: renderToString + the remote's CSS (same string for all)
hydrate(target): () => void     // client: attach React to server-rendered markup
mount(target): () => void       // client: render from scratch (no SSR) — injects the CSS once
```

with

```ts
ssr(props?): Promise<{ html, css }>    // server: renderToString + the remote's CSS (same string for all)
hydrate(target, props?): () => void    // client: attach React to server-rendered markup
mount(target, props?): () => void      // client: render from scratch (no SSR) — injects the CSS once
```

and add right after it:

```markdown
`props` is optional and only `./blog` uses it: `{ posts?: BlogPost[] }`
(`BlogPost` is a type-only import from `@ncam/cms`, a devDependency — the
bundle stays self-contained). The host must pass the **same** props object to
`ssr()` on the server and `hydrate()` on the client. No posts → the four
placeholder drafts from `data/profile.ts` render, with the "publishing soon" copy.
```

(b) Fix the drift: change "server-renders them in parallel through the MF runtime" to "server-renders them **sequentially** through the MF runtime (concurrent federated imports deadlock the runtime init)"; change "each wraps one section component with `createSectionModule()`." to "each exports `ssr` (via `renderSection()`, keeping its own lazy `react-dom/server` import) and `{ hydrate, mount }` from `createClientModule()`."

(c) In "Contracts with the host", replace "The projects section renders plain `<a href="/projects/<id>">`; the host intercepts those clicks for client-side navigation." with "The projects and blog sections render plain `<a href="/projects/<id>">` / `<a href="/blog/<slug>">`; the host intercepts those clicks for client-side navigation."

- [ ] **Step 3: Root `AGENTS.md`** — in the layout tree under `packages/`, add after the `logger/` line:

```
  cms/               Typed Strapi client + BlogPost view-model (@ncam/cms), server-side use.
```

- [ ] **Step 4: `README.md`**

(a) Configuration table — add a row after the `*_BASE` row:

```markdown
| `STRAPI_URL`, `STRAPI_PUBLIC_URL` | Blog CMS origin the **portfolio server** fetches from, and the origin browsers reach for media (defaults to `STRAPI_URL`). **Runtime** env — not baked; default `http://localhost:1337`. |
```

(b) In "## Blog CMS (Strapi)", append a paragraph before `## Quality gates`:

```markdown
The portfolio renders the blog at **`/blog`** and **`/blog/<slug>`** and shows
the latest posts in the home page's blog section. All reads happen server-side
through TanStack Start server functions (`apps/portfolio/src/functions/blog.functions.ts`)
using `@ncam/cms`; pages are cached for 60 s (`swr`), so a publish is live within
a minute. With the CMS unreachable the home section shows its placeholders and
`/blog` an empty state.
```

(c) In "### Vercel", find the paragraph that tells you to set the `*_REMOTE_URL` environment variables on the host project and append the sentence: `The host project also needs `STRAPI_URL`and`STRAPI_PUBLIC_URL`(both`https://cms.<domain>`).`

(d) In "### Docker", after the CMS command block's paragraph, add: `The `portfolio`container reads the CMS through`STRAPI_URL=http://strapi:1337` and serves media from `STRAPI_PUBLIC_URL=http://cms.localhost:1337`; start the `cms` profile too (`docker compose --profile cms up`) or the blog renders empty.`

- [ ] **Step 5: Format, gates, commit**

```bash
pnpm prettier --write apps/portfolio/AGENTS.md apps/profile/AGENTS.md AGENTS.md README.md
pnpm format:check && pnpm lint
git add apps/portfolio/AGENTS.md apps/profile/AGENTS.md AGENTS.md README.md
git commit -m "docs(portfolio): document the blog routes, CMS env and props contract"
```

---

### Task 7: Final verification

**Files:** none (report only); delete `apps/strapi/.tmp/seed-smoke-article.cjs` and the smoke logs (gitignored) at the end.

- [ ] **Step 1: Full pipeline**

```bash
pnpm run ci 2>&1 | tail -6
pnpm audit --audit-level high; echo "audit-exit=$?"
```

Expected: all turbo tasks successful; Vitest 10 files / 48 tests; `audit-exit=0`.

- [ ] **Step 2: End-to-end matrix (spec §8)**

Repeat Task 5 Step 4 in full (Strapi + remote + host up; the home page shows the smoke article and the `/blog/hello-blog-smoke` link; CMS down → placeholders, 200) and the blog-page half of Task 3 Step 11 (`/blog` lists the article, `/blog/hello-blog-smoke` is 200 with body + meta, unknown slug 404). Stop every server; confirm `lsof -ti :9000 -i :9006 -i :1337` prints nothing.

- [ ] **Step 3: Repository state and clean-up**

```bash
rm -f apps/strapi/.tmp/seed-smoke-article.cjs apps/strapi/.tmp/phase2-strapi.log apps/portfolio/.output/host-smoke*.log
git status --short
git log --oneline main..HEAD
```

Expected: clean tree; 7 commits (spec + 6 tasks) newest first:

```
docs(portfolio): document the blog routes, CMS env and props contract
feat(portfolio): feed the home blog section from Strapi
feat(profile): let section modules receive props and render real blog posts
feat(portfolio): add the /blog pages backed by Strapi
feat(cms): add the Strapi articles client
feat(cms): add Strapi article types, mapper and query builders
docs(portfolio): add blog frontend design spec
```

- [ ] **Step 4: Report**

Summarise gates, the smoke results, anything skipped, and the owner's remaining checks: publish a real article through `/admin` and confirm it appears on `/`, `/blog` and `/blog/<slug>` within a minute; set `STRAPI_URL`/`STRAPI_PUBLIC_URL` on Vercel; the seeded `hello-blog-smoke` article can be unpublished/deleted in the admin.
