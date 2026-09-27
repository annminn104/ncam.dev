# AGENTS.md — monorepo root

## What this repo is

A Turborepo monorepo that hosts a **project showcase**. A server-rendered
**host** app renders independent **project remotes** at runtime through
**Module Federation** (micro-frontend architecture). Each remote is its own
Vite app, built and deployable on its own, and mounted into the host on demand.
`README.md` is the human-facing overview; `docs/deployment.md` and
`docs/cms.md` hold the deployment and CMS guides.

```
apps/
  portfolio/        Host (:9000). TanStack Start (SSR on Nitro) + TanStack Router,
                    React 19: home page, gallery, /projects/<id> stage, blog.
  toonhub/          TOONHUB hero remote (:9001). Framework-free TypeScript.
  mindloop/         Mindloop landing-page remote (:9002). React 19.
  immersive-ocean/  Immersive Ocean hero remote (:9003). React 19.
  viktor/           Viktor. hero remote (:9004). React 19.
  bali/             Bali Adventure landing-page remote (:9005). React 19.
  profile/          The home page's six sections as federated modules (:9006),
                    profile/hero … profile/contact. React 19.
  holodex/          Pokémon TCG explorer remote (:9007). React 19, route-aware
                    (host-owned nested URLs, no remount on in-app navigation),
                    with a lazily-chunked three.js holo card renderer.
  strapi/           Strapi 5 headless CMS for the blog (:1337): a backend
                    service, not a federation remote.
packages/
  mf-remote/         defineRemote() (every remote's Vite config), the .env
                     reader, and the MountConfig / MountHandle contract.
  project-registry/  Typed list of projects: gallery, project routes, sitemap.
  design-tokens/     CSS custom properties shared by the host and profile.
  logger/            Isomorphic logger (@ncam/logger).
  cms/               Typed Strapi client + BlogPost view model, server-side use.
  tsconfig/          Shared base TypeScript config (@ncam/tsconfig).
turbo.json, pnpm-workspace.yaml, package.json  (workspace root)
```

Every app and every package but `packages/tsconfig` has its **own AGENTS.md**.
When working inside an app, read that app's AGENTS.md first — it owns the rules
for that unit. This root file only covers cross-cutting monorepo concerns.

## Tooling

- **pnpm** workspaces (`pnpm-workspace.yaml`). Use `pnpm`, not npm/yarn.
- **Turborepo** orchestrates tasks (`turbo.json`, v2 `tasks` schema).
- **Vite** builds every frontend app; **Module Federation** via `@module-federation/vite`.
  `apps/strapi` is the exception: a Strapi (Node) service with its own build.
- **TypeScript** everywhere. React 19 in the host and most remotes; TOONHUB is
  framework-free. No framework runtime is shared across the federation
  boundary (see `shared` below).
- Node 22 (`.nvmrc`).

Commands (from the root):

```bash
pnpm install
pnpm dev              # every dev server (host :9000, remotes :9001–:9007, strapi :1337)
pnpm build            # builds every app
pnpm typecheck
pnpm lint             # ESLint; `pnpm format:check` for Prettier
pnpm test             # Vitest, node environment (no jsdom)
pnpm run ci           # lint + format:check + typecheck + test + build, as CI runs them
pnpm assets           # downloads project image assets where apps define it
pnpm thumbnails <id>  # regenerates a gallery thumbnail (needs `pnpm dev` running)
```

## Micro-frontend contract

- The **host** declares its remotes in `apps/portfolio/vite.config.ts` and
  loads them with **static** `import('<remote>/<module>')` specifiers (the
  federation plugin only transforms literals). The loader maps live in
  `apps/portfolio/src/components/ProjectStage.tsx`.
- Each project remote exposes three entries through `defineRemote()`:
  - `./mount`: `mount(target, config?: MountConfig): MountHandle`, a client render;
  - `./ssr`: `renderHeroSSR({ config?, assetBase? }): { html, css }`, browser-free;
  - `./hydrate`: `hydrate(target, config?: MountConfig): MountHandle`, over the SSR markup.

  The `profile` remote instead exposes one `{ ssr, hydrate, mount }` module per
  home-page section.

