# Blog frontend (Strapi → portfolio host) — design

Date: 2026-09-15
Status: implemented on feat/blog-frontend (2026-09-15); see docs/superpowers/plans/2026-09-15-blog-frontend.md
Scope: phase 2 of the blog. Phase 1 (`apps/strapi`, the CMS and its public API) is
merged — see `docs/superpowers/specs/2026-09-15-strapi-blog-cms-design.md`.

## 1. Summary

Show real blog posts from the Strapi CMS in the portfolio: a `/blog` index and a
`/blog/$slug` article page rendered by the TanStack Start host, and real cards in
the home page's blog section, which is a federated module of the `profile`
remote. All CMS traffic happens **server-side** through TanStack Start server
functions; the browser never talks to Strapi. A new framework-free package
`@ncam/cms` owns the Strapi client, the response types and the mapping to a
`BlogPost` view-model that the host and the remote share.

### Goals

- `/blog` lists every published article (newest first); `/blog/$slug` renders
  one article's Blocks body with SEO meta and a 404 for unknown slugs.
- The home page's blog section renders the real posts (title, excerpt, date,
  reading time, tags) and links to `/blog/<slug>`; SSR of the section keeps
  working exactly as today.
- A published article appears on the site within 60 s without a redeploy.
- No `STRAPI_*` value is baked into client bundles; the CMS URL is a runtime
  environment variable in every deploy path (Vercel, Docker, local).
- If the CMS is unreachable, the site still renders: placeholders on the home
  section, an empty state on `/blog`.
- `pnpm run ci` stays green; the mapping and query code is unit-tested.

### Non-goals

