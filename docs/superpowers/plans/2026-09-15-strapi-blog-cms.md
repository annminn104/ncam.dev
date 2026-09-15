# Strapi blog CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/strapi` — a Strapi 5 CMS with a blog content model and a public, read-only REST API — wired into the pnpm/Turbo monorepo, its CI gates, Docker Compose and the nginx gateway.

**Architecture:** The official `create-strapi` TypeScript scaffold becomes the workspace package `@ncam/strapi`. Content types are plain `schema.json` files; a lifecycle hook computes `readingTime` from the Blocks body; a bootstrap function grants the Public role read permissions idempotently on every boot. Production runs from a `pnpm deploy --legacy` output inside its own Docker image next to a Postgres container; local development uses SQLite.

**Tech Stack:** Strapi 5.53.0 (TypeScript, Blocks rich text, users-permissions plugin), Node 22, pnpm 11.13.0, Turborepo 2, Vitest 4, ESLint 10 + Prettier 3, Docker (node:22-slim, postgres:16-alpine, nginx:1.27-alpine).

**Spec:** `docs/superpowers/specs/2026-09-15-strapi-blog-cms-design.md`

## Global Constraints

- Work on branch `feat/strapi-cms` (it already holds the spec commit). One commit per task, Conventional Commits with an app/tool scope, imperative lowercase, no trailing period: `feat(strapi): …`, `build(docker): …`, `docs(strapi): …`. Husky runs lint-staged (eslint --fix + prettier) and commitlint on every commit.
- Package manager: pnpm 11.13.0 only. Node 22 (`.nvmrc`). Never `npm install` / `yarn`.
- Exact versions: every `@strapi/*` package `5.53.0`; `better-sqlite3` `12.8.0`; `pg` `^8.23.0`; React `^18` (Strapi admin peer).
- Package name `@ncam/strapi`, directory `apps/strapi`, port `1337`.
- `apps/strapi/.env` is never committed (template `.gitignore` covers it); only `apps/strapi/.env.example` is tracked.
- `apps/strapi/types/generated/*.d.ts` ARE committed. Regenerate after every schema change: `pnpm --filter @ncam/strapi strapi ts:generate-types`.
- Prettier settings: printWidth 100, singleQuote, trailingComma all, semi. Run `pnpm prettier --write <paths>` on every new/edited file before committing.
- At the end of every task: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm audit --audit-level high` must all exit 0.
- macOS has no `timeout`; the smoke recipe below is the only way this plan starts/stops a server.

### Smoke recipe (used verbatim in several tasks)

```bash
# from the repo root — build, start in the background, probe, stop
pnpm --filter @ncam/strapi build
(cd apps/strapi && NODE_ENV=production pnpm start > .tmp/smoke.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:1337/_health
# … task-specific probes go here …
kill $(lsof -ti :1337)
```

`health=204` means the server is up. `apps/strapi/.tmp/` exists once Strapi has run (SQLite lives there) and is gitignored; create it with `mkdir -p apps/strapi/.tmp` if needed.

### Facts established by a throwaway spike (nothing from it is committed)

- `create-strapi@latest` accepts `--typescript --use-pnpm --skip-cloud --skip-db --no-run --no-git-init --no-example --no-install`.
- The template ships its own `pnpm-workspace.yaml` (`allowBuilds`: `@swc/core`, `better-sqlite3`, `core-js-pure`, `esbuild`, `sharp`). It MUST be deleted from `apps/strapi` (a nested workspace root breaks pnpm) and its allow-list merged into the root file.
- Template `tsconfig.json` already excludes `**/*.test.*`, `.strapi/`, `.tmp/`, `src/admin/`; template `.gitignore` already ignores `.env`, `.tmp`, `.strapi`, `dist`, `build`, `public/uploads/*` and does NOT ignore `types/generated`.
- `config/api.ts` already sets `rest.defaultLimit 25 / maxLimit 100 / withCount true` — no edit needed.
- `strapi build` → `dist/` (compiled `config/`, `src/`) + `dist/build` (admin), ≈10 s. `strapi develop --no-open` is valid.
- `pnpm deploy --prod --legacy` honours `package.json#files`; `tsconfig.json` MUST be listed, otherwise `strapi start` treats the folder as a JavaScript project and ignores `dist/`. Runtime entry: `node node_modules/@strapi/strapi/bin/strapi.js start`.
- Strapi boots fine with `"strapi": { "telemetryDisabled": true }` and no `uuid`/`installId`.
- `pnpm audit --audit-level high` over the Strapi dependency set reports three highs: `vite` 5.4.21 (GHSA-fx2h-pf6j-xcff, only fixed in vite ≥ 6.4.3 which Strapi 5.53 does not use; dev-server-only bug → ignored), `sharp` 0.35.3 → override `0.35.4`, `nodemailer` 9.0.1 → override `9.1.0`. Build and boot verified with both overrides.
- Programmatic check of the lifecycle: 450 + 1 + 3 words → `readingTime` 3; update without `body` keeps 3; update with a 1-word body → 1. Public role grant is idempotent (no log line on second boot).

---

### Task 1: Scaffold `apps/strapi` and wire it into the workspace

**Files:**

- Create (CLI): `apps/strapi/**` — Strapi 5.53.0 TypeScript template
- Delete: `apps/strapi/pnpm-workspace.yaml`, `apps/strapi/README.md`
- Modify: `apps/strapi/package.json` (full replacement)
- Modify: `pnpm-workspace.yaml`, `turbo.json:11`, `eslint.config.mjs:9-25`, `.prettierignore`, `vitest.config.ts`
- Generated: `pnpm-lock.yaml`

**Interfaces:**

- Produces: workspace package `@ncam/strapi` with scripts `dev`, `build`, `start`, `typecheck`, `setup:env` (file lands in Task 2), `strapi`; root Vitest runs `apps/strapi/**/*.test.ts`; root ESLint/Prettier skip Strapi's generated dirs.

- [ ] **Step 1: Confirm branch and clean tree**

Run: `git switch feat/strapi-cms && git status --short`
Expected: switches (or "Already on"), no output from status.

- [ ] **Step 2: Scaffold with the official CLI**

```bash
cd apps && npx -y create-strapi@latest strapi --typescript --use-pnpm --skip-cloud --skip-db --no-run --no-git-init --no-example --no-install && cd ..
ls apps/strapi
```

Expected listing: `config database favicon.png package.json pnpm-workspace.yaml public README.md src tsconfig.json` plus hidden `.env .env.example .gitignore`.

- [ ] **Step 3: Remove files that must not live inside the monorepo**

```bash
rm apps/strapi/pnpm-workspace.yaml apps/strapi/README.md
```

Keep the generated `apps/strapi/.env` (gitignored, has working secrets for local dev; Task 2 replaces the mechanism).

- [ ] **Step 4: Replace `apps/strapi/package.json` with**

```json
{
  "name": "@ncam/strapi",
  "version": "1.0.0",
  "private": true,
  "description": "Strapi 5 headless CMS for the ncam.dev blog: Blocks editor in, public read-only REST API out.",
  "files": ["dist", "public", "database", "favicon.png", "tsconfig.json"],
  "scripts": {
    "dev": "strapi develop --no-open",
    "build": "strapi build",
    "start": "strapi start",
    "typecheck": "tsc --noEmit",
    "setup:env": "node scripts/setup-env.mjs",
    "strapi": "strapi",
    "upgrade": "npx @strapi/upgrade latest",
    "upgrade:dry": "npx @strapi/upgrade latest --dry"
  },
  "dependencies": {
    "@strapi/database": "5.53.0",
    "@strapi/plugin-users-permissions": "5.53.0",
    "@strapi/strapi": "5.53.0",
    "better-sqlite3": "12.8.0",
    "pg": "^8.23.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.30.3",
    "styled-components": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  },
  "engines": {
    "node": ">=20.0.0 <=26.x.x"
  },
  "strapi": {
    "telemetryDisabled": true
  }
}
```

(`@strapi/plugin-cloud` is dropped — self-hosted; `pg` added for Postgres; `files` drives `pnpm deploy` in Task 6.)

- [ ] **Step 5: Root `pnpm-workspace.yaml` — allow native builds, override two advisories, ignore one**

Replace the `allowBuilds` block:

```yaml
allowBuilds:
  '@parcel/watcher': true
  esbuild: true
  # Strapi (apps/strapi): native bindings + postinstall scripts of its dependency tree.
  '@swc/core': true
  better-sqlite3: true
  core-js-pure: true
  sharp: true
```

Append these two lines at the end of the existing `overrides:` map (same indentation as the other entries):

```yaml
'sharp@0.35': '0.35.4' # GHSA-rgj7-g3m4-5g8c (@strapi/upload)
'nodemailer@9': '9.1.0' # GHSA-2x7j-588g-ccc2 (@strapi/provider-email-sendmail)
```

Append at the end of the file:

```yaml
# `pnpm audit --audit-level high` gates CI. Advisories that no override can fix:
# - vite 5.x is what the Strapi 5 admin build uses; GHSA-fx2h-pf6j-xcff (server.fs.deny
#   bypass on Windows) affects the vite DEV server only and is fixed only in vite >= 6.4.3.
#   Production runs `strapi start` (prebuilt admin, no vite process) — not exposed.
auditConfig:
  ignoreGhsas:
    - GHSA-fx2h-pf6j-xcff
```

- [ ] **Step 6: `turbo.json` — cache key for the admin build**

Change line 11 from

```json
      "env": ["*_REMOTE_URL", "*_PORT", "*_BASE", "PORTFOLIO_PORT"]
```

to

```json
      "env": ["*_REMOTE_URL", "*_PORT", "*_BASE", "PORTFOLIO_PORT", "STRAPI_*", "PUBLIC_URL"]
```

- [ ] **Step 7: `eslint.config.mjs` — ignore Strapi's generated dirs**

Inside the first `ignores: [ … ]` array, after the `'apps/*/public/**',` entry add:

```js
      // Strapi (apps/strapi): generated types, admin build context, local SQLite dir.
      'apps/strapi/types/generated/**',
      'apps/strapi/.strapi/**',
      'apps/strapi/.tmp/**',
```

- [ ] **Step 8: `.prettierignore` — same dirs plus uploads**

Append after the `**/*.gen.ts` line:

```
# Strapi (apps/strapi) generated / runtime dirs
apps/strapi/types/generated
apps/strapi/.strapi
apps/strapi/.tmp
apps/strapi/public/uploads
```

- [ ] **Step 9: `vitest.config.ts` — pick up the Strapi unit tests**

Replace the file with:

```ts
import { defineConfig } from 'vitest/config';

// Unit tests for the shared packages and for apps/strapi's pure helpers (reading time,
// permission bootstrap, env template). All are plain Node logic (no DOM). Component/mount
// smoke tests and end-to-end federation checks are best added separately (e.g. Playwright)
// and would use the jsdom environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/strapi/**/*.test.ts'],
    passWithNoTests: false,
    clearMocks: true,
  },
});
```

- [ ] **Step 10: Install and confirm no build script was ignored**

```bash
pnpm install 2>&1 | tee install.log | tail -3
grep -ci "ignored build" install.log; rm install.log
grep -c "sharp@0.35.4\|nodemailer@9.1.0" pnpm-lock.yaml
```

Expected: `Done in …`; the first grep prints `0` (no "Ignored build scripts" warning — every native package is allow-listed); the lockfile grep is ≥ 2 (overrides applied) and `pnpm-lock.yaml` now has an `apps/strapi` importer. (The shell is zsh: do not rely on `PIPESTATUS`.)

- [ ] **Step 11: Format the template to repo style**

```bash
pnpm prettier --write apps/strapi
```

- [ ] **Step 12: Quality gates + build**

```bash
pnpm lint && pnpm format:check && pnpm --filter @ncam/strapi typecheck && pnpm test
pnpm --filter @ncam/strapi build
pnpm audit --audit-level high; echo "audit-exit=$?"
git check-ignore -q apps/strapi/.env && echo "env ignored"
```

Expected: lint/format/typecheck/test exit 0 (the existing 3 package test files pass); build prints `✔ Compiling TS`, `✔ Building build context`, `✔ Building admin panel`; audit prints `1 high (1 ignored)` and `audit-exit=0`; `env ignored`.

Contingency — only if `strapi build` fails with unresolved `@strapi/admin` / `vite` modules (pnpm's strict layout can hide the admin's hoisted deps inside a workspace; the standalone spike did not hit this): add `public-hoist-pattern[]=*strapi*` to the root `.npmrc`, run `pnpm install` again, rebuild, and record the reason in `apps/strapi/AGENTS.md` during Task 7.

- [ ] **Step 13: Commit**

```bash
git add apps/strapi pnpm-workspace.yaml pnpm-lock.yaml turbo.json eslint.config.mjs .prettierignore vitest.config.ts
git status --short   # must NOT list apps/strapi/.env, apps/strapi/dist or apps/strapi/.strapi
git commit -m "feat(strapi): scaffold Strapi 5 CMS app in the workspace"
```

---

### Task 2: Env template, `setup:env` secret generator, `PUBLIC_URL`

**Files:**

- Replace: `apps/strapi/.env.example`
- Create: `apps/strapi/scripts/setup-env.mjs`, `apps/strapi/scripts/setup-env.test.ts`
- Modify: `apps/strapi/config/server.ts`, `apps/strapi/tsconfig.json` (`exclude`)

**Interfaces:**

- Produces: `renderEnv(template: string, secret: () => string): string`, `SECRET_KEYS`, `PASSWORD_KEYS`, `randomSecret()`, `main()` exported from `scripts/setup-env.mjs`; `pnpm --filter @ncam/strapi setup:env` creates `apps/strapi/.env` once.
- Consumed by: Task 6 (compose `env_file`), Task 7 docs.

- [ ] **Step 1: Write the failing test** — `apps/strapi/scripts/setup-env.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { renderEnv } from './setup-env.mjs';

