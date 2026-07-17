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
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

# ---- build: install offline from the store, then build the whole monorepo ----
FROM deps AS build
# Remote entry URLs are baked into the HOST build (vite.config reads these).
# They use `*.localhost` hostnames so the SAME URL resolves both in the browser
# (loopback) and inside the host container (via docker-compose network aliases)
# — that's what makes server-side (SSR) resolution of remotes work in Docker.
ARG TOONHUB_REMOTE_URL=http://toonhub.localhost:9001/remoteEntry.js
ARG MINDLOOP_REMOTE_URL=http://mindloop.localhost:9002/remoteEntry.js
ARG IMMERSIVE_OCEAN_REMOTE_URL=http://immersive-ocean.localhost:9003/remoteEntry.js
ENV TOONHUB_REMOTE_URL=$TOONHUB_REMOTE_URL \
    MINDLOOP_REMOTE_URL=$MINDLOOP_REMOTE_URL \
    IMMERSIVE_OCEAN_REMOTE_URL=$IMMERSIVE_OCEAN_REMOTE_URL
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline
RUN pnpm build

# ---- runner: production runtime ----
FROM base AS runner
ENV NODE_ENV=production
# Ship built artifacts + node_modules (needed by the Nitro server and by
# `vite preview` for the static remotes).
COPY --from=build /app ./
# host (SSR) + remotes (static)
EXPOSE 9000 9001 9002 9003
# Default: run the portfolio SSR host. docker-compose overrides the command
# for the remote services (see docker-compose.yml).
CMD ["node", "apps/portfolio/.output/server/index.mjs"]
