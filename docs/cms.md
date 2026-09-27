# Blog CMS (Strapi)

`apps/strapi` is a Strapi 5 headless CMS (TypeScript, Blocks editor) for the
blog. Posts are written in its admin panel and served through a **public,
read-only REST API**, which the portfolio host reads on the server. It is a
backend service, not a federated remote: Vercel cannot host it, so it runs on
Render in production and in Docker locally (see [deployment](deployment.md)).
The rules for working on it are in
[`apps/strapi/AGENTS.md`](../apps/strapi/AGENTS.md).

## Run it locally

```bash
pnpm --filter @ncam/strapi setup:env   # once: apps/strapi/.env with generated secrets (gitignored)
pnpm --filter @ncam/strapi dev         # http://localhost:1337/admin; register the first admin user
```

`pnpm dev` at the root starts it too, and its first run creates
`apps/strapi/.env` when the file is missing. Development uses SQLite; Docker
and Render use Postgres.

## Content model

- `article`: title, slug, excerpt, cover, `body` (Blocks), `readingTime`
  (computed on save), tags and seo.
- `tag`.

Drafts stay invisible to the API until they are published; the public routes
ignore `?status=draft`.

## Public API

```bash
curl 'http://localhost:1337/api/articles?sort=publishedAt:desc&populate[cover]=true&populate[tags]=true'
curl 'http://localhost:1337/api/articles?filters[slug][$eq]=my-post&populate=*'
curl 'http://localhost:1337/api/tags'
```

Anonymous read access is granted on every boot
(`apps/strapi/src/lib/public-permissions.ts`), so nothing needs clicking in
Settings → Roles, and writes stay admin-only. After changing a schema, run
`pnpm --filter @ncam/strapi strapi ts:generate-types` and commit
`apps/strapi/types/generated/`.

## Health check

```bash
curl -i 'http://localhost:1337/api/health'   # 200 {"status":"ok","database":"ok","uptime":…}
```

`GET /api/health` (HEAD works too) is public and uncached. It answers 200 when
the database answers a `select 1`, and 503 with `"database":"unreachable"` when
it does not, without saying why. Strapi's built-in `/_health` (204) only proves
the process is up; Render's deploy health check uses that one. The uptime
monitor that keeps the CMS awake, and the keep-awake workflow behind it, use
`/api/health` (see [deployment](deployment.md#keeping-the-free-service-awake)).

## How the portfolio reads it

The host renders the blog at `/blog` and `/blog/<slug>` and shows the latest
posts in the home page's blog section. All reads happen on the server, through
TanStack Start server functions (`apps/portfolio/src/functions/blog.functions.ts`)
that call `@ncam/cms` with `STRAPI_URL`; browsers only load media, from
`STRAPI_PUBLIC_URL`. Pages are cached for 60 s (`swr`), so a publish goes live
within a minute.

The CMS gets 2.5 s on the home page and 5 s per `@ncam/cms` request. When it is
unreachable or slow, the home page's blog section shows placeholders and
`/blog` an empty state, rather than the page failing.
