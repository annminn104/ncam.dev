# Strapi blog CMS (`apps/strapi`) — design

Date: 2026-09-15
Status: approved design, awaiting implementation plan
Scope: sub-project 1 of 2 (the CMS itself). Frontend consumption is a separate spec.

## 1. Summary

Add a Strapi 5 headless CMS to the monorepo as `apps/strapi` (package
`@ncam/strapi`). It stores blog posts written in Strapi's Blocks editor and
serves them through a **public, read-only REST API** that the portfolio host
will consume later. The app runs locally on SQLite with one command, and in
production as its own Docker image next to a Postgres container, wired into the
existing `docker-compose.yml` and nginx gateway.

### Goals

- Author blog posts in the Strapi admin (`/admin`) with draft & publish.
- Anonymous `GET /api/articles` and `GET /api/articles?filters[slug][$eq]=…`
  work out of the box — no manual permission clicking after a fresh database.
- Fields cover what the existing home-page blog card already renders
  (`title`, `excerpt`, `date`, `readingTime`, `tags`, link target).
- `pnpm install && pnpm ci` stays green (lint, format, typecheck, test, build).
- Deployable with `docker compose up strapi`.

### Non-goals (this sub-project)

- No frontend changes: `apps/profile` keeps its static placeholder posts.
- No categories, authors, comments, i18n, search, or newsletter.
- No Strapi Cloud, Vercel or PaaS-specific config (Vercel cannot host Strapi).
- No custom admin UI, custom controllers, or GraphQL.

## 2. Decisions

| Topic       | Decision                                                   | Why                                                                                               |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Scaffold    | `create-strapi-app@latest` CLI, then adapt (approach A)    | Official 5.53 template; avoids drift in tsconfigs, admin stub, `.gitignore`, generated types      |
| Version     | Strapi `5.53.x`, TypeScript, Node 22                       | Latest stable; engines `>=20 <=26`; repo pins Node 22                                             |
| Post body   | `blocks` rich text (JSON)                                  | Owner's choice: better writing UX in admin. Frontend renders with `@strapi/blocks-react-renderer` |
| Database    | SQLite for local dev; Postgres 16 in Docker                | Zero-setup dev; durable, backup-friendly prod. Switch is `DATABASE_CLIENT` only                   |
| Hosting     | Own server via existing compose + nginx gateway            | Consistent with the rest of the stack; portfolio on Vercel reads the public CMS URL               |
| Port        | `1337`                                                     | Strapi convention. `9000–9006` stay reserved for the federation host and remotes                  |
| Permissions | Enabled programmatically in `bootstrap`                    | Reproducible on any fresh DB; no admin clicking                                                   |
| Env file    | `apps/strapi/.env` (gitignored) + committed `.env.example` | Strapi reads its own cwd `.env`; secrets never go in the committed root `.env`                    |
| Generated   | Commit `types/generated/*.d.ts`                            | CI `typecheck` must work without running Strapi                                                   |

## 3. Placement and tooling

```
apps/strapi/
  AGENTS.md
  .env.example
  .gitignore                 (from template: .env .tmp dist build .strapi public/uploads/*)
  Dockerfile
  package.json               (@ncam/strapi)
  tsconfig.json              (extends @strapi/typescript-utils/tsconfigs/server — NOT @ncam/tsconfig)
  favicon.png
  config/                    admin.ts api.ts database.ts middlewares.ts plugins.ts server.ts
  database/migrations/       (empty, template)
  public/uploads/.gitkeep
  scripts/setup-env.mjs
  src/
    index.ts                 register() / bootstrap()
    admin/                   (template stubs + tsconfig)
    api/article/content-types/article/{schema.json,lifecycles.ts}
    api/article/{controllers,routes,services}/article.ts   (core factories, unchanged)
    api/tag/content-types/tag/schema.json
    api/tag/{controllers,routes,services}/tag.ts
    components/shared/seo.json
    lib/reading-time.ts      estimateReadingTime(blocks)
    lib/reading-time.test.ts
    lib/public-permissions.ts PUBLIC_READ_ACTIONS + ensurePublicReadPermissions(strapi)
  types/generated/           components.d.ts contentTypes.d.ts (committed)
```

- `package.json` scripts: `dev` → `strapi develop --no-open`, `build` → `strapi build`,
  `start` → `strapi start`, `typecheck` → `tsc --noEmit`, `setup:env` →
  `node scripts/setup-env.mjs`, `strapi` → `strapi` (CLI passthrough, e.g.
  `pnpm --filter @ncam/strapi strapi ts:generate-types`).