const template = [
  '# Server',
  'HOST=0.0.0.0',
  'PORT=1337',
  'PUBLIC_URL=',
  '',
  'APP_KEYS=',
  'API_TOKEN_SALT=',
  'ADMIN_JWT_SECRET=',
  'TRANSFER_TOKEN_SALT=',
  'JWT_SECRET=',
  'ENCRYPTION_KEY=',
  'DATABASE_CLIENT=sqlite',
  'DATABASE_HOST=',
  'DATABASE_PASSWORD=',
  'POSTGRES_PASSWORD=',
].join('\n');

function counter(): () => string {
  let n = 0;
  return () => `secret${++n}`;
}

function parse(env: string): Record<string, string> {
  const entries = env
    .split('\n')
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const eq = line.indexOf('=');
      return [line.slice(0, eq), line.slice(eq + 1)] as const;
    });
  return Object.fromEntries(entries);
}

const SECRETS = [
  'API_TOKEN_SALT',
  'ADMIN_JWT_SECRET',
  'TRANSFER_TOKEN_SALT',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
];

describe('renderEnv', () => {
  it('fills every empty secret and leaves other lines untouched', () => {
    const out = parse(renderEnv(template, counter()));
    expect(out.HOST).toBe('0.0.0.0');
    expect(out.PORT).toBe('1337');
    expect(out.DATABASE_CLIENT).toBe('sqlite');
    for (const key of SECRETS) expect(out[key]).toMatch(/^secret\d+$/);
    // deliberately environment-specific, must stay empty
    expect(out.PUBLIC_URL).toBe('');
    expect(out.DATABASE_HOST).toBe('');
  });

  it('gives APP_KEYS four distinct comma-separated secrets', () => {
    const keys = parse(renderEnv(template, counter())).APP_KEYS.split(',');
    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(4);
  });

  it('shares one password between DATABASE_PASSWORD and POSTGRES_PASSWORD', () => {
    const out = parse(renderEnv(template, counter()));
    expect(out.DATABASE_PASSWORD).toMatch(/^secret\d+$/);
    expect(out.POSTGRES_PASSWORD).toBe(out.DATABASE_PASSWORD);
  });

  it('keeps comments and blank lines, and is a no-op on an already filled file', () => {
    const once = renderEnv(template, counter());
    expect(once.startsWith('# Server\n')).toBe(true);
    expect(once).toContain('\n\n');
    expect(renderEnv(once, counter())).toBe(once);
  });
});
```

- [ ] **Step 2: Run it — must fail because the module does not exist**

Run: `pnpm vitest run apps/strapi/scripts/setup-env.test.ts`
Expected: FAIL, error mentions `Failed to load url ./setup-env.mjs` (or "Cannot find module").

- [ ] **Step 3: Implement** — `apps/strapi/scripts/setup-env.mjs`

```js
#!/usr/bin/env node
// Creates apps/strapi/.env from .env.example with freshly generated secrets.
// Idempotent: does nothing when .env already exists. Node built-ins only.
//   pnpm --filter @ncam/strapi setup:env
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Each gets its own fresh secret. */
export const SECRET_KEYS = [
  'API_TOKEN_SALT',
  'ADMIN_JWT_SECRET',
  'TRANSFER_TOKEN_SALT',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
];

