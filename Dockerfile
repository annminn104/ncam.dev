# syntax=docker/dockerfile:1
# Multi-stage build for the ncam Turborepo monorepo.
# Produces one image with every app/package built; docker-compose runs the
# portfolio host (SSR) and each remote (static preview) from this same image.

ARG NODE_VERSION=22

# ---- base: Node + pnpm (via corepack) ----
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---- deps: fetch packages into the pnpm store (cached on the lockfile) ----
FROM base AS deps
# `pnpm fetch` needs more than the lockfile: package.json pins pnpm for corepack
# (`packageManager`), and pnpm-workspace.yaml + .npmrc carry the overrides and
# settings the lockfile was resolved with — a frozen fetch rejects a mismatch.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

# ---- build: install offline from the store, then build the whole monorepo ----
FROM deps AS build
# Remote entry URLs are baked into the HOST build (vite.config reads these).
# docker-compose runs every remote in the host container's network namespace,
# so `localhost:<port>` reaches a remote both from the host's server (SSR) and
# from the browser (published ports). The server can only fetch a remote's SSR
# entry from a loopback host over plain http (@module-federation/vite).
ARG TOONHUB_REMOTE_URL=http://localhost:9001/remoteEntry.js
ARG MINDLOOP_REMOTE_URL=http://localhost:9002/remoteEntry.js
ARG IMMERSIVE_OCEAN_REMOTE_URL=http://localhost:9003/remoteEntry.js
ARG VIKTOR_REMOTE_URL=http://localhost:9004/remoteEntry.js
ARG BALI_REMOTE_URL=http://localhost:9005/remoteEntry.js
ARG PROFILE_REMOTE_URL=http://localhost:9006/remoteEntry.js
ARG HOLODEX_REMOTE_URL=http://localhost:9007/remoteEntry.js
ENV TOONHUB_REMOTE_URL=$TOONHUB_REMOTE_URL \
    MINDLOOP_REMOTE_URL=$MINDLOOP_REMOTE_URL \
    IMMERSIVE_OCEAN_REMOTE_URL=$IMMERSIVE_OCEAN_REMOTE_URL \
    VIKTOR_REMOTE_URL=$VIKTOR_REMOTE_URL \
    BALI_REMOTE_URL=$BALI_REMOTE_URL \
    PROFILE_REMOTE_URL=$PROFILE_REMOTE_URL \
    HOLODEX_REMOTE_URL=$HOLODEX_REMOTE_URL
COPY . .
# Strapi (apps/strapi) ships in its own image (apps/strapi/Dockerfile): neither its
# dependencies nor its admin build belong in the monorepo image.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter '!@ncam/strapi'
RUN pnpm exec turbo run build --filter '!@ncam/strapi'

# ---- runner: production runtime ----
FROM base AS runner
ENV NODE_ENV=production
# Ship built artifacts + node_modules (needed by the Nitro server and by
# `vite preview` for the static remotes).
COPY --from=build /app ./
# host (SSR) + remotes (static)
EXPOSE 9000 9001 9002 9003 9004 9005 9006 9007
# Default: run the portfolio SSR host. docker-compose overrides the command
# for the remote services (see docker-compose.yml).
CMD ["node", "apps/portfolio/.output/server/index.mjs"]
