# ncam.dev (Turborepo + Module Federation)

A Turborepo monorepo. A **TanStack Start (SSR)** host renders project mini-apps as
micro-frontends at runtime via Module Federation.

- `apps/portfolio` — TanStack Start (SSR) host / gallery (dev: http://localhost:9000)
- `apps/toonhub` — TOONHUB hero, a federated remote (dev: http://localhost:9001)
- `packages/*` — shared registry + TS config

## Prerequisites

- **Node.js ≥ 18**
- **pnpm** — this repo requires pnpm (it uses `workspace:*` and a pnpm lockfile).
  `npm` / `yarn` will not work.

Enable pnpm (recommended, uses the version pinned in `package.json`):

```bash
corepack enable
```

Or install it globally:

```bash
npm install -g pnpm
```

Verify: `pnpm -v` should print a version.

## Run

```bash
pnpm install      # install all workspaces
pnpm dev          # start shell (:9000) + toonhub (:9001) via Turbo
```

Open http://localhost:9000, then click **TOONHUB** — the shell loads the remote
at runtime. Both servers must be running (that's what `pnpm dev` does).

### Run one app without Turbo (fallback)

Two terminals:

```bash
pnpm --filter @ncam/toonhub dev   # http://localhost:9001 (standalone)
pnpm --filter @ncam/portfolio dev         # http://localhost:9000
```

## Build

```bash
pnpm build        # builds every app (shell + toonhub emit dist/, incl. remoteEntry.js)
pnpm typecheck
```

## Common issue: `cannot find binary path` when running dev

That error is Turbo not finding the **pnpm** binary. Install pnpm (see
Prerequisites) and run `pnpm dev` — do not use `npm run dev`.

## Deploy to Vercel (Turborepo monorepo)

Each app deploys as its **own Vercel project** (micro-frontends deploy
independently). Vercel has first-class Turborepo + Vite support; the `vercel.json`
in each app pins the framework/build/output, and the toonhub remote adds the CORS
header the shell needs to load it cross-origin.

1. **toonhub remote** — new Vercel project, Root Directory `apps/toonhub`.
   - `apps/toonhub/vercel.json` sets `framework: vite`, build `pnpm build`
     (runs the asset download), output `dist`, and
     `Access-Control-Allow-Origin: *` so the shell can fetch `remoteEntry.js`
     from another origin. Note its deployed URL, e.g. `https://toonhub.vercel.app`.
2. **shell host** — new Vercel project, Root Directory `apps/portfolio`.
   - Set env var `TOONHUB_REMOTE_URL=https://<toonhub-domain>/remoteEntry.js`.
   - Update `SITE.url` in `apps/portfolio/src/gallery.ts` to the shell's domain
     (canonical/OG/sitemap/robots derive from it).

Vercel auto-installs from the workspace root (pnpm) and, because `turbo.json`
is present, uses Turborepo-aware builds. Optionally skip unaffected builds with
an Ignored Build Step of `npx turbo-ignore`.

### Turborepo Remote Caching (optional)

Speed up CI/local builds by sharing the cache via Vercel Remote Cache:

```bash
npx turbo login
npx turbo link
```

Any static host works too — build with `pnpm build` and serve each app's
`dist/`, keeping the toonhub remote's CORS + the shell's `TOONHUB_REMOTE_URL`.

See `AGENTS.md` (root and per-app) for architecture and contribution rules.