/** Both get the SAME secret so Strapi and the postgres container agree. */
export const PASSWORD_KEYS = ['DATABASE_PASSWORD', 'POSTGRES_PASSWORD'];

export function randomSecret() {
  return randomBytes(32).toString('base64url');
}

/**
 * Returns `template` with every empty secret line (`KEY=`) filled in.
 * Lines that already have a value, comments and blank lines are returned unchanged.
 * @param {string} template contents of .env.example
 * @param {() => string} secret generator (injectable for tests)
 */
export function renderEnv(template, secret) {
  let password;
  return template
    .split('\n')
    .map((line) => {
      const match = /^([A-Z0-9_]+)=$/.exec(line);
      if (!match) return line;
      const key = match[1];
      if (key === 'APP_KEYS') return `${key}=${[secret(), secret(), secret(), secret()].join(',')}`;
      if (SECRET_KEYS.includes(key)) return `${key}=${secret()}`;
      if (PASSWORD_KEYS.includes(key)) {
        password ??= secret();
        return `${key}=${password}`;
      }
      return line;
    })
    .join('\n');
}

export function main() {
  const appDir = path.resolve(import.meta.dirname, '..');
  const target = path.join(appDir, '.env');
  const shown = path.relative(process.cwd(), target) || '.env';
  if (existsSync(target)) {
    console.log(`${shown} exists, nothing to do`);
    return;
  }
  const template = readFileSync(path.join(appDir, '.env.example'), 'utf8');
  writeFileSync(target, renderEnv(template, randomSecret), { mode: 0o600 });
  console.log(`wrote ${shown} with generated secrets (gitignored — never commit it)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `pnpm vitest run apps/strapi/scripts/setup-env.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Keep `scripts/` out of the Strapi server compilation**

In `apps/strapi/tsconfig.json`, inside `"exclude": [ … ]`, add after the `"src/plugins/**"` entry:

```jsonc
// Node helper scripts (setup:env) are not part of the Strapi server
"scripts/"
```

(Add a trailing comma to the previous entry so the JSONC stays valid.)

- [ ] **Step 6: Replace `apps/strapi/.env.example`**

```
# apps/strapi — Strapi environment. `.env` is gitignored; commit only this example.
# Create your .env with generated secrets:  pnpm --filter @ncam/strapi setup:env
# (it fills every empty KEY= below that is a secret, and leaves the rest alone)

# Server
HOST=0.0.0.0
PORT=1337
# Public origin the CMS is reached at (admin links, media URLs). Empty = derive from
# the incoming request (local dev). Docker/prod: http://cms.localhost:1337, https://cms.<domain>
PUBLIC_URL=

# Secrets (generated by setup:env)
APP_KEYS=
API_TOKEN_SALT=
ADMIN_JWT_SECRET=
TRANSFER_TOKEN_SALT=
JWT_SECRET=
ENCRYPTION_KEY=

# Database: sqlite (local default) or postgres
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
# Postgres — docker-compose overrides DATABASE_CLIENT/HOST/PORT itself
DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=
DATABASE_SSL=false

# Docker only — read by the `strapi-db` postgres container. Must mirror
# DATABASE_NAME / DATABASE_USERNAME / DATABASE_PASSWORD (setup:env writes the same password to both).
POSTGRES_DB=strapi
POSTGRES_USER=strapi
POSTGRES_PASSWORD=
```

- [ ] **Step 7: `apps/strapi/config/server.ts` — honour `PUBLIC_URL`**

Replace the file with:

```ts
import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Public origin behind the nginx gateway / in Docker. An empty PUBLIC_URL in .env becomes
  // undefined so Strapi derives URLs from the incoming request (local dev).
  url: env('PUBLIC_URL') || undefined,
  app: {
    keys: env.array('APP_KEYS')!,
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});

export default config;
```

- [ ] **Step 8: Exercise the real script (replaces the CLI-generated `.env`)**

```bash
rm -f apps/strapi/.env
pnpm --filter @ncam/strapi setup:env
grep -cE '^[A-Z_]+=$' apps/strapi/.env
grep -E '^APP_KEYS=' apps/strapi/.env | tr ',' '\n' | wc -l
diff <(grep -E '^DATABASE_PASSWORD=' apps/strapi/.env | cut -d= -f2) <(grep -E '^POSTGRES_PASSWORD=' apps/strapi/.env | cut -d= -f2) && echo "same password"
pnpm --filter @ncam/strapi setup:env
```

Expected: `wrote .env …`; `2` (only `PUBLIC_URL` and `DATABASE_HOST` stay empty); `4`; `same password`; second run prints `.env exists, nothing to do`.

- [ ] **Step 9: Gates + build + commit**

```bash
pnpm prettier --write apps/strapi/scripts apps/strapi/config/server.ts apps/strapi/tsconfig.json
pnpm lint && pnpm format:check && pnpm --filter @ncam/strapi typecheck && pnpm test && pnpm --filter @ncam/strapi build
git add apps/strapi/.env.example apps/strapi/scripts apps/strapi/config/server.ts apps/strapi/tsconfig.json
git commit -m "feat(strapi): env template, setup:env secrets and PUBLIC_URL"
```

Expected: all exit 0; `pnpm test` now reports the 4 new tests too.

---

### Task 3: Content model — `article`, `tag`, `shared.seo`

**Files:**

- Create: `apps/strapi/src/api/article/content-types/article/schema.json`
- Create: `apps/strapi/src/api/article/controllers/article.ts`, `routes/article.ts`, `services/article.ts`
- Create: `apps/strapi/src/api/tag/content-types/tag/schema.json`
- Create: `apps/strapi/src/api/tag/controllers/tag.ts`, `routes/tag.ts`, `services/tag.ts`
- Create: `apps/strapi/src/components/shared/seo.json`
- Generated + committed: `apps/strapi/types/generated/components.d.ts`, `apps/strapi/types/generated/contentTypes.d.ts`

**Interfaces:**

- Produces: content-type UIDs `api::article.article`, `api::tag.tag`, component `shared.seo`; REST routes `GET/POST /api/articles`, `/api/articles/:documentId`, `/api/tags`, `/api/tags/:documentId` (all still admin-only until Task 5). Article attributes: `title`, `slug`, `excerpt`, `cover`, `body` (blocks), `readingTime` (integer, filled by Task 4), `tags`, `seo`, plus `publishedAt` from draft & publish.

- [ ] **Step 1: Article schema** — `apps/strapi/src/api/article/content-types/article/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article",
    "description": "Blog post"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "title": {
      "type": "string",
      "required": true,
      "maxLength": 120
    },
    "slug": {
      "type": "uid",
      "targetField": "title",
      "required": true
    },
    "excerpt": {
      "type": "text",
      "required": true,
      "maxLength": 300
    },
    "cover": {
      "type": "media",
      "multiple": false,
      "required": false,
      "allowedTypes": ["images"]
    },
    "body": {
      "type": "blocks",
      "required": true
    },
    "readingTime": {
      "type": "integer",
      "min": 1
    },
    "tags": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::tag.tag",
      "inversedBy": "articles"
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

- [ ] **Step 2: Article core files (Strapi factories, no customisation)**

`apps/strapi/src/api/article/controllers/article.ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::article.article');
```

`apps/strapi/src/api/article/routes/article.ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::article.article');
```

`apps/strapi/src/api/article/services/article.ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::article.article');
```

- [ ] **Step 3: Tag schema** — `apps/strapi/src/api/tag/content-types/tag/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "tags",
  "info": {
    "singularName": "tag",
    "pluralName": "tags",
    "displayName": "Tag",
    "description": "Blog post topic"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "slug": {
      "type": "uid",
      "targetField": "name",
      "required": true
    },
    "articles": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::article.article",
      "mappedBy": "tags"
    }
  }
}
```

- [ ] **Step 4: Tag core files**

`apps/strapi/src/api/tag/controllers/tag.ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::tag.tag');
```

`apps/strapi/src/api/tag/routes/tag.ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::tag.tag');
```

`apps/strapi/src/api/tag/services/tag.ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::tag.tag');
```

- [ ] **Step 5: SEO component** — `apps/strapi/src/components/shared/seo.json`

```json
{
  "collectionName": "components_shared_seos",
  "info": {
    "displayName": "SEO",
    "icon": "search",
    "description": "Meta tags for a blog post"
  },
  "options": {},
  "attributes": {
    "metaTitle": {
      "type": "string",
      "maxLength": 60
    },
    "metaDescription": {
      "type": "text",
      "maxLength": 160
    },
    "ogImage": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    }
  }
}
```

- [ ] **Step 6: Generate the TypeScript types (boots Strapi once against SQLite)**

```bash
pnpm prettier --write apps/strapi/src
pnpm --filter @ncam/strapi strapi ts:generate-types
ls apps/strapi/types/generated
grep -c "ApiArticleArticle\|ApiTagTag" apps/strapi/types/generated/contentTypes.d.ts
grep -c "SharedSeo" apps/strapi/types/generated/components.d.ts
```

Expected: `components.d.ts contentTypes.d.ts`; both greps ≥ 1. (`apps/strapi/.tmp/data.db` now exists — gitignored.)

- [ ] **Step 7: Typecheck, build, smoke (routes exist, still forbidden)**

```bash
pnpm --filter @ncam/strapi typecheck
pnpm --filter @ncam/strapi build
(cd apps/strapi && NODE_ENV=production pnpm start > .tmp/smoke.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:1337/_health
curl -s -o /dev/null -w 'articles=%{http_code}\n' http://127.0.0.1:1337/api/articles
curl -s -o /dev/null -w 'tags=%{http_code}\n' http://127.0.0.1:1337/api/tags
curl -s -o /dev/null -w 'unknown=%{http_code}\n' http://127.0.0.1:1337/api/nope
curl -s -o /dev/null -w 'admin=%{http_code}\n' http://127.0.0.1:1337/admin
kill $(lsof -ti :1337)
```

Expected: `health=204`, `articles=403`, `tags=403` (routes registered, Public role has no permission yet), `unknown=404`, `admin=200`.

- [ ] **Step 8: Gates + commit (generated types included)**

```bash
pnpm lint && pnpm format:check && pnpm test
git add apps/strapi/src apps/strapi/types/generated
git commit -m "feat(strapi): add article, tag and shared.seo content types"
```

---

### Task 4: Reading time — pure helper + article lifecycle

**Files:**

- Create: `apps/strapi/src/lib/reading-time.ts`, `apps/strapi/src/lib/reading-time.test.ts`
- Create: `apps/strapi/src/api/article/content-types/article/lifecycles.ts`
- Throwaway (gitignored, deleted in Task 8): `apps/strapi/.tmp/check-lifecycle.cjs`

**Interfaces:**

- Produces: `WORDS_PER_MINUTE = 200`, `countWords(node: unknown): number`, `estimateReadingTime(blocks: unknown): number` (≥ 1). Lifecycle sets `event.params.data.readingTime` whenever `body` is present in the payload (create, update, publish).

- [ ] **Step 1: Write the failing tests** — `apps/strapi/src/lib/reading-time.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { WORDS_PER_MINUTE, countWords, estimateReadingTime } from './reading-time';

const text = (value: string) => ({ type: 'text', text: value });
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });
const words = (count: number) => Array.from({ length: count }, (_, i) => `w${i}`).join(' ');

