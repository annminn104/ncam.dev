# AGENTS.md — @ncam/cms

Typed client for the blog CMS (`apps/strapi`, Strapi 5). Framework-free, **no
runtime dependencies**, ships raw TypeScript (`src/index.ts`) like the other
packages. Used by the portfolio host **inside server functions**; the `profile`
remote imports only the `BlogPost` type.

## API

```ts
import { fetchArticles, fetchArticleBySlug, fetchArticleIndex, CmsError } from '@ncam/cms';

const posts = await fetchArticles(apiBase, mediaBase); // BlogPost[] — cards, newest first, ≤ 100
const post = await fetchArticleBySlug(apiBase, 'my-slug', mediaBase); // BlogPost | null (body included)
const index = await fetchArticleIndex(apiBase); // BlogPostSummary[] — every post, newest first
```

- `fetchArticleIndex` is for the host's sitemap, RSS feed and llms.txt: no
  media, so no `mediaBase`, and it walks every page (100 posts each, at most
  10 pages) instead of stopping at the first 100. `BlogPostSummary` is a
  `Pick` of `BlogPost`, so helpers that take a summary accept a full post too.
- `publishedAt` is the post date, `updatedAt` the last change to the published
  entry (the sitemap's `lastmod`, JSON-LD's `dateModified`).
- `seo.canonicalUrl` and `seo.robots` carry the SEO component's
  `canonicalURL` / `metaRobots` trimmed, or null when blank. The canonical is
  passed on as entered: only the host knows its origin, so it resolves a
  relative one. Both are in the by-slug post and in the index, not in the cards.

- `apiBase` = the Strapi origin the caller can reach (`STRAPI_URL`);
  `mediaBase` = the origin browsers can reach for `/uploads/…`
  (`STRAPI_PUBLIC_URL`). Strapi returns relative media URLs; the mapper makes
  them absolute (cover, seo image and every image block in `body`).
- `BlogPost` is plain JSON (no `Date`): labels (`dateLabel` "Sep 15, 2026" in
  UTC, `readingLabel` "9 min") are computed here so SSR and hydration agree.
- `body` is typed as `BlocksBody` (structural Blocks node types) so TanStack Start can
  serialize a `BlogPost` from a server function.
- Options: `{ fetch, signal, timeoutMs = 5000 }` — `fetch` is injectable for
  tests. Non-2xx → `CmsError(status)`; network/timeout errors propagate.
- `trimTrailingSlashes(url)` is exported and used by the host's `cms-env.ts` so
  the base URLs are normalised the same way everywhere; it is a linear scan on
  purpose (CodeQL flags `/\/+$/` as a polynomial regex on library input).
- Query strings (`query.ts`) use only parameters Strapi's `rest.strictParams`
  accepts; change them together with the Strapi schema.

## Rules

- Keep it dependency-free and browser-safe (`fetch`, `URL`, `AbortSignal`,
  `Intl` only). No `process.env` here — callers pass URLs in.
- Pure mapping/query code is unit-tested (`*.test.ts`, root Vitest); tests never
  hit the network (fake `fetch`).