- Dependencies: `@strapi/strapi`, `@strapi/plugin-users-permissions`,
  `better-sqlite3`, `pg`, `react`, `react-dom`, `react-router-dom`,
  `styled-components` (admin peer deps from the template). Remove
  `@strapi/plugin-cloud` (self-hosted). Dev: `typescript`, `@types/node`.
- Strapi's `tsconfig.json` cannot extend `@ncam/tsconfig/base.json` (Strapi
  needs `module: commonjs`-compatible emit into `dist/`; the base config is
  `noEmit` + bundler resolution). This exception is documented in
  `apps/strapi/AGENTS.md`.
- No `vercel.json`: the app is never deployed to Vercel.

## 4. Content model

All schemas are plain `schema.json` files (Content-Type Builder output), so
they are reviewable and reproducible.

### `api::article.article` — collection type, `draftAndPublish: true`

| Attribute     | Type                                        | Rules                                                               |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `title`       | `string`                                    | required, `maxLength: 120`                                          |
| `slug`        | `uid` (`targetField: title`)                | required, unique (uid implies unique)                               |
| `excerpt`     | `text`                                      | required, `maxLength: 300` — the card teaser                        |
| `cover`       | `media`, single, `allowedTypes: ["images"]` | optional                                                            |
| `body`        | `blocks`                                    | required                                                            |
| `readingTime` | `integer`                                   | `min: 1`; recomputed by the lifecycle (§7) whenever `body` is saved |
| `tags`        | `relation` manyToMany → `api::tag.tag`      | `inversedBy: articles`                                              |
| `seo`         | `component` `shared.seo`, non-repeatable    | optional                                                            |

`publishedAt` (from draft & publish) is the post date shown as `date`.
Ordering for the frontend is `sort=publishedAt:desc`.

### `api::tag.tag` — collection type, `draftAndPublish: false`

| Attribute  | Type                                           | Rules            |
| ---------- | ---------------------------------------------- | ---------------- |
| `name`     | `string`                                       | required, unique |
| `slug`     | `uid` (`targetField: name`)                    | required         |
| `articles` | `relation` manyToMany → `api::article.article` | `mappedBy: tags` |

### Component `shared.seo`

| Attribute         | Type                                        |
| ----------------- | ------------------------------------------- |
| `metaTitle`       | `string`, `maxLength: 60`                   |
| `metaDescription` | `text`, `maxLength: 160`                    |
| `ogImage`         | `media`, single, `allowedTypes: ["images"]` |

## 5. Public API

- Roles: only the built-in **Public** role is used. On every boot,
  `ensurePublicReadPermissions(strapi)` looks up the Public role
  (`plugin::users-permissions.role`, `type: 'public'`) and creates any missing
  `plugin::users-permissions.permission` rows for
  `PUBLIC_READ_ACTIONS = ['api::article.article.find', 'api::article.article.findOne', 'api::tag.tag.find', 'api::tag.tag.findOne']`.
  It never deletes or disables permissions, so admins can grant more in the UI
  without fighting the bootstrap.
- `config/api.ts`: `rest.defaultLimit = 25`, `rest.maxLimit = 100`,
  `withCount = true`.
- CORS: Strapi default (`strapi::cors`, all origins). The API is read-only for
  anonymous callers, and both public assets and the admin remain behind the
  default security middleware.
- Uploads: default local provider → `public/uploads` (Docker volume in prod).
  Media URLs are absolute when `PUBLIC_URL` is set (§6).
- No API tokens are created; write access is admin-only through `/admin`.
- `find`/`findOne` on `article` run the `api::article.force-published` route
  middleware, which forces `status=published`: Strapi otherwise accepts
  `?status=draft` from anonymous callers and would leak drafts.

Example calls the frontend will use later:

```
GET /api/articles?sort=publishedAt:desc&populate[cover]=true&populate[tags]=true&fields[0]=title&fields[1]=slug&fields[2]=excerpt&fields[3]=readingTime&fields[4]=publishedAt
GET /api/articles?filters[slug][$eq]=federating-react-19&populate=*
GET /api/tags
```

## 6. Configuration and environment

`apps/strapi/.env.example` (committed) documents every variable; `.env` is
gitignored by the template's `apps/strapi/.gitignore`.