describe('countWords', () => {
  it('counts words in headings, paragraphs, links, lists and quotes', () => {
    const blocks = [
      { type: 'heading', level: 2, children: [text('Two words')] },
      paragraph(text('one two'), {
        type: 'link',
        url: 'https://ncam.dev',
        children: [text('three')],
      }),
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [text('four five')] }],
      },
      { type: 'quote', children: [text('six')] },
    ];
    expect(countWords(blocks)).toBe(8);
  });

  it('ignores nodes without text leaves (images, empty code blocks)', () => {
    const blocks = [
      { type: 'image', image: { url: '/uploads/a.png', alternativeText: 'not counted words' } },
      { type: 'code', children: [] },
    ];
    expect(countWords(blocks)).toBe(0);
  });

  it('treats any whitespace run as one separator', () => {
    expect(countWords([paragraph(text('  a \n b\t c  '))])).toBe(3);
  });

  it('returns 0 for anything that is not a blocks tree', () => {
    expect(countWords(undefined)).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords('plain string')).toBe(0);
    expect(countWords(42)).toBe(0);
  });
});

describe('estimateReadingTime', () => {
  it('is never below one minute', () => {
    expect(estimateReadingTime(undefined)).toBe(1);
    expect(estimateReadingTime([])).toBe(1);
    expect(estimateReadingTime([paragraph(text('short'))])).toBe(1);
  });

  it('rounds up at the 200 words-per-minute boundary', () => {
    expect(WORDS_PER_MINUTE).toBe(200);
    expect(estimateReadingTime([paragraph(text(words(199)))])).toBe(1);
    expect(estimateReadingTime([paragraph(text(words(200)))])).toBe(1);
    expect(estimateReadingTime([paragraph(text(words(201)))])).toBe(2);
    expect(estimateReadingTime([paragraph(text(words(1000)))])).toBe(5);
  });
});
```

- [ ] **Step 2: Run — must fail (module missing)**

Run: `pnpm vitest run apps/strapi/src/lib/reading-time.test.ts`
Expected: FAIL with `Failed to load url ./reading-time` (or "Cannot find module").

- [ ] **Step 3: Implement** — `apps/strapi/src/lib/reading-time.ts`

```ts
export const WORDS_PER_MINUTE = 200;

