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
pnpm --filter @ncam/strapi dev         # strapi develop --no-open → http://localhost:1337/admin
pnpm --filter @ncam/strapi build       # dist/ (server) + dist/build (admin)
pnpm --filter @ncam/strapi start       # production server from dist/
pnpm --filter @ncam/strapi typecheck   # tsc --noEmit
pnpm --filter @ncam/strapi strapi ts:generate-types   # after ANY schema change (see below)
```

`pnpm dev` at the root starts it alongside the frontend apps. First run: open
`/admin`, register the first admin user (local SQLite, `.tmp/data.db`).

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

## Verification

`pnpm ci` green; `pnpm --filter @ncam/strapi build`; anonymous
`GET /api/articles` → 200, `POST` → 403; boot twice → the
`[public-permissions] granted` log line appears only on the first boot.
