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
# Probe $PORT, not a literal 1337: config/server.ts binds to it, and hosts that
# assign the port themselves (Railway, Fly) rarely pick 1337 — a hardcoded probe
# there reports a healthy container as failing.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 1337) + '/_health').then((r) => process.exit(r.status === 204 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "node_modules/@strapi/strapi/bin/strapi.js", "start"]