/** Counts whitespace-separated words in every `text` leaf of a Strapi Blocks tree. */
export function countWords(node: unknown): number {
  if (Array.isArray(node)) {
    return node.reduce<number>((sum, child) => sum + countWords(child), 0);
  }
  if (node === null || typeof node !== 'object') return 0;

  const record = node as { text?: unknown; children?: unknown };
  let words = 0;
  if (typeof record.text === 'string') {
    words += record.text.split(/\s+/).filter(Boolean).length;
  }
  if (record.children !== undefined) {
    words += countWords(record.children);
  }
  return words;
}

/** Whole minutes at 200 wpm, never less than 1. Accepts any JSON (missing body → 1). */
export function estimateReadingTime(blocks: unknown): number {
  return Math.max(1, Math.ceil(countWords(blocks) / WORDS_PER_MINUTE));
}
```

- [ ] **Step 4: Run — must pass**

Run: `pnpm vitest run apps/strapi/src/lib/reading-time.test.ts`
Expected: `6 passed`.

- [ ] **Step 5: Lifecycle** — `apps/strapi/src/api/article/content-types/article/lifecycles.ts`

```ts
import { estimateReadingTime } from '../../../../lib/reading-time';

interface ArticleEvent {
  params: { data?: { body?: unknown; readingTime?: number } };
}

/** Recompute `readingTime` whenever a payload carries `body` (create, update, publish). */
function applyReadingTime(event: ArticleEvent): void {
  const data = event.params.data;
  if (!data || !('body' in data)) return;
  data.readingTime = estimateReadingTime(data.body);
}

export default {
  beforeCreate: applyReadingTime,
  beforeUpdate: applyReadingTime,
};
```

- [ ] **Step 6: Integration check against the real Document Service**

Create the throwaway file `apps/strapi/.tmp/check-lifecycle.cjs` (the `.tmp` dir is gitignored):

```js
// Throwaway check: boots Strapi without HTTP and drives the Document Service.
//   cd apps/strapi && pnpm build && NODE_ENV=production node .tmp/check-lifecycle.cjs
const assert = require('node:assert/strict');
const { createStrapi } = require('@strapi/strapi');

(async () => {
  const app = await createStrapi({ distDir: './dist' }).load();
  const stamp = Date.now();
  const words = Array.from({ length: 450 }, (_, i) => `word${i}`).join(' ');
  const body = [
    { type: 'heading', level: 2, children: [{ type: 'text', text: 'Intro' }] },
    { type: 'paragraph', children: [{ type: 'text', text: words }] },
    {
      type: 'list',
      format: 'unordered',
      children: [{ type: 'list-item', children: [{ type: 'text', text: 'one two three' }] }],
    },
  ];

  const tag = await app
    .documents('api::tag.tag')
    .create({ data: { name: `Check ${stamp}`, slug: `check-${stamp}` } });
  const created = await app.documents('api::article.article').create({
    data: {
      title: `Check ${stamp}`,
      slug: `check-${stamp}`,
      excerpt: 'Teaser',
      body,
      tags: [tag.documentId],
    },
    status: 'published',
  });
  assert.equal(created.readingTime, 3, 'create: 454 words → 3 min');

  const fetched = await app.documents('api::article.article').findOne({
    documentId: created.documentId,
    status: 'published',
    populate: ['tags'],
  });
  assert.equal(fetched.readingTime, 3, 'published copy carries readingTime');
  assert.deepEqual(
    fetched.tags.map((t) => t.name),
    [`Check ${stamp}`],
    'tags relation populated',
  );

  const teaserOnly = await app
    .documents('api::article.article')
    .update({ documentId: created.documentId, data: { excerpt: 'Changed teaser only' } });
  assert.equal(teaserOnly.readingTime, 3, 'update without body keeps the value');

  const rewritten = await app.documents('api::article.article').update({
    documentId: created.documentId,
    data: { body: [{ type: 'paragraph', children: [{ type: 'text', text: 'short' }] }] },
  });
  assert.equal(rewritten.readingTime, 1, 'update with body recomputes');

  await app.documents('api::article.article').delete({ documentId: created.documentId });
  await app.documents('api::tag.tag').delete({ documentId: tag.documentId });
  console.log('LIFECYCLE CHECK OK');
  await app.destroy();
  process.exit(0);
})().catch((error) => {
  console.error('LIFECYCLE CHECK FAILED', error);
  process.exit(1);
});
```

Run:

```bash
pnpm prettier --write apps/strapi/src
pnpm --filter @ncam/strapi typecheck && pnpm --filter @ncam/strapi build
(cd apps/strapi && NODE_ENV=production node .tmp/check-lifecycle.cjs 2>&1 | grep -E "LIFECYCLE|Assertion")
```

Expected: `LIFECYCLE CHECK OK` and nothing else.

- [ ] **Step 7: Gates + commit**

```bash
pnpm lint && pnpm format:check && pnpm test
git add apps/strapi/src/lib apps/strapi/src/api/article/content-types/article/lifecycles.ts
git commit -m "feat(strapi): compute article reading time on save"
```

---

### Task 5: Public read permissions granted on boot

**Files:**

- Create: `apps/strapi/src/lib/public-permissions.ts`, `apps/strapi/src/lib/public-permissions.test.ts`
- Modify: `apps/strapi/src/index.ts` (full replacement)

**Interfaces:**

- Produces: `PUBLIC_READ_ACTIONS` (readonly tuple of 4 action UIDs) and `ensurePublicReadPermissions(strapi: Core.Strapi): Promise<string[]>` returning the actions it added. `src/index.ts#bootstrap` awaits it.
- Consumes: content types from Task 3 (`api::article.article`, `api::tag.tag`).