- Syntax highlighting of code blocks (Blocks renderer's default `<pre><code>`).
- Tag pages, search, pagination UI (the index shows up to 100 posts), RSS,
  dynamic sitemap entries for posts, webhook-driven cache purges, comments.
- Client-side fetching from Strapi or CORS changes.
- Any change to the Strapi app itself.

## 2. Decisions

| Topic           | Decision                                                                                              | Why                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Shared code     | New package `packages/cms` (`@ncam/cms`), framework-free                                              | One `BlogPost` type for host and remote; root Vitest already covers `packages/*`         |
| Fetch location  | `createServerFn` handlers in the host                                                                 | Server-only, runtime env, no CORS, works on Vercel functions and the Nitro Docker server |
| Home section    | Host fetches, passes `{ posts }` into the remote's `ssr/hydrate/mount`                                | Keeps SSR + the six-module pipeline; identical data on server and client (loader data)   |
| Body rendering  | `@strapi/blocks-react-renderer` 1.0.x (React 19 peer ok)                                              | Official, SSR-safe; overrides for `image` and `link` only                                |
| Freshness       | Nitro `routeRules` `swr: 60` on `/`, `/blog`, `/blog/**`; route `staleTime` 60 s                      | New posts within a minute; no webhook plumbing; Vercel preset honours swr as ISR         |
| Env             | `STRAPI_URL` (server API base) + `STRAPI_PUBLIC_URL` (browser media origin, defaults to `STRAPI_URL`) | Docker needs an internal fetch URL and a public asset URL                                |
| Date/label text | Computed in the mapper on the server (`en-US`, UTC → "Sep 15, 2026")                                  | Strings serialize into loader data → no hydration mismatch, no `Intl` on the client      |
| Empty CMS       | Home keeps the existing four "Publishing soon" placeholders                                           | Site never looks broken; the copy already says posts are coming                          |

## 3. `packages/cms` — `@ncam/cms`

Same shape as `@ncam/mf-remote`: `package.json` with `main`/`types`/`exports`
pointing at `./src/index.ts`, `typecheck` script, `tsconfig.json` extending
`@ncam/tsconfig/base.json` with `types: ["node"]`, no build step, no runtime
dependencies. Files:

```
packages/cms/
  AGENTS.md
  package.json            @ncam/cms
  tsconfig.json
  src/
    index.ts              re-exports
    types.ts              Strapi raw response types + BlogPost view-model
    map.ts                mapArticle(), resolveMediaUrl(), labels
    query.ts              buildListQuery(), buildBySlugQuery()
    client.ts             fetchArticles(), fetchArticleBySlug(), CmsError
    map.test.ts  query.test.ts  client.test.ts
```

### Types (`types.ts`)

```ts
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
  body?: BlocksBody | null; // Strapi Blocks JSON (structural node types), only on the detail query
}
export interface StrapiList<T> {
  data: T[];
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } };
}

export interface BlogImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}
export interface BlogPost {
  id: string; // documentId
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string; // ISO
  dateLabel: string; // "Sep 15, 2026"
  readingTime: number; // minutes, ≥ 1
  readingLabel: string; // "9 min"
  tags: string[];
  cover: BlogImage | null;
  body: BlocksBody | null; // Blocks JSON when fetched by slug, else null
  seo: { title: string; description: string; image: BlogImage | null };
}
```

`BlocksBody = BlockNode[]` with structural node interfaces (`TextNode`,
`LinkNode`, `ParagraphNode`, `HeadingNode`, `QuoteNode`, `CodeNode`,
`ListItemNode`, `ListNode`, `ImageNode` with `BlocksImage`) instead of
`unknown`: TanStack Start validates server-function return types for
serializability and rejects `unknown`. `absolutizeBlockImages<T>(blocks: T,
mediaBase): T` keeps its untyped walk behind a generic signature.

### Mapping (`map.ts`)

- `resolveMediaUrl(url, mediaBase)`: absolute URLs pass through; relative
  (`/uploads/…`) are resolved against `mediaBase` with `new URL()`.
- `mapArticle(raw, { mediaBase })`:
  - `dateLabel` via `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })` → "Sep 15, 2026"
  - `readingTime = Math.max(1, raw.readingTime ?? 1)`; `readingLabel` = that number followed by " min" ("9 min")
  - `tags = raw.tags.map((t) => t.name)`
  - `cover` mapped with `alt = alternativeText ?? title`, URL made absolute
  - `seo.title = metaTitle ?? title`, `seo.description = metaDescription ?? excerpt`, `seo.image = ogImage ?? cover`
  - `body = raw.body ? absolutizeBlockImages(raw.body, mediaBase) : null`
- `absolutizeBlockImages(blocks, mediaBase)`: returns a copy of the Blocks tree
  in which every `{ type: 'image', image: { url } }` node has an absolute `url`
  (via `resolveMediaUrl`); every other node is untouched. So the host never
  needs the media base on the client.
- Pure and total: missing relations (`null`/`undefined`) never throw.

### Queries (`query.ts`)

Only parameters Strapi's `strictParams` accepts:

```
buildListQuery():
  sort=publishedAt:desc&pagination[pageSize]=100
  &fields[0]=title&fields[1]=slug&fields[2]=excerpt&fields[3]=readingTime&fields[4]=publishedAt
  &populate[cover][fields][0]=url&populate[cover][fields][1]=alternativeText&populate[cover][fields][2]=width&populate[cover][fields][3]=height
  &populate[tags][fields][0]=name&populate[tags][fields][1]=slug
buildBySlugQuery(slug):
  filters[slug][$eq]=<encoded slug>&populate[cover]=true&populate[tags]=true&populate[seo][populate]=ogImage
```

Built with `URLSearchParams` (brackets encoded — Strapi decodes them).

### Client (`client.ts`)

```ts
export interface CmsOptions { fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number /* default 5000 */ }
export class CmsError extends Error { constructor(public status: number, message: string) }
export async function fetchArticles(baseUrl: string, mediaBase: string, options?: CmsOptions): Promise<BlogPost[]>
export async function fetchArticleBySlug(baseUrl: string, slug: string, mediaBase: string, options?: CmsOptions): Promise<BlogPost | null>
```

- `baseUrl` is the API origin (`http://localhost:1337`); requests go to
  `${baseUrl}/api/articles?${query}` with `Accept: application/json` and
  `AbortSignal.timeout(timeoutMs)` (merged with a caller signal when given).
- Non-2xx → `CmsError(status)`; network/timeout errors propagate as thrown.
- `fetchArticleBySlug` returns `null` when `data` is empty.
- `fetch` is injectable so tests never touch the network.

### Tests

`map.test.ts`: full article → every `BlogPost` field; missing cover/tags/seo/
readingTime; relative vs absolute media URLs; date label is UTC-stable.
`query.test.ts`: the two query strings decode to exactly the parameter sets
above; slug is encoded. `client.test.ts` (fake `fetch`): URL and headers sent,
list mapping, `null` on empty by-slug result, `CmsError` with status on 500,
rejection on abort.

## 4. Environment

| Variable            | Read where                       | Local (root `.env`, committed)   | Docker compose `portfolio.environment` | Vercel (host project env) |
| ------------------- | -------------------------------- | -------------------------------- | -------------------------------------- | ------------------------- |
| `STRAPI_URL`        | server functions (`process.env`) | `http://localhost:1337`          | `http://strapi:1337`                   | `https://cms.<domain>`    |
| `STRAPI_PUBLIC_URL` | server functions (`process.env`) | unset → defaults to `STRAPI_URL` | `http://cms.localhost:1337`            | `https://cms.<domain>`    |

- Read **at request time** in the Nitro server via a tiny `src/server/cms-env.ts`
  helper (`getCmsEnv()` → `{ apiBase, mediaBase }`). When `STRAPI_URL` is unset it
  falls back to `http://localhost:1337` (the Nitro server never loads the root
  `.env`, so this keeps `vite dev`/`preview` zero-config) and warns in production.
  Never through `import.meta.env`/`define`, so nothing is baked and the same image
  runs in every environment.
- `turbo.json` `build.env` already lists `STRAPI_*` (harmless; the build does
  not read it).
- `docker-compose.yml`: add the two variables to the `portfolio` service. The
  CMS lives in the `cms` profile; when it is not running the host degrades
  gracefully (see §7).
- README documents both variables and the Vercel setting.

## 5. Host (`apps/portfolio`)

### Server functions — `src/functions/blog.functions.ts`

```ts
export const getBlogPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BlogPost[]> => {
    const { apiBase, mediaBase } = getCmsEnv();
    return fetchArticles(apiBase, mediaBase);
  },
);
export const getBlogPost = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<BlogPost | null> => {
    const { apiBase, mediaBase } = getCmsEnv();
    return fetchArticleBySlug(apiBase, slug, mediaBase);
  });
```

(`inputValidator` is the method name in the pinned `@tanstack/react-start`
1.168 / `start-client-core` 1.170; older docs call it `validator`.)

### Routes

- `src/routes/blog/index.tsx` — `loader: () => getBlogPosts().catch(() => [])`,
  `staleTime: 60_000`, `head()` with title "Blog — <site>" and description.
  Renders the `.stage` shell (back link to `/`), a heading, and a list of cards
  (`<Link to="/blog/$slug">`): date label, reading label, title, excerpt, tags.
  Empty list → an empty-state paragraph ("Nothing published yet.").
- `src/routes/blog/$slug.tsx` — `loader: async ({ params }) => { const post = await getBlogPost({ data: params.slug }); if (!post) throw notFound(); return post; }`,
  `staleTime: 60_000`, `head({ loaderData })` → `<title>` = `seo.title`,
  `meta description` = `seo.description`, `og:title`, `og:description`,
  `og:type=article`, `og:image` = `seo.image?.url` when present,
  `article:published_time`, canonical `https://ncam.dev/blog/<slug>` (same
  domain constant the project route uses). Renders header (title, date,
  reading time, tags, optional cover `<img>`), then
  `<BlocksRenderer content={post.body} blocks={{ image, link }} />`. The
  `image` override renders `<img src alt width height loading="lazy">` — URLs
  are already absolute because `mapArticle` ran `absolutizeBlockImages` on the
  server. The `link` override compares parsed origins (`isExternal`; relative
  URLs resolve against the site) and renders `<a rel="noopener noreferrer"
target="_blank">` for off-site URLs, a plain `<a>` otherwise. The BlogPosting
  JSON-LD is inlined through `jsonLdScript`, which escapes `<` as `\u003c` so
  CMS-authored text can never close the `<script>`. Overrides are typed as
  `NonNullable<ComponentProps<typeof BlocksRenderer>['blocks']>` (1.0.2 exports
  no `BlocksComponents`).
- Dependencies added to `apps/portfolio/package.json`: `@ncam/cms` (`workspace:*`)
  and `@strapi/blocks-react-renderer` (`^1.0.2`).
- Unknown slug → `notFound()` → the existing `NotFound` component. CMS/network
  error on the detail page → the existing `DefaultCatchBoundary`.
- Styles: new `src/blog.css` imported from `app.css` (after `home.css`): `.blog-index`,
  `.blog-card`, `.article`, `.article__body` typography (headings, lists, quotes,
  code, images) on `@ncam/design-tokens` variables and the `.stage` inset contract.
- `src/routeTree.gen.ts` is regenerated by the build (never hand-edited).

### Caching

`apps/portfolio/vite.config.ts` → `nitro({ routeRules: { '/': { swr: 60 }, '/blog': { swr: 60 }, '/blog/**': { swr: 60 } } })`
(the `nitro()` plugin already exists there; `traceDeps` unchanged). Route-level
`staleTime: 60_000` keeps client-side navigations from refetching within a
minute. Nothing else is cached; server functions are called fresh on client
navigations, which is acceptable.

### Home page (`src/routes/index.tsx`)

- `LoaderData` gains `posts: BlogPost[]`. The loader first does
  `const posts = await withTimeout('getBlogPosts', getBlogPosts(), BLOG_POSTS_TIMEOUT_MS).catch((error) => { log.warn('home.blog-posts-unavailable', …); return []; })`
  — this runs in every mode (dev, CSR navigation, SSR), then the existing
  sequential SSR loop passes `{ posts }` to the blog module only:
  `mod.ssr(section.module === 'blog' ? { posts } : undefined)`.
  `BLOG_POSTS_TIMEOUT_MS = 2_500` keeps the CMS fetch plus the 4 s SSR budget
  well under Vercel's 10 s request cap; `withTimeout` is exported from
  `lib/federation.ts`.
- Client attach: `mod.hydrate(el, props)` / `mod.mount(el, props)` with the
  same `props` (from loader data → identical markup → no hydration mismatch).
- `useProjectLinks` becomes `useInternalLinks`: intercepts clicks on
  `a[href^="/projects/"]` **and** `a[href^="/blog/"]` inside the sections and
  calls `navigate({ href })` (router-level navigation; no full reload). Same
  guard for modifier keys / middle clicks as today.
- `SectionModule` type in `index.tsx` and `src/types/remote/profile.d.ts` updated
  to the props-capable signature (§6).

## 6. Remote (`apps/profile`)

- `src/lib/section-module.tsx`:

```ts
export interface SectionModule<P = undefined> {
  ssr(props?: P): Promise<SectionSSRResult>;
  hydrate(target: HTMLElement, props?: P): () => void;
  mount(target: HTMLElement, props?: P): () => void;
}
export function renderSection<P extends object>(
  renderToString,
  Component: FunctionComponent<P>,
  props?: P,
): SectionSSRResult;
export function createClientModule<P extends object>(
  Component: FunctionComponent<P>,
): Pick<SectionModule<P>, 'hydrate' | 'mount'>;
```

`FunctionComponent<P extends object>` (not `ComponentType<P>`): every section
is a function component, and the union type matched no `createElement`
overload.

`createClientModule` builds `<StrictMode><Component {...(props ?? {})} /></StrictMode>`
per call instead of once at module scope. The five other modules keep calling
these helpers without props (type parameter defaults to `undefined`), so their
behaviour is unchanged. The chunk-cycle rule stays: each module keeps its own
`await import('react-dom/server')`.

- `src/modules/blog.tsx` passes props through:
  `ssr = async (props) => renderSection(renderToString, Blogs, props)`;
  `createClientModule<BlogSectionProps>(Blogs)`.
- `src/components/blogs.tsx`: `Blogs({ posts }: BlogSectionProps)` with
  `BlogSectionProps = { posts?: BlogPost[] }` (`import type { BlogPost } from '@ncam/cms'`
  — type-only, `@ncam/cms` is a `devDependency` of the remote; the remote bundle
  stays self-contained). When `posts` has items: cards show `dateLabel`,
  `readingLabel`, `title`, `excerpt`, `tags`, and link to `/blog/<slug>` with
  "Read the post"; the lead copy drops the "publishing soon" sentence. When
  `posts` is empty or undefined: the existing four `data/profile.ts` placeholders
  render exactly as today. `PostCard` takes a small `CardData` shape both
  sources map to.
- `apps/profile/AGENTS.md`: document the optional props contract and fix the
  existing drift (`renderSection`/`createClientModule`, not `createSectionModule`;
  the host renders sections sequentially, not in parallel).

## 7. Failure behaviour

| Situation                          | Home section                    | `/blog`               | `/blog/$slug`                           |
| ---------------------------------- | ------------------------------- | --------------------- | --------------------------------------- |
| CMS unreachable / 5xx / timeout    | placeholders (warn logged)      | empty state, HTTP 200 | error boundary (`DefaultCatchBoundary`) |
| `STRAPI_URL` unset                 | same as above (error is caught) | same                  | same                                    |
| No published posts                 | placeholders                    | empty state           | 404                                     |
| Unknown slug                       | —                               | —                     | `notFound()` → 404 page                 |
| Strapi returns relative media URLs | n/a (cards have no images)      | n/a                   | absolute via `STRAPI_PUBLIC_URL`        |

## 8. Testing and verification

Unit (Vitest, `pnpm test`): `packages/cms` — mapper, queries, client (fake
fetch), `absolutizeBlockImages`. The host and remote have no unit tests (no
DOM environment); they are covered by typecheck, build and the smoke below.

Smoke (recorded in the plan as steps with expected output):

1. `pnpm --filter @ncam/strapi dev` running; create + publish one article with a
   cover and a tag (throwaway Document Service script, as in phase 1).
2. `pnpm --filter @ncam/profile build`, `pnpm --filter @ncam/portfolio build`,
   start the built host with `STRAPI_URL=http://localhost:1337` and the profile
   remote preview.
3. `curl /blog` contains the article title; `curl /blog/<slug>` contains the
   body text, `<title>`, `og:image` absolute URL; `curl /blog/nope` → 404;
   `curl /` contains the article title inside the blog section and a
   `/blog/<slug>` link.
4. Stop Strapi → `curl /` still 200 with "Publishing soon", `/blog` 200 with the
   empty state.
5. `pnpm run ci` green.

## 9. Documentation

- `packages/cms/AGENTS.md` (purpose, API, "server-only in practice", tests).
- `apps/portfolio/AGENTS.md`: server functions, env variables, routes, caching,
  link interception, the props contract.
- `apps/profile/AGENTS.md`: props contract + drift fixes.
- README: env table (`STRAPI_URL`, `STRAPI_PUBLIC_URL`), `/blog` routes, Docker
  and Vercel notes.

## 10. Risks

| Risk                                                                 | Mitigation                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Hydration mismatch between SSR'd remote markup and client hydrate    | Same `posts` object flows from loader data to both; all labels precomputed on the server  |
| `@strapi/blocks-react-renderer` pulling a second React into the host | It is a plain dependency of the host (React 19 peer); host React stays the MF singleton   |
| Nitro `swr` behaviour differs per preset (Vercel vs node-server)     | Both support `swr`; verify headers in the smoke; fall back to route `headers()` if needed |
| Server function RPC path cached by `routeRules`                      | Rules only match `/`, `/blog`, `/blog/**`; RPC endpoints live elsewhere                   |
| `strictParams` rejects a populate/fields combination                 | Query strings are asserted in unit tests and exercised in the smoke against real Strapi   |

## 11. Follow-ups (not in this spec)

Code highlighting (shiki) via a `code` block override; dynamic sitemap with
posts; RSS; webhook-based cache purge; tag pages; syncing the remote's card
design with cover images.