```
HOST=0.0.0.0
PORT=1337
# Public origin Strapi is reached at (admin URLs, media URLs). Empty = derive from request.
PUBLIC_URL=
# Secrets — run `pnpm --filter @ncam/strapi setup:env` to generate
APP_KEYS=
API_TOKEN_SALT=
ADMIN_JWT_SECRET=
TRANSFER_TOKEN_SALT=
JWT_SECRET=
ENCRYPTION_KEY=
# Database — sqlite (default) or postgres
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
# Postgres (used by docker-compose; DATABASE_HOST/PORT are set by compose)
DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=
DATABASE_SSL=false
# Docker only — consumed by the `strapi-db` postgres container. Must mirror the
# three DATABASE_* values above (setup:env keeps the passwords identical).
POSTGRES_DB=strapi
POSTGRES_USER=strapi
POSTGRES_PASSWORD=
```

- `scripts/setup-env.mjs`: if `.env` exists, print "exists, nothing to do" and
  exit 0. Otherwise copy `.env.example` to `.env` and fill each empty secret
  with `crypto.randomBytes(32).toString('base64url')` (`APP_KEYS` gets four
  comma-separated values; `DATABASE_PASSWORD` and `POSTGRES_PASSWORD` get the
  same value). The pure `renderEnv(template, secret)` is unit-tested with an
  injected generator. No dependencies, Node built-ins only.
- `config/server.ts`: `host`, `port`, `url: env('PUBLIC_URL') || undefined`
  (an empty value in `.env` must not become `url: ''`), `app.keys: env.array('APP_KEYS')`.
- `config/database.ts`: template code — `DATABASE_CLIENT` picks `sqlite`
  (filename resolved relative to the app root) or `postgres`
  (`DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD/SSL`).
- `config/admin.ts`, `config/middlewares.ts`, `config/plugins.ts`: template
  defaults, `plugin-cloud` entry removed.
- Root `.env` is **not** changed in this sub-project. The consumer variable
  (`STRAPI_URL`) is introduced by the frontend spec.

## 7. Reading time (lifecycle)

`src/lib/reading-time.ts`:

```ts
export const WORDS_PER_MINUTE = 200;
/** Walks Strapi Blocks JSON, counts words in every `text` leaf, returns whole minutes (min 1). */
export function estimateReadingTime(blocks: unknown): number;
```

- Input is treated as unknown: arrays are walked, objects contribute their
  `text` string (if any) and recurse into `children`. Anything else counts as
  zero words. Result: `Math.max(1, Math.ceil(words / 200))`.
- `src/api/article/content-types/article/lifecycles.ts`: `beforeCreate` and
  `beforeUpdate` set `event.params.data.readingTime = estimateReadingTime(body)`
  **only when `body` is present in `data`** (partial updates and publish
  actions without a body change leave the stored value alone).
- Unit tests (`reading-time.test.ts`): empty/undefined → 1; 199 words → 1;
  201 words → 2; nested list/quote/link children counted; non-text nodes
  (image, code without text) ignored.

## 8. Docker, compose, nginx

### `apps/strapi/Dockerfile` (build context = repo root)

1. `base`: `node:22-slim`, `corepack enable`, `PNPM_HOME` — same as the root
   Dockerfile.
2. `deps`: copy `package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc`;
   `pnpm fetch` (store cache mount) — identical to the root image, so the two
   builds share the pnpm store cache.
3. `build`: `COPY . .` (trimmed by `.dockerignore`);
   `pnpm install --frozen-lockfile --offline --filter @ncam/strapi`;
   `NODE_ENV=production pnpm --filter @ncam/strapi build`; then
   `pnpm --filter @ncam/strapi deploy --prod --legacy /out` — a self-contained
   copy of the app with production `node_modules` only. `--legacy` is required
   because the workspace does not set `inject-workspace-packages`; the app has
   no workspace dependencies, so the legacy implementation is exactly right.
   `apps/strapi/package.json` gets
   `"files": ["dist", "public", "database", "favicon.png", "tsconfig.json"]` so the
   gitignored `dist/` is still copied by `deploy`. `tsconfig.json` is required at
   runtime: without it `strapi start` treats the folder as a JavaScript project and
   ignores `dist/` (verified in the spike).
4. `runner`: `NODE_ENV=production`; `COPY --from=build --chown=node:node /out /app`;
   `USER node`; `WORKDIR /app`; `EXPOSE 1337`;
   `HEALTHCHECK` with `node -e "fetch('http://127.0.0.1:1337/_health').then(r => process.exit(r.status === 204 ? 0 : 1)).catch(() => process.exit(1))"`
   (the slim image has no `curl`/`wget`);
   `CMD ["node", "node_modules/@strapi/strapi/bin/strapi.js", "start"]` (PID 1 is
   node, so SIGTERM reaches Strapi directly; no pnpm in the runtime image).

