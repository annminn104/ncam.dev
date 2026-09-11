# ncam.dev

[![CI](https://github.com/annminn104/ncam.dev/actions/workflows/ci.yml/badge.svg)](https://github.com/annminn104/ncam.dev/actions/workflows/ci.yml)
[![CodeQL](https://github.com/annminn104/ncam.dev/actions/workflows/codeql.yml/badge.svg)](https://github.com/annminn104/ncam.dev/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Personal portfolio built as a **micro-frontend showcase**. A server-rendered
**TanStack Start** host renders a gallery of projects and mounts each one at
runtime through **Module Federation**. Every project is its own Vite app: built,
tested and deployable on its own, yet rendered inside the host at
`https://ncam.dev/projects/<id>`.

Turborepo + pnpm workspaces, TypeScript everywhere.

## Layout

| Path                   | What it is                                                                                                                     | Dev URL                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `apps/portfolio`       | **Host.** TanStack Start (SSR, Nitro) + TanStack Router, React 19. Home shell + `/projects/$projectId` stage.                  | `http://localhost:9000` |
| `apps/profile`         | The home page's six sections (hero, stacks, experience, projects, blog, contact), one federated module each.                   | `http://localhost:9006` |
| `apps/toonhub`         | TOONHUB — collectible-figurine carousel hero. Framework-free TypeScript remote.                                                | `http://localhost:9001` |
| `apps/mindloop`        | Mindloop — dark newsletter landing page. React 19, Tailwind v4, framer-motion, hls.js.                                         | `http://localhost:9002` |
| `apps/immersive-ocean` | Immersive Ocean — creative-studio hero with looping video background. React 19, Tailwind v4.                                   | `http://localhost:9003` |
| `apps/viktor`          | Viktor. — portfolio hero with crossfade video switcher. React 19, Tailwind v4.                                                 | `http://localhost:9004` |
| `apps/bali`            | Bali Adventure — cinematic luxury-travel landing page. React 19, Tailwind v4, GSAP ScrollTrigger, framer-motion.               | `http://localhost:9005` |
| `packages/*`           | `project-registry` (typed project list), `mf-remote` (`defineRemote()` + `.env` reader), `design-tokens`, `logger`, `tsconfig` | —                       |

Each app and package carries its own `AGENTS.md` with the rules for that unit;
the root [`AGENTS.md`](AGENTS.md) covers cross-cutting concerns.

## How a project renders

1. `@ncam/project-registry` is the single source of truth: id, copy, accent,
   thumbnail, remote name. The host's gallery is server-rendered from it.
2. Opening `/projects/<id>` runs the route loader on the server, which imports
   the remote's **`./ssr`** module and inlines the returned `{ html, css }`.
3. In the browser the host imports **`./hydrate`** to attach interactivity
   (falls back to **`./mount`** for pure client rendering).
4. Remotes are **self-contained**: each bundles its own runtime (including React
   where used) and exposes `mount` / `ssr` / `hydrate`. Nothing is shared across
   the host↔remote boundary, so a remote behaves identically standalone and
   mounted. `packages/mf-remote` encapsulates that Vite config.
5. The home page eats its own dog food: its six sections are modules of the
   `profile` remote (`profile/hero` … `profile/contact`, each `{ ssr, hydrate,
mount }`). The host server-renders them in parallel, hydrates each into a
   slot, and the manifest rail shows every module's real lifecycle.

## Prerequisites

- **Node 22** (see `.nvmrc`; `pnpm thumbnails` needs ≥ 22.18).
- **pnpm** — required (`workspace:*` protocol + pnpm lockfile). Easiest:

  ```bash
  corepack enable
  ```

  This picks up the version pinned in `package.json` (`packageManager`).

## Quick start

```bash
pnpm install
pnpm dev          # host :9000 + every remote :9001–:9006 via Turbo
```

Open http://localhost:9000 and click a project — the host loads that remote at
runtime, so the remote's dev server must be up (that is what `pnpm dev` does).

Run a single workspace when iterating on one app:

```bash
pnpm --filter @ncam/viktor dev        # remote alone, standalone dev page on :9004
pnpm --filter @ncam/portfolio dev     # host alone (projects fail to load until their remote runs)
```

## Scripts (repo root)

| Command                   | Does                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`                | All dev servers (Turbo, persistent).                                               |
| `pnpm build`              | Build every workspace. Host → `.output/` (Nitro server), remotes → `dist/`.        |
| `pnpm preview`            | Serve the production builds locally.                                               |
| `pnpm typecheck`          | `tsc --noEmit` everywhere.                                                         |
| `pnpm lint` / `lint:fix`  | ESLint (flat config).                                                              |
| `pnpm format` / `:check`  | Prettier.                                                                          |
| `pnpm test` / `:watch`    | Vitest (shared packages).                                                          |
| `pnpm ci`                 | lint + format check + typecheck + test + build — same as GitHub Actions.           |
| `pnpm assets`             | Download self-hosted assets where an app defines it (currently toonhub figurines). |
| `pnpm thumbnails [id...]` | Regenerate gallery thumbnails (see below).                                         |
| `pnpm skills:add`         | Install the agent skills listed in `scripts/add-agent-skills.sh`.                  |

## Configuration

Non-secret defaults live in the committed **`.env`**; machine-specific overrides
go in **`.env.local`** (gitignored). Precedence, highest first: the real
environment, then `.env.local`, then `.env`. Never put secrets in `.env`.

| Variable                                                                                                                                | Purpose                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `PORTFOLIO_PORT`, `TOONHUB_PORT`, `MINDLOOP_PORT`, `IMMERSIVE_OCEAN_PORT`, `VIKTOR_PORT`, `BALI_PORT`, `PROFILE_PORT`                   | Dev / preview ports.                                                     |
| `TOONHUB_REMOTE_URL`, `MINDLOOP_REMOTE_URL`, `IMMERSIVE_OCEAN_REMOTE_URL`, `VIKTOR_REMOTE_URL`, `BALI_REMOTE_URL`, `PROFILE_REMOTE_URL` | `remoteEntry.js` URL the host loads for each remote. **Baked at build.** |
| `TOONHUB_BASE`, `MINDLOOP_BASE`, `IMMERSIVE_OCEAN_BASE`, `VIKTOR_BASE`, `BALI_BASE`, `PROFILE_BASE`                                     | Public base path per remote (default `/`).                               |

## Thumbnails

Gallery cards and each project's `og:image` are **generated**, not designed:
1200×630 Playwright captures of `/projects/<id>` on the running host with the
host's back button hidden (`apps/portfolio/scripts/capture-thumbnails.mjs`).

```bash
pnpm --filter @ncam/portfolio exec playwright install chromium   # once
pnpm dev                                                         # host + remotes up
pnpm thumbnails                                                  # or: pnpm thumbnails viktor
```

Output: `apps/portfolio/public/thumbnails/<id>.jpg`, paths declared in the
registry. Re-run whenever a remote's hero changes.

## Adding a project

1. `apps/<project>/` — a Vite app exposing `./mount`, `./ssr`, `./hydrate`
   through `defineRemote()` from `@ncam/mf-remote` (copy `apps/viktor`).
2. Give it an `AGENTS.md`, a `vercel.json` (see any remote) and add its
   `<NAME>_PORT` / `<NAME>_REMOTE_URL` / `<NAME>_BASE` to `.env`.
3. Host: add the remote in `apps/portfolio/vite.config.ts` and one static
   `import('<remote>/ssr' | '/hydrate' | '/mount')` per loader map in
   `apps/portfolio/src/routes/projects/$projectId.tsx`, plus a `.d.ts` in
   `src/types/remote/`.
4. Register it in `packages/project-registry` (the tests there enforce the shape).
5. `pnpm thumbnails <id>` with `pnpm dev` running.

Details and rules: root `AGENTS.md` → "Adding a new project".

## Quality gates

- **Husky**: `pre-commit` runs lint-staged (ESLint `--fix` + Prettier),
  `commit-msg` runs commitlint (**Conventional Commits**, e.g.
  `feat(portfolio): …`), `pre-push` runs `turbo run typecheck build`.
  Bypass in a pinch with `git push --no-verify`.
- **CI** (`.github/workflows/ci.yml`): lint, format check, typecheck, test and
  build on every push to `main` and every PR, with the Turbo cache persisted
  between runs; PR commit messages are validated with commitlint.
- **CodeQL** weekly + on push/PR; **Dependabot** opens grouped update PRs.
- Vulnerability reports: see [`SECURITY.md`](SECURITY.md).

## Deploy

### Vercel (one project per app)

Remotes are static Vite builds; the host is a Nitro server. Each app has its
own `vercel.json`, so create one Vercel project per app with the matching
**Root Directory**:

1. **Remotes** (`apps/toonhub`, `apps/mindloop`, `apps/immersive-ocean`,
   `apps/viktor`, `apps/bali`, `apps/profile`): `framework: vite`, `pnpm build`,
   output `dist`, and an `Access-Control-Allow-Origin: *` header so the host can
   fetch `remoteEntry.js` cross-origin. Note each deployed URL.
2. **Host** (`apps/portfolio`): set `TOONHUB_REMOTE_URL`, `MINDLOOP_REMOTE_URL`,
   `IMMERSIVE_OCEAN_REMOTE_URL`, `VIKTOR_REMOTE_URL`, `BALI_REMOTE_URL`,
   `PROFILE_REMOTE_URL` to
   `https://<remote-domain>/remoteEntry.js`. Nitro detects Vercel and emits the
   Build Output; `vercel.json` just runs `pnpm build`.
3. Own domain? Update the `SITE_URL` constants in
   `apps/portfolio/src/routes/index.tsx` and `routes/projects/$projectId.tsx`
   (canonical / OG / JSON-LD) plus `public/robots.txt` and `public/sitemap.xml`.

Optional: skip unaffected builds with an Ignored Build Step of
`npx turbo-ignore`, and share the Turbo cache with `npx turbo login && npx turbo link`.

### Docker

One multi-stage image builds the whole monorepo; `docker-compose.yml` runs the
SSR host and each remote (static preview) from that same image:

```bash
docker compose up --build            # host http://localhost:9000, remotes :9001–:9005
docker compose --profile gateway up --build   # + nginx on :80 → http://ncam.localhost
```

Remote entry URLs use `*.localhost` hostnames so the **same URL** resolves in
the browser (loopback) and inside the host container (compose network aliases)
— that is what lets the host resolve remotes server-side. They are build args,
not runtime env, because the host bakes them in at build time.

## Troubleshooting

- **`cannot find binary path`** on `pnpm dev` — Turbo can't find pnpm. Install
  pnpm (see Prerequisites); don't use `npm run dev`.
- **"Couldn't load <project>"** in the host — that remote's dev server isn't
  running, or its `*_REMOTE_URL` points elsewhere. Run `pnpm dev` at the root.
- **`pnpm thumbnails` fails** — needs the dev servers up, Node ≥ 22.18 and a
  Playwright Chromium (`pnpm --filter @ncam/portfolio exec playwright install chromium`).

## License

[MIT](LICENSE)
