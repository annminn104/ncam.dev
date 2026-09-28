# Deployment

The frontends deploy to **Vercel**, one project per app, and the blog CMS
deploys to **Render**. **Docker Compose** runs the whole stack on any machine.
The variables mentioned here are described in the
[README](../README.md#configuration).

- [Vercel](#vercel)
- [Docker](#docker)
- [Render (the CMS)](#render-the-cms)

## Vercel

Remotes are static Vite builds, and the host is a Nitro server. Each app has its
own `vercel.json`: build command, output directory, the CORS header the remotes
need, and `ignoreCommand: npx turbo-ignore`, so that a push rebuilds only the
apps it touched. Create **one Vercel project per app** from this repo, each with
the matching **Root Directory**. The live ones:

| App                     | Root Directory         | Production URL                          |
| ----------------------- | ---------------------- | --------------------------------------- |
| Host                    | `apps/portfolio`       | https://ncam-profile.vercel.app         |
| TOONHUB                 | `apps/toonhub`         | https://ncam-toonhub.vercel.app         |
| Mindloop                | `apps/mindloop`        | https://ncam-mindloop.vercel.app        |
| Immersive Ocean         | `apps/immersive-ocean` | https://ncam-immersive-ocean.vercel.app |
| Viktor.                 | `apps/viktor`          | https://ncam-viktor.vercel.app          |
| Bali Adventure          | `apps/bali`            | https://ncam-bali.vercel.app            |
| Profile (home sections) | `apps/profile`         | https://ncam-sections.vercel.app        |
| Holodex                 | `apps/holodex`         | https://ncam-holodex.vercel.app         |

1. **Remotes first.** Pick the Vite framework preset; everything else comes
   from `vercel.json`. Deploy each remote and note its production URL.
   Every remote except Profile also needs a `SITE_URL` Production variable,
   the host's public origin (today `https://ncam-profile.vercel.app`): its
   standalone page duplicates the host's `/projects/<id>`, so its canonical,
   `og:url` and `og:image` are built on that origin. Unset, they name
   `https://ncam.dev`. Holodex's project also deploys `apps/holodex/api/` as a Vercel Function,
   `/api/tcgdex-asset`: the proxy that Holodex's WebGL cards load TCGdex images
   through, because TCGdex's CDN sends `Access-Control-Allow-Origin` twice and
   browsers then refuse the images as textures.
2. **Then the host** (Root Directory `apps/portfolio`). Add these Production
   environment variables. The remote URLs are baked in at build time, so
   redeploy the host after changing one.

   ```
   TOONHUB_REMOTE_URL=https://ncam-toonhub.vercel.app/remoteEntry.js
   MINDLOOP_REMOTE_URL=https://ncam-mindloop.vercel.app/remoteEntry.js
   IMMERSIVE_OCEAN_REMOTE_URL=https://ncam-immersive-ocean.vercel.app/remoteEntry.js
   VIKTOR_REMOTE_URL=https://ncam-viktor.vercel.app/remoteEntry.js
   BALI_REMOTE_URL=https://ncam-bali.vercel.app/remoteEntry.js
   PROFILE_REMOTE_URL=https://ncam-sections.vercel.app/remoteEntry.js
   HOLODEX_REMOTE_URL=https://ncam-holodex.vercel.app/remoteEntry.js
   NODE_OPTIONS=--experimental-vm-modules
   ```

   `NODE_OPTIONS` is what lets federated SSR run on Vercel. The host evaluates
   each remote's server entry with `vm.SourceTextModule`, which needs that flag.
   Without it the loader falls back to writing a cache under `node_modules`,
   which fails on the function's read-only filesystem, and every remote quietly
   mounts on the client instead.

   The host also needs `STRAPI_URL` and `STRAPI_PUBLIC_URL`, both set to the
   CMS's URL (see [Render](#render-the-cms)). Those two are read at runtime, so
   changing them needs no rebuild.

   Nitro detects Vercel and emits the Build Output, and SSR runs in a serverless
   function (10 s at most on the Hobby plan). The home loader gives the six
   profile modules a 4 s budget in total and times out each federated load on
   its own, so a slow or missing remote costs its section's SSR, never the
   response.

3. **Your own domain?** Point it at the host project and set `SITE_URL` there
   (for example `https://ncam.dev`), then redeploy. It is baked in at build time
   and drives canonical URLs, Open Graph, JSON-LD, `robots.txt` and
   `sitemap.xml`. Without it the build uses the project's Vercel production
   domain, so a fresh `*.vercel.app` deploy is already consistent. The remotes
   can stay on `*.vercel.app`, but set the same `SITE_URL` on them and redeploy
   them too, or their canonicals keep naming the old origin.

Hobby plan notes: one build runs at a time, so a push that touches everything
builds the eight projects one after another (`turbo-ignore` skips the untouched
ones); the plan is for non-commercial use only. Share the Turbo cache with
`npx turbo login && npx turbo link`.

## Docker

One multi-stage image builds the whole monorepo, and `docker-compose.yml` runs
the SSR host and each remote (as a static preview) from that same image:

```bash
docker compose up --build                     # host http://localhost:9000, remotes :9001–:9007
docker compose --profile gateway up --build   # + nginx on :80 → http://ncam.localhost
```

Every remote runs in the host container's network namespace
(`network_mode: service:portfolio`), and the host bakes `http://localhost:<port>`
entry URLs, so the **same URL** reaches a remote from the host's server and, by
the ports the portfolio service publishes, from the browser. That is what lets
the host render remotes on the server: `@module-federation/vite` fetches SSR
entries over plain http from loopback hosts only. The URLs are build arguments,
not runtime environment, because the host bakes them in at build time. The
portfolio service also sets `NODE_OPTIONS=--experimental-vm-modules`, as the
Vercel host does.

The gateway proxies each remote on its `*.localhost` subdomain. A host rebuilt
with those port-80 URLs loads its remotes through the gateway, but on the client
only, since the server will not fetch their SSR entries over plain http.

The host caches `/`, `/blog` and `/blog/*` for 60 s through Nitro's `swr`. On
the node-server image that cache lives in process memory and is keyed by path
and query string, so before exposing the stack publicly, strip query strings for
those routes at the gateway or mount a bounded cache storage.

The CMS has its own image and a Postgres container behind the `cms` compose
profile, so the default stack never needs it (SQLite is for development only):

```bash
pnpm --filter @ncam/strapi setup:env                        # secrets + DB password in apps/strapi/.env
docker compose up --build strapi                            # http://localhost:1337/admin, API under /api/*
docker compose --profile gateway --profile cms up --build   # + http://cms.localhost/api/articles
```

Set `PUBLIC_URL` in `apps/strapi/.env` to the origin the CMS is reached at, so
that admin links and media URLs are absolute and correct:
`http://localhost:1337` when you hit the container directly,
`http://cms.localhost` behind the gateway, and `https://cms.<domain>` in
production. Uploads live in the `strapi-uploads` volume, data in
`strapi-db-data`.

The `portfolio` container reads the CMS through `STRAPI_URL=http://strapi:1337`
and serves media from `STRAPI_PUBLIC_URL=http://cms.localhost:1337`. Start the
`cms` profile too (`docker compose --profile cms up`), or the blog renders
empty.

## Render (the CMS)

Strapi needs a long-lived process, a real database and somewhere durable for
uploads, so it runs on Render while the frontends stay on Vercel.
[`render.yaml`](../render.yaml) at the repo root is the Blueprint: the
`ncam-cms` Docker web service and its `ncam-cms-db` Postgres.

1. In the Render Dashboard, choose **New → Blueprint** and pick this repo.
   Render reads `render.yaml` and creates both resources. Leave the Docker
   context at the repo root: the Dockerfile copies `pnpm-workspace.yaml` and
   `pnpm-lock.yaml` from there, so a narrower context cannot install.
2. Apply. The Blueprint generates the six Strapi secrets once and keeps them
   across syncs, and wires `DATABASE_URL` from the database over the private
   network. Nothing needs pasting.
3. Open `<service-url>/admin` and register the first admin user. The database
   starts empty: posts written against the local SQLite do not come along.
4. On the Vercel host project, set `STRAPI_URL` and `STRAPI_PUBLIC_URL` to the
   service URL. Both are read at runtime, so no rebuild is needed.

`PUBLIC_URL` is deliberately unset: `apps/strapi/config/server.ts` falls back to
`RENDER_EXTERNAL_URL`, which Render injects. Set it only for a custom domain.
Render injects `PORT` too, and the server already binds it.

Until step 4, `/blog` renders its empty state and the home page's blog section
shows placeholders. That is by design: the site degrades rather than failing.

### Keeping the free service awake

A free Render service sleeps after 15 minutes without a request. An **uptime
monitor** keeps it awake by requesting
`https://ncam-cms.onrender.com/api/health` every 5 minutes. The route answers
200 when the CMS's database answers too, and 503 when it does not (see
[cms.md](cms.md#health-check)), so the monitor doubles as an alert. Either of
these free services works:

- **UptimeRobot:** add a monitor of type HTTP(s) for that URL, with a 5-minute
  interval and an email alert contact.
- **cron-job.org:** create a cron job for that URL, every 5 minutes, with
  notifications on failure.

The first request after a sleep takes about a minute, so the monitor may log one
failed check while the CMS wakes; from then on it stays up.

`.github/workflows/keep-cms-awake.yml` is the backstop. It is scheduled every 10
minutes, makes one health check per run (the `CMS_URL` repository variable,
default `https://ncam-cms.onrender.com`), and fails when the check fails, so
GitHub emails a failure even if the monitor lapses. It cannot keep the CMS awake
on its own: GitHub runs scheduled workflows on a best-effort basis, and here the
runs have landed hours apart (every 3–6 hours on 2026-09-26/27). GitHub also
disables scheduled workflows after 60 days without repository activity;
re-enable it in the Actions tab.

Render grants 750 free instance hours per workspace per month, and one service
kept awake around the clock uses about 744 of them. A second always-on free
service would exhaust the quota, and Render then suspends **every** free service
until the next month. If more free services appear, keep only one of them awake.

### Free-plan limits

Three free-plan limits hit a CMS specifically, so read these before treating it
as production:

- A free web service **sleeps after 15 minutes idle** and takes about a minute
  to wake. The host allows the CMS 2.5 s on the home page and 5 s per
  `@ncam/cms` request, so the first request after a sleep shows placeholders.
  The workflow above keeps this rare.
- Free web services **cannot attach a persistent disk**, so uploaded media is
  lost on every deploy, restart and spin-down. The `disk` block in
  `render.yaml` is commented out for that reason; uncomment it on a paid plan.
  The fix that keeps the free plan is an external upload provider (S3,
  Cloudinary).
- A **free Postgres database expires 30 days after creation**, with a 14-day
  grace period before deletion.
