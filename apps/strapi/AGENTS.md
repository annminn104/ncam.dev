# AGENTS.md — apps/strapi

The ncam.dev **blog CMS**: Strapi 5 (TypeScript), package `@ncam/strapi`, port
**1337**. A backend service — NOT a federation remote (no Vite, no
`defineRemote`, no `remoteEntry.js`). Posts are written in the Strapi admin
(Blocks editor) and served through a **public, read-only REST API** that the
portfolio host consumes (frontend wiring is a separate spec).

Design spec: `docs/superpowers/specs/2026-09-15-strapi-blog-cms-design.md`.

## Commands

```bash
pnpm --filter @ncam/strapi setup:env   # once per clone: writes .env with generated secrets
pnpm --filter @ncam/strapi dev         # setup:env (idempotent) + strapi develop
pnpm --filter @ncam/strapi build       # dist/ (server) + dist/build (admin)
pnpm --filter @ncam/strapi start       # production server from dist/
pnpm --filter @ncam/strapi typecheck   # tsc --noEmit
pnpm --filter @ncam/strapi strapi ts:generate-types   # after ANY schema change (see below)
```

`pnpm dev` at the root starts it alongside the frontend apps. First run: open
`/admin`, register the first admin user (local SQLite, `.tmp/data.db`).

`strapi develop` runs plain, without `--no-open`: Strapi 5.53's CLI only
registers `--open` (no `--no-open` negation), so passing it is a hard CLI
error. The first-boot browser auto-launch is disabled the supported way
instead, via `autoOpen: false` in `config/admin.ts`.

## Environment

- `.env` is gitignored and created by `setup:env` from `.env.example` (every
  empty secret `KEY=` gets a fresh `base64url` value; `DATABASE_PASSWORD` and
  `POSTGRES_PASSWORD` get the same one). Never commit `.env`; edit
  `.env.example` when adding a variable and keep `scripts/setup-env.mjs` +
  its test in sync if the new variable is a secret.
- `DATABASE_CLIENT=sqlite` locally; docker-compose forces `postgres` and points
  `DATABASE_HOST` at the `strapi-db` container. `PUBLIC_URL` must be the origin
  the CMS is reached at whenever it sits behind a proxy (`config/server.ts`
  turns an empty value into `undefined` = derive from request).

## Content model (`src/api/*/content-types/*/schema.json`, `src/components/`)

- `article` (draft & publish): `title`, `slug` (uid ← title), `excerpt` (≤ 300),
  `cover` (image), `body` (**blocks**), `readingTime` (int, auto), `tags`
  (many-to-many → `tag`), `seo` (component `shared.seo`: `metaTitle`,
  `metaDescription`, `ogImage`). `publishedAt` is the post date.
- `tag`: `name` (unique), `slug` (uid ← name), `articles` (inverse).
- Schemas are the source of truth. After editing one (or using the admin's
  Content-Type Builder in dev, which rewrites these files), run
  `strapi ts:generate-types` and **commit `types/generated/`** — CI typechecks
  without booting Strapi.

## Behaviour that lives in code

- `src/lib/reading-time.ts` — `estimateReadingTime(blocks)`: words in every
  `text` leaf / 200 wpm, rounded up, min 1. Applied by
  `src/api/article/content-types/article/lifecycles.ts` on `beforeCreate` /
  `beforeUpdate` whenever the payload contains `body`.
- `src/lib/public-permissions.ts` — `ensurePublicReadPermissions(strapi)` runs
  from `src/index.ts#bootstrap` on every boot and grants the Public role
  `find`/`findOne` on `article` and `tag`. **It only ever adds** — grants made
  in Settings → Roles stay. Writes remain admin-only; no API tokens exist.
- `src/api/article/middlewares/force-published.ts` — route middleware on the
  public `find`/`findOne` article routes that forces `status=published`;
  Strapi would otherwise honour `?status=draft` from anonymous callers.
- Unit tests sit next to the code (`*.test.ts`, run by the root Vitest); they
  use a fake `strapi` object, never a database.

## API the frontend relies on

