# AGENTS.md — apps/portfolio

The **host** app: the ncam.dev portfolio, built with **TanStack Start (SSR) +
TanStack Router**, acting as the **Module Federation host** that mounts project
mini-apps (remotes) at runtime. React 19.

## How it works

- `vite.config.ts` composes `federation()` + `tanstackStart()` + `react()` +
  `nitro()`. The federation host declares remotes (currently `toonhub`, entry
  env-overridable via `TOONHUB_REMOTE_URL`), shares `react`/`react-dom` as
  singletons, and uses `hostInitInjectLocation: 'entry'` (TanStack Start has no
  `index.html`). `nitro.traceDeps` keeps React + MF runtime external so server
  code shares one instance.
- File-based routing under `src/routes/`:
  - `__root.tsx` — HTML document + `<HeadContent>` (SSR meta/OG/Twitter for SEO)
    - imports `styles.css`.
  - `index.tsx` — the gallery, rendered from `@ncam/project-registry` (SSR'd →
    crawlable). Cards link to `/projects/$projectId`.
  - `projects/$projectId.tsx` — **SSRs** the remote: the route `loader` calls
    `import('<remote>/ssr')` → `renderHeroSSR({ assetBase })` (resolved
    server-side via MF), returns `{ html, css }`; the component inlines them
    (`<style>` + `dangerouslySetInnerHTML`), then a `useEffect` calls
    `import('<remote>/hydrate')` → `hydrate(el)` to attach interactivity.
- `src/router.tsx` (`getRouter`) + `src/client.tsx` (hydrates `<StartClient>`).
- `src/routeTree.gen.ts` is **generated** by the router plugin — committed, do
  not hand-edit.
- `src/types/remote/toonhub.d.ts` types the federated `mount`/`ssr`/`hydrate` modules.

## Rules

- **Split SSR vs client imports.** Only a remote's **`./ssr`** entry may be
  imported during SSR / in a route `loader` — it must be browser-free (HTML +
  CSS strings). The interactive **`./hydrate`** (and CSR-only `./mount`) touch
  `window`/DOM, so import them **inside `useEffect` only**. The mount `<div>`
  gets its content from `dangerouslySetInnerHTML` (SSR html); the controller
  attaches to it — dispose on cleanup.
- **Static import specifiers.** The federation plugin only transforms literal
  `import('<remote>/<module>')`. Keep one entry per module in the loader maps.
- **Registry drives display; loaders drive loading.** Adding a project = entry in
  `@ncam/project-registry` + `remotes` in `vite.config.ts` + `loaders` entry.
- **SSR for SEO.** Page meta lives in route `head()`; the gallery is server
  rendered. Static `public/robots.txt` + `public/sitemap.xml` (update the domain).
  A mounted remote's deep content still isn't crawlable from the host (loads on
  click) — give a remote its own crawlable deployment if it needs SEO.
- Keep `react`/`react-dom` as MF singletons and Nitro `traceDeps` externals, or
  hooks/context break across the host↔remote boundary.
- Pinned TanStack/nitro/vinxi versions matter (MF + TanStack Router had version
  breaks). Change deliberately and re-verify.

## Deploy

SSR — deploys as a **server** (Nitro), not static. On Vercel, Nitro auto-detects
the platform and emits the Build Output; `vercel.json` just runs `pnpm build`.
Locally: `pnpm build` → `.output/`, run with `node .output/server/index.mjs`.

## Verify

```bash
pnpm --filter @ncam/portfolio typecheck
pnpm --filter @ncam/portfolio build   # client + SSR + Nitro server; generates routeTree
```

End-to-end (host loads remote) needs both dev servers: `pnpm dev` at the repo
root (portfolio :9000, toonhub :9001), then open http://localhost:9000 and open
the TOONHUB project.

> Note: the Nitro server-bundle step can be slow; the config force-exits the
> build once outputs are written.