`sharp` and `better-sqlite3` ship prebuilt binaries for linux-x64 glibc, so no
`apt-get` toolchain is expected; if the build proves otherwise, the `build`
stage adds `python3 make g++` and the note lands in `AGENTS.md`.

### `docker-compose.yml` additions

```yaml
strapi:
  build: { context: ., dockerfile: apps/strapi/Dockerfile }
  image: ncam-strapi:latest
  env_file:
    - path: apps/strapi/.env # secrets + DB credentials + PUBLIC_URL; never committed
      required: false # absent file → `docker compose up portfolio` still works
  environment: # compose-specific overrides win over env_file
    NODE_ENV: production
    HOST: 0.0.0.0
    PORT: '1337'
    DATABASE_CLIENT: postgres
    DATABASE_HOST: strapi-db
    DATABASE_PORT: '5432'
  ports: ['1337:1337']
  volumes: ['strapi-uploads:/app/public/uploads']
  depends_on: { strapi-db: { condition: service_healthy } }
  networks: { default: { aliases: [cms.localhost] } }
  restart: unless-stopped

strapi-db:
  image: postgres:16-alpine
  env_file:
    - path: apps/strapi/.env # POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD
      required: false
  volumes: ['strapi-db-data:/var/lib/postgresql/data']
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
    interval: 10s
    timeout: 5s
    retries: 5
  restart: unless-stopped

volumes:
  strapi-uploads:
  strapi-db-data:
```

Both services carry `profiles: ['cms']`, so the default `docker compose up`
(frontend stack) never touches them; naming `strapi` on the command line or
passing `--profile cms` activates them. No compose variable interpolation is
used, so plain `docker compose up --build strapi` works after
`pnpm --filter @ncam/strapi setup:env` (Compose only auto-loads the
root `.env`, never `.env.local`). Both containers read `apps/strapi/.env`: Strapi
takes the secrets, `DATABASE_*` and `PUBLIC_URL` (set it to the public CMS origin,
e.g. `http://cms.localhost:1337` or `https://cms.ncam.dev`); Postgres takes
`POSTGRES_*` and ignores the rest. The two services are not part of the `portfolio`
dependency chain, so `docker compose up portfolio` keeps working without a database.

### nginx gateway