- [ ] **Step 1: Write the failing tests** — `apps/strapi/src/lib/public-permissions.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Core } from '@strapi/strapi';
import { PUBLIC_READ_ACTIONS, ensurePublicReadPermissions } from './public-permissions';

interface Fake {
  strapi: Core.Strapi;
  created: Array<{ action: string; role: number }>;
  log: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
}

/** Minimal stand-in for `strapi.db.query()` + `strapi.log`. */
function fakeStrapi(options: { role: { id: number } | null; existing: string[] }): Fake {
  const created: Fake['created'] = [];
  const log = { info: vi.fn(), warn: vi.fn() };
  const strapi = {
    db: {
      query: (uid: string) => ({
        findOne: vi.fn(async () =>
          uid === 'plugin::users-permissions.role' ? options.role : null,
        ),
        findMany: vi.fn(async () => options.existing.map((action) => ({ action }))),
        create: vi.fn(async ({ data }: { data: { action: string; role: number } }) => {
          created.push(data);
          return data;
        }),
      }),
    },
    log,
  };
  return { strapi: strapi as unknown as Core.Strapi, created, log };
}

describe('PUBLIC_READ_ACTIONS', () => {
  it('covers find + findOne for article and tag only', () => {
    expect([...PUBLIC_READ_ACTIONS]).toEqual([
      'api::article.article.find',
      'api::article.article.findOne',
      'api::tag.tag.find',
      'api::tag.tag.findOne',
    ]);
  });
});

describe('ensurePublicReadPermissions', () => {
  it('grants every read action on a fresh database', async () => {
    const { strapi, created, log } = fakeStrapi({ role: { id: 2 }, existing: [] });
    const added = await ensurePublicReadPermissions(strapi);
    expect(added).toEqual([...PUBLIC_READ_ACTIONS]);
    expect(created.map((c) => c.action)).toEqual([...PUBLIC_READ_ACTIONS]);
    expect(created.every((c) => c.role === 2)).toBe(true);
    expect(log.info).toHaveBeenCalledOnce();
  });

  it('adds only the missing actions', async () => {
    const { strapi, created } = fakeStrapi({
      role: { id: 2 },
      existing: ['api::article.article.find', 'api::tag.tag.find', 'api::tag.tag.findOne'],
    });
    expect(await ensurePublicReadPermissions(strapi)).toEqual(['api::article.article.findOne']);
    expect(created).toHaveLength(1);
  });

  it('is a silent no-op when everything is already granted', async () => {
    const { strapi, created, log } = fakeStrapi({
      role: { id: 2 },
      existing: [...PUBLIC_READ_ACTIONS],
    });
    expect(await ensurePublicReadPermissions(strapi)).toEqual([]);
    expect(created).toHaveLength(0);
    expect(log.info).not.toHaveBeenCalled();
  });

  it('warns and grants nothing when the Public role is missing', async () => {
    const { strapi, created, log } = fakeStrapi({ role: null, existing: [] });
    expect(await ensurePublicReadPermissions(strapi)).toEqual([]);
    expect(created).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — must fail (module missing)**

Run: `pnpm vitest run apps/strapi/src/lib/public-permissions.test.ts`
Expected: FAIL with `Failed to load url ./public-permissions`.

- [ ] **Step 3: Implement** — `apps/strapi/src/lib/public-permissions.ts`

```ts
import type { Core } from '@strapi/strapi';

/** Content API actions the anonymous (Public) role must always have. */
export const PUBLIC_READ_ACTIONS = [
  'api::article.article.find',
  'api::article.article.findOne',
  'api::tag.tag.find',
  'api::tag.tag.findOne',
] as const;

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';

/**
 * Grants the Public role every action in PUBLIC_READ_ACTIONS it does not have yet.
 * Never removes or disables anything, so extra grants made in the admin survive.
 * Returns the actions that were added (empty when already up to date).
 */
export async function ensurePublicReadPermissions(strapi: Core.Strapi): Promise<string[]> {
  const publicRole = await strapi.db.query(ROLE_UID).findOne({ where: { type: 'public' } });
  if (!publicRole) {
    strapi.log.warn('[public-permissions] Public role not found, nothing granted');
    return [];
  }

  const existing: Array<{ action: string }> = await strapi.db.query(PERMISSION_UID).findMany({
    where: { role: { id: publicRole.id }, action: { $in: [...PUBLIC_READ_ACTIONS] } },
  });
  const granted = new Set(existing.map((permission) => permission.action));
  const missing = PUBLIC_READ_ACTIONS.filter((action) => !granted.has(action));

  for (const action of missing) {
    await strapi.db.query(PERMISSION_UID).create({ data: { action, role: publicRole.id } });
  }

  if (missing.length > 0) {
    strapi.log.info(`[public-permissions] granted to Public role: ${missing.join(', ')}`);
  }
  return [...missing];
}
```

- [ ] **Step 4: Run — must pass**

Run: `pnpm vitest run apps/strapi/src/lib/public-permissions.test.ts`
Expected: `5 passed`.

- [ ] **Step 5: Wire it into bootstrap** — replace `apps/strapi/src/index.ts` with

```ts
import type { Core } from '@strapi/strapi';
import { ensurePublicReadPermissions } from './lib/public-permissions';

