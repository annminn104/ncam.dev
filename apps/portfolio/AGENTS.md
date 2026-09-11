# AGENTS.md — apps/portfolio

The **host** app: the ncam.dev portfolio, built with **TanStack Start (SSR) +
TanStack Router**, acting as the **Module Federation host** that mounts remotes
at runtime — the project mini-apps on `/projects/$projectId`, and the home page's
own six sections (the `profile` remote) on `/`. React 19.

## How it works

- `vite.config.ts` composes `federation()` + `tanstackStart()` + `react()` +
  `nitro()`. The federation host declares the remotes (entries env-overridable
  via `<NAME>_REMOTE_URL`), shares `react`/`react-dom` as singletons, and uses
  `hostInitInjectLocation: 'entry'` (TanStack Start has no `index.html`).
  `nitro.traceDeps` keeps React + MF runtime external so server code shares one
  instance.
- File-based routing under `src/routes/`:
  - `__root.tsx` — HTML document + `<HeadContent>` (SSR meta/OG/Twitter for SEO);
    links **one** stylesheet, `src/app.css?url`, from `head().links` so SSR HTML
    is styled on first paint (a side-effect CSS import only attaches after the
    client bundle runs). `app.css` @imports the self-hosted fonts
    (`@fontsource-variable/{syne,inter,jetbrains-mono}`), `@ncam/design-tokens`,
    `styles.css` (base + project stage) and `home.css` (home shell).
  - `index.tsx` — the **home page**: a shell (nav, manifest rail, page-level
    transitions) around six federated modules. See "Home page" below.
  - `projects/$projectId.tsx` — **SSRs** a project remote: the route `loader`
    resolves `import('<remote>/ssr')` through `lib/federation.ts`
    (`loadRemoteModuleSSR`) → `renderHeroSSR({ assetBase })`, returns
    `{ html, css }`; the component inlines them (`<style>` +
    `dangerouslySetInnerHTML`), then a `useEffect` calls
    `import('<remote>/hydrate')` → `hydrate(el)`. Failures log
    `project.ssr-fallback` at warn level and fall back to a client mount.
- `src/lib/federation.ts` — `getHostRuntime`, `forgetFailedRemote`,
  `loadRemoteModuleSSR`. In the production server bundle the plugin's import
  wrapper rejects forever after one failed attempt and never carries the remote's
  exports, so the module is always read from the MF runtime; on failure the
  remote's runtime + SSR-loader caches are reset so a remote that was down when
  the host booted recovers on the next request.
- `src/router.tsx` (`getRouter`) + `src/client.tsx` (hydrates `<StartClient>`).
- `src/routeTree.gen.ts` is **generated** by the router plugin — committed, do
  not hand-edit.
- `src/types/remote/*.d.ts` type the federated modules (`<remote>/mount|ssr|hydrate`,
  and `profile/<section>`).

## Home page (`/`) — six federated modules

Concept: the page eats its own dog food. Each section is an exposed module of the
`profile` remote (`apps/profile`): `profile/hero`, `profile/stacks`,
`profile/experience`, `profile/projects`, `profile/blog`, `profile/contact`, all
shaped `{ ssr(), hydrate(el), mount(el) }`.

- `data/sections.ts` — the contract: section `id` (the DOM id the remote's
  `<section>` renders; nav/rail/tracker key off it), `module` (exposed name),
  `label`, `bg` (page colour while active). Order = page order.
- Route `loader` (prod server only): `loadRemoteModuleSSR('profile', module,
loader)` for the six modules **sequentially** → `mod.ssr()` →
  `{ html: {module: html}, css }` (~250 ms cold, ~10 ms warm). Any module that
  fails or times out (8 s, `SSR_LOAD_TIMEOUT_MS`) is simply client-mounted, and
  the whole loop shares a 4 s page budget (`SSR_PAGE_BUDGET_MS`) so a serverless
  host with a 10 s cap (Vercel Hobby) always gets a response. In `vite dev`
  everything client-mounts (federated SSR is production-only, as for the project
  route).
- **Federation runtime robustness** (learned the hard way, keep both):
  - `shareStrategy: 'loaded-first'` in `vite.config.ts`. `version-first` makes
    the host runtime load EVERY registered remote's entry at init to negotiate
    versions; on the server that init never settles if one remote is unreachable,
    and every SSR request (home and `/projects/*`) hangs. With `loaded-first`
    each `import('<remote>/…')` wrapper registers its own remote lazily.
  - `loadRemoteModuleSSR` races every step against a timeout, then resets the
    remote (`forgetFailedRemote`) and lets the route fall back to a client mount.
  - A remote's SSR bundle must be free of chunk cycles: the plugin's temp-file
    entry loader deadlocks on `A → B → A`. See `apps/profile/AGENTS.md`.
