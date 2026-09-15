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