export default {
  register() {},

  /** Runs after every plugin has bootstrapped, on each start (develop, start, Docker). */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensurePublicReadPermissions(strapi);
  },
};
```

- [ ] **Step 6: Smoke — anonymous reads open, writes closed, grant idempotent**

```bash
pnpm prettier --write apps/strapi/src
pnpm --filter @ncam/strapi typecheck && pnpm --filter @ncam/strapi build
(cd apps/strapi && NODE_ENV=production pnpm start > .tmp/smoke.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:1337/_health
curl -s -w ' articles=%{http_code}\n' http://127.0.0.1:1337/api/articles
curl -s -o /dev/null -w 'tags=%{http_code}\n' http://127.0.0.1:1337/api/tags
curl -s -o /dev/null -w 'post=%{http_code}\n' -X POST -H 'content-type: application/json' -d '{"data":{"title":"x"}}' http://127.0.0.1:1337/api/articles
kill $(lsof -ti :1337)
grep -c "granted to Public role" apps/strapi/.tmp/smoke.log
# second boot on the same database → no new grant
(cd apps/strapi && NODE_ENV=production pnpm start > .tmp/smoke2.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:1337/_health
kill $(lsof -ti :1337)
grep -c "granted to Public role" apps/strapi/.tmp/smoke2.log; echo "second-boot-grep-exit=$?"
```

Expected: `health=204`; `{"data":[],"meta":{"pagination":{"page":1,"pageSize":25,"pageCount":0,"total":0}}} articles=200`; `tags=200`; `post=403`; first grep prints `1`; second grep prints `0` with `second-boot-grep-exit=1`.

(If the local database already had the grants from an earlier manual run, the first grep prints `0` — then delete `apps/strapi/.tmp/data.db`, re-run this step from the first `pnpm start`, and both expectations hold.)

- [ ] **Step 7: Gates + commit**

```bash
pnpm lint && pnpm format:check && pnpm test
git add apps/strapi/src/lib/public-permissions.ts apps/strapi/src/lib/public-permissions.test.ts apps/strapi/src/index.ts
git commit -m "feat(strapi): grant public read access on boot"
```

---

### Task 6: Docker image, Compose services, nginx route

**Files:**

- Create: `apps/strapi/Dockerfile`
- Modify: `.dockerignore`, `Dockerfile` (root, build stage lines 42-43), `docker-compose.yml` (before the gateway block + end of file), `nginx/nginx.conf` (new server block before the closing `}` of `http`)

**Interfaces:**

- Produces: image `ncam-strapi:latest` listening on 1337 with `/_health`; compose services `strapi` and `strapi-db`; named volumes `strapi-uploads`, `strapi-db-data`; network alias `cms.localhost`; gateway host `cms.localhost` → Strapi.
- Consumes: `apps/strapi/.env` from Task 2 (`env_file`, optional), `package.json#files` from Task 1.

- [ ] **Step 1: `apps/strapi/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
# Strapi CMS image for apps/strapi. Build from the REPO ROOT (workspace install):
#   docker build -f apps/strapi/Dockerfile -t ncam-strapi .
# Runtime = `pnpm deploy` output: production node_modules + dist/ + public/ only.

ARG NODE_VERSION=22

# ---- base: Node + pnpm (via corepack) -------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---- deps: fill the pnpm store from the lockfile (shared cache id with the root image) --
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

# ---- build: install only @ncam/strapi, compile TS + admin, deploy a prod-only copy ----
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter @ncam/strapi
ENV NODE_ENV=production
RUN pnpm --filter @ncam/strapi build
# --legacy: this workspace does not set inject-workspace-packages and the app has no
# workspace dependencies. Copies package.json#files (dist, public, database, favicon.png,
# tsconfig.json) + production node_modules into /out.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @ncam/strapi deploy --prod --legacy /out

# ---- runner: unprivileged, no pnpm needed -----------------------------------------------
FROM node:${NODE_VERSION}-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out /app
USER node
EXPOSE 1337
# The slim image has no curl/wget; /_health answers 204 when Strapi is ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:1337/_health').then((r) => process.exit(r.status === 204 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "node_modules/@strapi/strapi/bin/strapi.js", "start"]
```

- [ ] **Step 2: `.dockerignore` — keep secrets, SQLite and media out of every build context**

Append at the end of the file:

```
# Strapi (apps/strapi): local secrets, SQLite, admin build context, uploaded media.
# Keep public/uploads/.gitkeep so the image owns the directory the volume mounts on.
**/.env
**/.env.*
**/.tmp
**/.strapi
apps/strapi/public/uploads/*
!apps/strapi/public/uploads/.gitkeep
```

- [ ] **Step 3: Root `Dockerfile` — the monorepo image skips Strapi**

Replace the two `RUN` lines at the end of the `build` stage

```dockerfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline
RUN pnpm build
```

with

```dockerfile
# Strapi (apps/strapi) ships in its own image (apps/strapi/Dockerfile): neither its
# dependencies nor its admin build belong in the monorepo image.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter '!@ncam/strapi'
RUN pnpm exec turbo run build --filter '!@ncam/strapi'
```

- [ ] **Step 4: `docker-compose.yml` — CMS services**

Insert this block directly above the line `  # ── Optional reverse proxy — only runs with \`--profile gateway\` ──────────`:

```yaml
# ── CMS (Strapi): own image + Postgres. Not in the portfolio chain, so the
# frontend stack keeps working without it. Before the first run create the
# secrets file:  pnpm --filter @ncam/strapi setup:env   (apps/strapi/.env)
# Then:          docker compose up --build strapi        → http://localhost:1337/admin
strapi:
  build:
    context: .
    dockerfile: apps/strapi/Dockerfile
    args:
      NODE_VERSION: '22'
  image: ncam-strapi:latest
  env_file:
    - path: apps/strapi/.env # secrets, DB credentials, PUBLIC_URL — never committed
      required: false
  environment: # compose-specific values win over env_file
    NODE_ENV: production
    HOST: 0.0.0.0
    PORT: '1337'
    DATABASE_CLIENT: postgres
    DATABASE_HOST: strapi-db
    DATABASE_PORT: '5432'
  ports:
    - '1337:1337'
  volumes:
    - strapi-uploads:/app/public/uploads
  depends_on:
    strapi-db:
      condition: service_healthy
  networks:
    default:
      aliases:
        - cms.localhost
  restart: unless-stopped

strapi-db:
  image: postgres:16-alpine
  env_file:
    - path: apps/strapi/.env # POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD
      required: false
  volumes:
    - strapi-db-data:/var/lib/postgresql/data
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
    interval: 10s
    timeout: 5s
    retries: 5
  restart: unless-stopped
```

Append at the very end of the file:

```yaml
volumes:
  strapi-uploads:
  strapi-db-data:
```

- [ ] **Step 5: `nginx/nginx.conf` — `cms.localhost` host**

Insert before the final closing `}` of the `http { … }` block (after the last remote `server { … }`):

```nginx
  # ── CMS (Strapi). Resolved at request time (Docker DNS) instead of a static
  # `upstream`, so the gateway still starts when the strapi container is down. ──
  server {
    listen 80;
    server_name cms.localhost;
    client_max_body_size 25m; # media uploads through the admin
    resolver 127.0.0.11 valid=10s ipv6=off;
    set $strapi_upstream http://strapi:1337;
    location / {
      proxy_pass $strapi_upstream;
    }
  }
```

Also extend the usage comment at the top of the file: after the line `#   PROFILE_REMOTE_URL=http://profile.localhost/remoteEntry.js` add

```
# The CMS is proxied on http://cms.localhost (set PUBLIC_URL in apps/strapi/.env to match).
```

- [ ] **Step 6: Static validation (no daemon needed)**

```bash
docker compose config --quiet && echo "compose ok"
docker compose config | grep -A3 "strapi-uploads:/app" | head -4
```

Expected: `compose ok`; the rendered config shows the `strapi` service volume.

- [ ] **Step 7: Build and run (needs the Docker daemon — `docker info` must succeed)**

```bash
docker info > /dev/null 2>&1 && echo "daemon up" || echo "NO DOCKER DAEMON"
```

If `NO DOCKER DAEMON`: stop here, record in the task report that Steps 7–8 were skipped and why, and continue with Step 9. Otherwise:

```bash
ls apps/strapi/.env || pnpm --filter @ncam/strapi setup:env
docker compose up --build -d --wait strapi   # --wait returns once the healthcheck passes (start-period 60s)
docker compose ps strapi
curl -s -o /dev/null -w 'articles=%{http_code}\n' http://localhost:1337/api/articles
curl -s -o /dev/null -w 'admin=%{http_code}\n' http://localhost:1337/admin
docker compose logs strapi | grep -c "granted to Public role"
docker compose restart strapi
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'after-restart=%{http_code}\n' http://localhost:1337/api/articles
docker compose logs strapi | grep -c "granted to Public role"
```

Expected: `up --wait` exits 0 and `ps` shows `healthy`; `articles=200`; `admin=200`; first grep prints `1`; `after-restart=200`; second grep still prints `1` (the Postgres volume kept the grants, so the second boot added nothing). Never use `sleep` to wait — `--wait` and curl's retry do it.

- [ ] **Step 8: Gateway route (daemon)**

```bash
docker compose --profile gateway up --build -d
curl --retry 20 --retry-delay 2 --retry-all-errors -s -o /dev/null -w 'via-gateway=%{http_code}\n' -H 'Host: cms.localhost' http://localhost/api/articles
curl -s -o /dev/null -w 'host-still-ok=%{http_code}\n' http://localhost/
docker compose --profile gateway down
```

This also builds the monorepo image (several minutes on the first run). Expected: `via-gateway=200`, `host-still-ok=200`. `down` stops everything; the named volumes survive (data is still there on the next `up`).

- [ ] **Step 9: Gates + commit**

```bash
pnpm format:check
git add apps/strapi/Dockerfile .dockerignore Dockerfile docker-compose.yml nginx/nginx.conf
git commit -m "build(docker): add Strapi image, postgres service and gateway route"
```

---

### Task 7: Documentation — app AGENTS.md, root AGENTS.md, README

**Files:**

- Create: `apps/strapi/AGENTS.md`
- Modify: `AGENTS.md` (layout tree + tooling bullet), `README.md` (layout table row, new section, Docker paragraph, troubleshooting bullets)

- [ ] **Step 1: `apps/strapi/AGENTS.md`**

````markdown
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
- Unit tests sit next to the code (`*.test.ts`, run by the root Vitest); they
  use a fake `strapi` object, never a database.

## API the frontend relies on

```
GET /api/articles?sort=publishedAt:desc&populate[cover]=true&populate[tags]=true
GET /api/articles?filters[slug][$eq]=<slug>&populate=*
GET /api/tags
```

Drafts are invisible to these calls; only published entries are returned.
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
(postgres:16) with volumes `strapi-uploads` and `strapi-db-data`; the nginx
gateway proxies `cms.localhost`. The monorepo image (`Dockerfile` at the root)
deliberately excludes this app.

## Verification

`pnpm ci` green; `pnpm --filter @ncam/strapi build`; anonymous
`GET /api/articles` → 200, `POST` → 403; boot twice → the
`[public-permissions] granted` log line appears only on the first boot.
````

- [ ] **Step 2: Root `AGENTS.md`**

In the layout tree, after the `toonhub/` lines add:

```
  strapi/    Strapi 5 headless CMS for the blog — a backend service, not a
             federation remote: public read-only REST API on :1337. (has its own AGENTS.md)
```

Change the tooling bullet `- **Vite** builds every app. **Module Federation** via \`@module-federation/vite\`.` to:

```
- **Vite** builds every frontend app; **Module Federation** via `@module-federation/vite`.
  `apps/strapi` is the exception: a Strapi (Node) service with its own build.
```

Change `pnpm dev        # runs every app's dev server (shell :9000, toonhub :9001)` to:

```
pnpm dev        # runs every app's dev server (shell :9000, remotes :9001–:9006, strapi :1337)
```

- [ ] **Step 3: `README.md`**

(a) Layout table — add a row after the `apps/bali` row:

```
| `apps/strapi`          | Strapi 5 headless CMS for the blog — Blocks editor, public read-only REST API. Backend service, not a remote.          | `http://localhost:1337` |
```

(b) New section — insert directly above `## Quality gates`:

````markdown
## Blog CMS (Strapi)

`apps/strapi` is a Strapi 5 headless CMS (TypeScript, Blocks editor). Posts are
written in its admin and served through a **public, read-only REST API**; the
portfolio host will consume it (separate spec). It is a backend service, not a
federated remote — Vercel cannot host it, Docker can (see Deploy → Docker).

```bash
pnpm --filter @ncam/strapi setup:env   # once: apps/strapi/.env with generated secrets (gitignored)
pnpm --filter @ncam/strapi dev         # http://localhost:1337/admin — register the first admin user
```

`pnpm dev` at the root starts it too. Content model: `article` (title, slug,
excerpt, cover, `body` as Blocks, `readingTime` computed on save, tags, seo) and
`tag`. Drafts stay invisible to the API until published.

```bash
curl 'http://localhost:1337/api/articles?sort=publishedAt:desc&populate[cover]=true&populate[tags]=true'
curl 'http://localhost:1337/api/articles?filters[slug][$eq]=my-post&populate=*'
curl 'http://localhost:1337/api/tags'
```

Anonymous read access is granted on every boot (`apps/strapi/src/lib/public-permissions.ts`),
so nothing has to be clicked in Settings → Roles; writes stay admin-only. After
changing a schema run `pnpm --filter @ncam/strapi strapi ts:generate-types` and
commit `apps/strapi/types/generated/`. Details: [`apps/strapi/AGENTS.md`](apps/strapi/AGENTS.md).
````

(c) Deploy → Docker — append after the paragraph ending `because the host bakes them in at build time.`:

````markdown
The CMS has its own image and a Postgres container (SQLite is dev-only):

```bash
pnpm --filter @ncam/strapi setup:env         # secrets + DB password in apps/strapi/.env
docker compose up --build strapi             # http://localhost:1337/admin, API under /api/*
docker compose --profile gateway up --build  # + http://cms.localhost/api/articles
```

Set `PUBLIC_URL` in `apps/strapi/.env` to the origin the CMS is reached at
(`http://cms.localhost:1337` locally, `https://cms.<domain>` in production) so
admin links and media URLs are absolute and correct. Uploads live in the
`strapi-uploads` volume, data in `strapi-db-data`.
````

(d) Troubleshooting — add two bullets at the end of the list:

```markdown
- **Strapi: `Missing app.keys` / `ADMIN_JWT_SECRET` on start** — `apps/strapi/.env`
  is missing. Run `pnpm --filter @ncam/strapi setup:env`.
- **Strapi: `EADDRINUSE :1337`** — another Strapi (or the Docker container) already
  owns 1337. `docker compose stop strapi`, or set `PORT` in `apps/strapi/.env`.
```

- [ ] **Step 4: Format, gates, commit**

```bash
pnpm prettier --write apps/strapi/AGENTS.md AGENTS.md README.md
pnpm format:check && pnpm lint
git add apps/strapi/AGENTS.md AGENTS.md README.md
git commit -m "docs(strapi): document the CMS app, env bootstrap and Docker deploy"
```

---

### Task 8: Final verification and clean-up

**Files:**

- Delete: `apps/strapi/.tmp/check-lifecycle.cjs`, `apps/strapi/.tmp/smoke*.log` (all gitignored)
- No source changes expected; if a gate fails, fix it in a `fix(strapi): …` commit.

- [ ] **Step 1: Full CI pipeline locally**

```bash
rm -f apps/strapi/.tmp/check-lifecycle.cjs apps/strapi/.tmp/smoke*.log
pnpm ci
pnpm audit --audit-level high; echo "audit-exit=$?"
```

Expected: `pnpm ci` (lint → format:check → typecheck → test → build across the workspace) exits 0; test summary includes `reading-time`, `public-permissions`, `setup-env` files (15 Strapi tests) plus the 3 package test files; `audit-exit=0`.

- [ ] **Step 2: Spec §11 end-to-end checklist (API level, automated)**

```bash
pnpm --filter @ncam/strapi build
(cd apps/strapi && NODE_ENV=production pnpm start > .tmp/final.log 2>&1 &)
curl --retry-connrefused --retry 60 --retry-delay 1 --retry-all-errors -s -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:1337/_health
curl -s -o /dev/null -w 'articles=%{http_code}\n' http://127.0.0.1:1337/api/articles
curl -s -o /dev/null -w 'tags=%{http_code}\n' http://127.0.0.1:1337/api/tags
curl -s -o /dev/null -w 'post=%{http_code}\n' -X POST -H 'content-type: application/json' -d '{"data":{"title":"x"}}' http://127.0.0.1:1337/api/articles
curl -s -o /dev/null -w 'admin=%{http_code}\n' http://127.0.0.1:1337/admin
kill $(lsof -ti :1337)
```

Expected: `health=204 articles=200 tags=200 post=403 admin=200`.

- [ ] **Step 3: Human/browser checklist (report as "to be confirmed by the owner" if no browser is available)**

1. `pnpm --filter @ncam/strapi dev`, open `http://localhost:1337/admin`, register the first admin.
2. Content Manager → Tag → create "React" (slug auto-fills) → Save.
3. Content Manager → Article → title, excerpt, upload a cover image, write a few paragraphs in the Blocks editor, pick the tag → Save → **Publish**.
4. `curl 'http://localhost:1337/api/articles?populate=*'` shows the article with `readingTime ≥ 1`, `publishedAt`, `cover.url`, `tags[0].name === "React"`.
5. Unpublish → the same call returns `data: []`.

- [ ] **Step 4: Repository state**

```bash
git status --short          # empty
git log --oneline main..HEAD
```

Expected log (newest first):

```
docs(strapi): document the CMS app, env bootstrap and Docker deploy
build(docker): add Strapi image, postgres service and gateway route
feat(strapi): grant public read access on boot
feat(strapi): compute article reading time on save
feat(strapi): add article, tag and shared.seo content types
feat(strapi): env template, setup:env secrets and PUBLIC_URL
feat(strapi): scaffold Strapi 5 CMS app in the workspace
docs(strapi): add blog CMS design spec
```

- [ ] **Step 5: Report**

Summarise: gates passed (with the exact `pnpm ci` tail), Docker steps run or skipped (and why), the human checklist status, and the follow-up spec (frontend consumption: `STRAPI_URL`, blog section, `/blog` routes) as the next piece of work.