- `SectionSlot`: a `display: contents` div per module (so the module's
  `<section>` is a direct child of `<main>` — the sticky hero needs the page as
  containing block). SSR html goes in via `dangerouslySetInnerHTML`, then the
  module's `hydrate(el)` (or `mount(el)` without SSR). Reports
  idle → loading → ready | error to the page; a failed module renders an inline
  error card that still carries the section id.
- Shell UI: `components/home/nav.tsx` (links + scrubbed reading-progress bar) and
  `components/home/manifest-rail.tsx` (≥1240px; shows each module's real state:
  idle / loading… / loaded / mounted (in view) / cached (seen) / failed).
- `lib/use-section-tracker.ts` — the host's choreography **between** modules:
  one ScrollTrigger per section (active link, rail, `--page-bg` tween on `.home`)
  and the hero "unmount" (as `#stacks` slides over the sticky hero its
  `.hero__inner` scales down and blurs). Re-runs once every module has settled.
  Motion **inside** a section belongs to the remote.
- Project cards inside the remote are plain `<a href="/projects/…">`; the route
  intercepts those clicks and navigates client-side.
- `home.css` = shell only (`.home`, `.hnav*`, `.rail*`, `.mf-slot*`). Section
  styles live in the remote. Tokens are shared via `@ncam/design-tokens`.
- `lib/gsap.ts` — `useGsap()` (gsap.matchMedia, reduced-motion aware,
  StrictMode-safe). The host has its own GSAP instance; the remote bundles
  another — they coexist (the host only touches remote DOM read-only via
  ScrollTriggers + one tween on `.hero__inner`).

## Rules

- **Split SSR vs client imports.** Only a remote's **`./ssr`** entry (or a
  `profile/<section>` module's `ssr()`) may run during SSR / in a route `loader`.
  `hydrate` / `mount` touch `window`/DOM — call them **inside `useEffect` only**.
  The mount `<div>` gets its content from `dangerouslySetInnerHTML` (SSR html);
  the module attaches to it — dispose on cleanup.
- **Static import specifiers.** The federation plugin only transforms literal
  `import('<remote>/<module>')`. Keep one entry per module in the loader maps.
- **Registry drives display; loaders drive loading.** Adding a project = entry in
  `@ncam/project-registry` + `remotes` in `vite.config.ts` + `loaders` entry.
  Adding a home section = component + module in `apps/profile` + `exposes` +
  `data/sections.ts` + `loaders` in `index.tsx` + `types/remote/profile.d.ts`.
- **SSR for SEO.** Page meta lives in route `head()`; the home page is server
  rendered (GSAP/DOM only inside effects — `lib/gsap.ts` is import-safe in Node).
  Static `public/robots.txt` + `public/sitemap.xml` (update the domain).
- Keep `react`/`react-dom` as MF singletons and Nitro `traceDeps` externals, or
  hooks/context break across the host↔remote boundary.
- Pinned TanStack/nitro/vinxi versions matter (MF + TanStack Router had version
  breaks). Change deliberately and re-verify.

## Thumbnails

`public/thumbnails/<id>.jpg` are **generated, not designed**: each is a 1200×630
Playwright capture of `/projects/<id>` on the running host with the fixed
`.stage__back` button hidden (`scripts/capture-thumbnails.mjs`). The same file
is the page's og:image. Regenerate after a remote's hero changes:

```bash
pnpm dev                    # host + remotes must be up
pnpm thumbnails             # all live projects; or `pnpm thumbnails viktor`
```

Needs a Playwright Chromium once: `pnpm --filter @ncam/portfolio exec playwright install chromium`.
Don't hand-edit the images; change the remote (or the script) and re-run.

## Deploy

SSR — deploys as a **server** (Nitro), not static. On Vercel, Nitro auto-detects
the platform and emits the Build Output; `vercel.json` just runs `pnpm build`.
Locally: `pnpm build` → `.output/`, run with `node .output/server/index.mjs`.

## Verify

```bash
pnpm --filter @ncam/portfolio typecheck
pnpm --filter @ncam/portfolio build   # client + SSR + Nitro server; generates routeTree
```

End-to-end needs the dev servers: `pnpm dev` at the repo root (portfolio :9000,
remotes :9001–:9006), then open http://localhost:9000 — the home sections mount
from the `profile` remote; open a project to mount its remote.

> Note: the Nitro server-bundle step can be slow; the config force-exits the
> build once outputs are written.