- `config` is always the host's **`MountConfig`**
  (`packages/mf-remote/src/contract.ts`: `route`, `onNavigate`, `assetBase`),
  the same object for every remote, never the remote's own data. TOONHUB once
  read it as its own config, and every one of its entries threw in production.
- A `MountHandle` is a disposer. A **route-aware** remote (Holodex; registry
  `routeAware: true`) also gives it `update(route)`, which the host calls on
  in-app navigation instead of remounting.
- Remotes own their assets. Because the host and a remote can live on different
  origins, a remote must resolve its own asset URLs against its origin (see
  `apps/toonhub/src/mount.ts`), never assume the host origin.
- `shared: {}` on every remote: each one bundles its own runtime, React
  included, so it behaves the same standalone and mounted, whatever the host's
  own `shared` block declares. Keep it that way unless a genuine shared runtime
  is introduced.
- `dts: false` on every remote (`packages/mf-remote`) as on the host: the host
  types each remote by hand in `apps/portfolio/src/types/remote/`. Don't turn
  the plugin's generated types back on: in dev it runs a full `tsc` for every
  file event a dev server sees, all at once and never debounced, and a build
  writing into `dist-ssr` (which Vite's watcher did not ignore; the remote
  config now does) once spawned ~400 and took the machine down.

## Federated SSR

- Only production builds server-render remotes; under `vite dev` every remote
  mounts on the client. A remote whose server render fails falls back to a
  client mount, and the host logs `project.ssr-fallback` or `home.ssr-fallback`.
- The host evaluates remote SSR entries with the ssrEntryLoader's `vm`
  strategy, which needs `NODE_OPTIONS=--experimental-vm-modules` wherever the
  host runs: the Vercel host project and the compose `portfolio` service.
- `@module-federation/vite` (≥ 1.18) fetches SSR entries over plain http only
  from `localhost`, `127.0.0.1` or `[::1]`, and swallows the refusal. That is
  why the compose remotes share the host container's network namespace and the
  host bakes `http://localhost:<port>` entry URLs; anything else must be https.
- `apps/portfolio/src/lib/federation.ts` resets a failed remote so that it
  recovers on the next request. The plugin registers remotes as
  `<scope>__<name>` with the configured name as alias, so match either.

## Adding a new project

`README.md` → "Adding a project" has the full checklist. In short:

1. Create `apps/<id>/` with `defineRemote()` exposing `./mount`, `./ssr` and
   `./hydrate` (copy `apps/viktor`); its build script is `vite build --app`.
2. Give it its own `AGENTS.md`, a `vercel.json`, and its `<NAME>_PORT` and
   `<NAME>_REMOTE_URL` in `.env`.
3. Host: `remotes` in `apps/portfolio/vite.config.ts`, the three loader maps in
   `ProjectStage.tsx`, and types in `apps/portfolio/src/types/remote/<id>.d.ts`.
4. Register it in `packages/project-registry` (`routeAware` if it owns nested URLs).
5. Docker: a compose service with `network_mode: service:portfolio` (its port
   published on `portfolio`), a `Dockerfile` `ARG`, and an nginx upstream at
   `portfolio:<port>` plus a server block.
6. With `pnpm dev` running, generate its gallery thumbnail: `pnpm thumbnails <id>`
   (a 1200×630 capture of the project page, minus the host's back button — see
   `apps/portfolio/scripts/capture-thumbnails.mjs`).

## Turborepo notes

- Use the v2 `tasks` key (not `pipeline`).
- `build` depends on `^build` (upstream packages) and the local `assets` task.
- `dev` / `preview` are `persistent` and uncached.
- Tasks run in strict env mode: a variable reaches a task only when
  `turbo.json` lists it (`build` takes `*_REMOTE_URL`, `*_PORT`, `*_BASE`,
  `STRAPI_*`, `SITE_URL` and a few more). `.env` is a global dependency, so
  editing it invalidates every cached task.

## Verification

`pnpm run ci` must pass; the pre-push hook runs `turbo run typecheck build`.
Runtime host↔remote integration needs the dev servers running (`pnpm dev`) or
deployed remote URLs configured in the host. Server rendering needs a
production build, either `pnpm build` then
`NODE_OPTIONS=--experimental-vm-modules node apps/portfolio/.output/server/index.mjs`,
or `docker compose up --build`.