Add a server block for `cms.localhost` with `client_max_body_size 25m;` (media
uploads) that proxies `/` to `http://strapi:1337` through a variable plus
`resolver 127.0.0.11` (Docker's embedded DNS) instead of a static `upstream`,
so the gateway still starts when the optional strapi container is down.
Comment: in production swap `cms.localhost` for the real CMS sub-domain and set
`PUBLIC_URL` in `apps/strapi/.env` to match.

### Root Dockerfile and `.dockerignore`

- Root `Dockerfile` build stage: `pnpm install … --filter '!@ncam/strapi'` and
  `pnpm exec turbo run build --filter '!@ncam/strapi'` so the monorepo image
  neither installs nor builds Strapi (it has its own image). `turbo` is invoked
  directly because `pnpm build --filter …` would be consumed by pnpm's own
  `--filter` option.
- `.dockerignore`: add `**/.env`, `**/.env.*`, `**/.tmp`, `**/.strapi`,
  `apps/strapi/public/uploads/*` (keeping `.gitkeep`, so the image owns the
  directory the uploads volume mounts on) so local secrets, the SQLite file and
  uploaded media never enter any build context.

## 9. Monorepo integration

| File                        | Change                                                                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml`       | `allowBuilds`: add `@swc/core`, `better-sqlite3`, `core-js-pure`, `sharp` (the template's own allow-list); `overrides`: `sharp@0.35 → 0.35.4`, `nodemailer@9 → 9.1.0` (high advisories); `auditConfig.ignoreGhsas`: `GHSA-fx2h-pf6j-xcff` (vite 5 dev-server-only issue, unfixable within Strapi 5) |
| `turbo.json`                | `build.env`: add `"STRAPI_*"`, `"PUBLIC_URL"` (admin build reads `STRAPI_ADMIN_*`). `build.outputs` already covers `dist/**`                                                                                                                                                                        |
| `vitest.config.ts`          | `include`: add `apps/strapi/**/*.test.ts` (covers `src/lib/*.test.ts` and `scripts/*.test.ts`)                                                                                                                                                                                                      |
| `eslint.config.mjs`         | `ignores`: add `apps/strapi/types/generated/**`, `apps/strapi/.strapi/**`, `apps/strapi/.tmp/**`                                                                                                                                                                                                    |
| `.prettierignore`           | add `apps/strapi/types/generated`, `apps/strapi/.strapi`, `apps/strapi/.tmp`, `apps/strapi/public/uploads`                                                                                                                                                                                          |
| `.gitignore`                | root: no change. Template `apps/strapi/.gitignore` must cover `.env`, `.tmp`, `.strapi`, `dist`, `build`, `public/uploads/*` (add any missing line) and must **not** ignore `types/generated` (delete that line if the template has it)                                                             |
| `apps/strapi/tsconfig.json` | template + `"exclude"` keeps `**/*.test.ts`, `src/admin/` and `scripts/` out of `dist`                                                                                                                                                                                                              |

`pnpm dev` (turbo) will also start `strapi develop` on `:1337` alongside the
federation apps; `pnpm --filter @ncam/strapi dev` runs it alone.

## 10. Documentation

- `apps/strapi/AGENTS.md`: what the app is, commands, env bootstrap, content
  model summary, the permissions bootstrap rule ("never remove, only add"),
  the tsconfig exception, generated types policy, Docker notes, and the
  contract with the future frontend (field names, sort, populate).
- Root `AGENTS.md`: add `strapi/` to the layout tree with a one-line
  description and a pointer to its AGENTS.md; note that it is a backend
  service, not a federation remote.
- `README.md`: a "CMS (Strapi)" section — local run, first admin user, API
  URL, Docker/compose usage, secrets handling.

## 11. Testing and verification

Unit (vitest, in `pnpm ci`):

- `estimateReadingTime` cases from §7.

Manual / integration (recorded in the implementation plan as checkboxes):

1. `pnpm install` → no "ignored build scripts" warning; `pnpm ci` green.
2. `pnpm --filter @ncam/strapi setup:env && pnpm --filter @ncam/strapi dev` →
   `http://localhost:1337/admin` opens; create the first admin user.
3. `curl -i http://localhost:1337/api/articles` → `200` with `data: []`
   (anonymous, thanks to the bootstrap). `curl -i .../api/tags` → `200`.
4. In admin: create tag "React", article with cover + body + tag, **publish**.
   `curl ".../api/articles?populate=*"` returns it with `readingTime >= 1`,
   `publishedAt`, `cover.url`, `tags[0].name`.
5. `POST /api/articles` anonymous → `403` (write stays closed).
6. Restart `strapi develop`: no duplicate permission rows (idempotent).
7. `docker compose up --build strapi` → container healthy; `/_health` → `204`;
   `/admin` reachable on `http://localhost:1337`; data survives
   `docker compose restart strapi` (Postgres + uploads volumes).
8. `docker compose --profile gateway up` → `http://cms.localhost/api/articles`
   proxied.

## 12. Risks and mitigations

| Risk                                                                   | Mitigation                                                                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm workspace hoisting breaks Strapi plugin/admin resolution          | Strapi 5 supports pnpm officially; if `strapi build` fails to resolve admin deps, add `public-hoist-pattern[]=*strapi*` to `.npmrc` (documented in AGENTS.md) |
| pnpm 11 blocks native build scripts (`better-sqlite3`, `@swc/core`, …) | `allowBuilds` entries; verify with `pnpm install` output                                                                                                      |
| New transitive advisories fail CI `pnpm audit --audit-level high`      | Scoped `overrides` in `pnpm-workspace.yaml`, same pattern as existing entries                                                                                 |
| Generated types drift from schemas                                     | `strapi develop` regenerates them; plan includes a "regenerate + commit" step and AGENTS.md rule                                                              |
| Root `pnpm build` slows down (admin build ~1–2 min)                    | Turbo caches `dist/**`; the root Docker image skips Strapi via `--filter`                                                                                     |
| `.env` accidentally committed                                          | Template `.gitignore` + `.dockerignore` `**/.env`; only `.env.example` is tracked                                                                             |

## 13. Follow-ups (next spec)

- `STRAPI_URL` in root `.env`, turbo `build.env`, Dockerfile args, Vercel env.
- Replace static `posts` in `apps/profile` with data fetched server-side by the
  portfolio host (SSR) from `GET /api/articles`, keeping the existing card shape.
- `/blog` and `/blog/$slug` routes in `apps/portfolio`, rendering `body` with
  `@strapi/blocks-react-renderer`; SEO `<head>` from the `seo` component.
- Optional: webhook from Strapi publish → Vercel deploy hook / cache revalidation.
