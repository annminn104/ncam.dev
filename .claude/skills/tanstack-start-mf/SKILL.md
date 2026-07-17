---
name: tanstack-start-mf
description: Work on the ncam.dev portfolio host — TanStack Start (SSR) + TanStack Router combined with Module Federation. Use when editing apps/portfolio (vite.config, routes, router, mounting remotes), configuring SSR/Nitro, or debugging host↔remote React sharing.
---

# TanStack Start (SSR) + TanStack Router + Module Federation

The `apps/portfolio` host is React 19 + TanStack Start (SSR via Nitro) and acts
as the Module Federation host. Remotes (e.g. `apps/toonhub`) are framework-free
and expose `mount(el) => dispose`; the host mounts them into a `<div>`.

## vite.config.ts (order matters)

`federation()` → `tanstackStart()` → `react()` → `nitro()`, plus a build-exit
plugin. Key options:

- `federation({ name:'portfolio', hostInitInjectLocation:'entry', remotes, shared })`
  - `hostInitInjectLocation: 'entry'` — required: TanStack Start has no
    `index.html`, so MF init goes into the entry (runs before hydration).
  - `shared: { react:{singleton:true,requiredVersion:'^19'}, 'react-dom':{...} }`.
- `tanstackStart({ router: { autoCodeSplitting: true, quoteStyle: 'single' } })`.
- `nitro.traceDeps: ['react','react-dom','@module-federation/runtime',...]` —
  keeps React + MF runtime as Node externals so host + SSR share ONE React
  instance (otherwise hooks/context break).
- `ssr.optimizeDeps.include: ['react','react-dom']`; `build.target: 'chrome89'`.

## Routing (file-based, src/routes/)

- `__root.tsx` — HTML document, `<HeadContent>` for SSR meta/SEO, dev-only
  `RouterDevtools` (lazy, guarded by `import.meta.env.PROD`).
- `index.tsx` — SSR'd gallery from `@ncam/project-registry` (crawlable).
- `projects/$projectId.tsx` — mounts the remote.
- `src/router.tsx` (`getRouter`): `defaultPreload:'intent'`,
  `defaultPreloadStaleTime:0`, `defaultStructuralSharing:true`,
  `scrollRestoration:true`, `defaultNotFoundComponent`, `defaultErrorComponent`.
- `src/routeTree.gen.ts` is generated — committed, never hand-edit.

## Mounting a framework-free remote (critical)

- Load remotes **client-only**, inside `useEffect` — never in SSR or a route
  `loader` (they use `window`/DOM). Keep import specifiers static
  (`() => import('toonhub/mount')`) so the MF plugin can transform them.
- The mount `<div>` must have **no React children** (the remote owns its
  innerHTML). Call the returned disposer on cleanup.

## Gotchas

- Pin TanStack/nitro/vinxi versions — MF + TanStack Router has had version
  breaks. `@tanstack/react-router-devtools` lags react-router (use its own latest).
- `StartClient` in this version doesn't type a `router` prop though the runtime
  accepts it (see `src/client.tsx` cast).
- The Nitro server-bundle step can hang; the build-exit plugin force-exits once
  outputs are written. Deploys as a **server** (SSR), not static.

## Verify

```bash
pnpm --filter @ncam/portfolio typecheck
pnpm --filter @ncam/portfolio build   # client + SSR + Nitro; generates routeTree
```

## SSR mode (Module Federation at the SSR layer)

The remote can render server-side without shipping browser code to the server:

- Remote exposes `./ssr` (`renderHeroSSR → { html, css }`, browser-free, reuses
  `renderHeroHTML` + `hero.css?inline`) and `./hydrate` (attach controller to
  SSR DOM). `./mount` stays for CSR/standalone.
- Host route `loader` (isomorphic) does `import('<remote>/ssr')` — resolved
  server-side by the MF SSR runtime — and returns `{ html, css }`. The component
  inlines `<style>` + `dangerouslySetInnerHTML`, then `useEffect` runs
  `import('<remote>/hydrate')` → `hydrate(el)`.
- Host injects the remote origin via `define` (`VITE_TOONHUB_ORIGIN`) so SSR can
  resolve the remote's asset URLs (the server can't infer the browser origin).
- Only the static first paint is SSR'd; all interactivity/audio/detection is
  client-side. Never import `./hydrate` or `./mount` during SSR.
