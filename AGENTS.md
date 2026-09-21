# AGENTS.md — monorepo root

## What this repo is

A Turborepo monorepo that hosts a **project showcase**. A root **shell** app
renders independent **project mini-apps** at runtime using **Module Federation**
(micro-frontend architecture). Each project is its own app, built and deployable
on its own, and mounted into the shell on demand.

```
apps/
  portfolio/ Host. Gallery of projects + a stage that mounts the selected
             project remote at runtime. (has its own AGENTS.md)
  toonhub/   The TOONHUB collectible-figurine hero, now a federated remote
             exposing a framework-free mount() function. (has its own AGENTS.md)
  holodex/   Pokémon TCG explorer remote (port 9007) with a route-aware
             MountConfig/MountHandle contract (host-owned nested URLs, no
             remount on in-app navigation) and a lazily-chunked three.js holo
             card renderer. (has its own AGENTS.md)
  strapi/    Strapi 5 headless CMS for the blog — a backend service, not a
             federation remote: public read-only REST API on :1337. (has its own AGENTS.md)
packages/
  project-registry/  Shared, typed list of projects the shell renders.
  logger/            Shared isomorphic logger (@ncam/logger) used by both apps.
  cms/               Typed Strapi client + BlogPost view-model (@ncam/cms), server-side use.
  tsconfig/          Shared base TypeScript config (@ncam/tsconfig).
turbo.json, pnpm-workspace.yaml, package.json  (workspace root)
```

Each app and shared package has (or should have) its **own AGENTS.md**. When
working inside an app, read that app's AGENTS.md first — it owns the rules for
that unit. This root file only covers cross-cutting monorepo concerns.

## Tooling

- **pnpm** workspaces (`pnpm-workspace.yaml`). Use `pnpm`, not npm/yarn.
- **Turborepo** orchestrates tasks (`turbo.json`, v2 `tasks` schema).
- **Vite** builds every frontend app; **Module Federation** via `@module-federation/vite`.
  `apps/strapi` is the exception: a Strapi (Node) service with its own build.
- **TypeScript** everywhere; strict, framework-free (no React/Vue/etc runtime).

Commands (from the root):

```bash
pnpm install
pnpm dev        # runs every app's dev server (shell :9000, remotes :9001–:9007, strapi :1337)
pnpm build      # builds every app
pnpm typecheck
pnpm assets     # downloads project image assets where apps define it
```

## Micro-frontend contract

- The **shell** (host) declares its remotes in `apps/portfolio/vite.config.ts` and
  loads them at runtime with a dynamic `import('<remote>/<module>')`.
- Each **remote** exposes a framework-free entry that renders itself into a DOM
  element: `mount(target: HTMLElement, config?) => () => void` plus
  `unmount(target)`. The returned function unmounts. No shared framework runtime.
- Remotes own their assets. Because the shell and a remote can live on different
  origins, a remote must resolve its own asset URLs against its origin (see
  `apps/toonhub/src/mount.ts`), never assume the host origin.
- `shared: {}` — there is no shared framework to dedupe. Keep it that way unless a
  genuine shared runtime is introduced.

## Adding a new project

1. Create `apps/<project>/` as a Vite app that exposes `./mount` via
   `@module-federation/vite` (copy `apps/toonhub` as a template).
2. Give it its own `AGENTS.md`.
3. Register it in `apps/portfolio/vite.config.ts` (`remotes`) **and** add a loader
   entry in `apps/portfolio/src/main.ts` (`loaders`) — the import specifier must be
   static so the federation plugin can transform it.
4. Add its metadata to `packages/project-registry` so the gallery shows it.
5. With `pnpm dev` running, generate its gallery thumbnail: `pnpm thumbnails <id>`
   (a 1200×630 capture of the project page, minus the host's back button — see
   `apps/portfolio/scripts/capture-thumbnails.mjs`).

## Turborepo notes

- Use the v2 `tasks` key (not `pipeline`).
- `build` depends on `^build` (upstream packages) and the local `assets` task.
- `dev` / `preview` are `persistent` and uncached.

## Verification

`pnpm install && pnpm build` must pass. `pnpm typecheck` must be clean. Runtime
host↔remote integration requires the dev servers running (`pnpm dev`) or
deployed remote URLs configured in the shell.