```
GET /api/articles?sort=publishedAt:desc&populate[cover]=true&populate[tags]=true
GET /api/articles?filters[slug][$eq]=<slug>&populate=*
GET /api/tags
```

Drafts are invisible to these calls (the routes force `status=published`, so
`?status=draft` is ignored); only published entries are returned.
Pagination defaults: 25 per page, max 100 (`config/api.ts`).

## Repo conventions that differ here

- `tsconfig.json` extends nothing from `@ncam/tsconfig`: Strapi needs
  CommonJS emit into `dist/` (`@strapi/typescript-utils` defaults). Tests
  (`**/*.test.*`), `src/admin/` and `scripts/` are excluded from that build.
- React is **18** (Strapi admin peer), unlike the React 19 frontend apps.
- `package.json#files` (`dist public database favicon.png tsconfig.json`) is
  what `pnpm deploy --legacy` copies into the Docker runtime — `tsconfig.json`
  must stay listed or `strapi start` ignores `dist/`.
- Root ESLint/Prettier ignore `types/generated`, `.strapi`, `.tmp`; root
  `pnpm-workspace.yaml` carries the native `allowBuilds` (`better-sqlite3`,
  `sharp`, `@swc/core`, `core-js-pure`) and the audit ignore for Strapi's
  vite 5 dev-server advisory.

## Docker

`apps/strapi/Dockerfile` (context = repo root) builds a prod-only runtime from
`pnpm deploy`; `docker-compose.yml` runs it as `strapi` next to `strapi-db`
(postgres:16-alpine) with volumes `strapi-uploads` and `strapi-db-data`; the nginx
gateway proxies `cms.localhost`. Both services carry `profiles: ['cms']`, so
they sit out of the default `docker compose up`; naming the service —
`docker compose up strapi` — activates the profile implicitly (`strapi-db`
comes along as its dependency), or pass `--profile cms` explicitly. The
monorepo image (`Dockerfile` at the root) deliberately excludes this app.

The image's `HEALTHCHECK` probes `$PORT`, not a literal 1337, because hosts that
assign the port themselves (Railway, Fly) rarely pick 1337 and a hardcoded probe
reports a healthy container as failing. `config/server.ts` already binds `$PORT`.

## Railway

`railway.json` is the service's config-as-code: Dockerfile builder,
`dockerfilePath: apps/strapi/Dockerfile`, healthcheck on `/_health`. Point the
Railway service's **Config File Path** at `apps/strapi/railway.json` and leave
its Root Directory at the repo root — the Dockerfile copies `pnpm-workspace.yaml`
and `pnpm-lock.yaml` from there, so a narrower context cannot install.

- **Postgres.** Add Railway's Postgres and set `DATABASE_CLIENT=postgres`; the
  plugin's `DATABASE_URL` is enough. `config/database.ts` passes it as
  `connectionString` alongside the discrete `DATABASE_*` defaults, and `pg`
  resolves the connection string over them (verified against pg 8.23), so the
  `localhost` defaults never win. Prefer the private URL; the public one needs
  `DATABASE_SSL=true` as well.
- **Uploads.** The local upload provider writes to `public/uploads`, and a
  container filesystem does not survive a redeploy. Mount a Railway Volume at
  `/app/public/uploads` or every image uploaded in the admin disappears on the
  next deploy. `.dockerignore` keeps `public/uploads/.gitkeep` precisely so the
  image owns that directory for the volume to mount over.
- **Secrets.** `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`,
  `TRANSFER_TOKEN_SALT`, `JWT_SECRET` and `ENCRYPTION_KEY` are set in Railway,
  not generated per deploy — regenerating them invalidates every admin session
  and every API token.
- **`PUBLIC_URL`** must be the service's public domain, or admin links and media
  URLs come out relative to whatever host the request arrived on.
- The host side then points `STRAPI_URL` and `STRAPI_PUBLIC_URL` at that domain.
  Both are runtime env on the portfolio deployment, so changing them needs no
  rebuild.

## Verification

`pnpm run ci` green; `pnpm --filter @ncam/strapi build`; anonymous
`GET /api/articles` → 200, `POST` → 403; boot twice → the
`[public-permissions] granted` log line appears only on the first boot.
