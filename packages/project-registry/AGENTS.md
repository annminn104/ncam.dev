# AGENTS.md — @ncam/project-registry

Shared, typed source of truth for the projects the shell showcases.

- Ships **raw TypeScript** (`src/index.ts` is the package entry). Consumers are
  Vite apps that transpile it — do not add a build step unless a non-bundler
  consumer appears.
- `ProjectEntry` is the contract. `remote` + `module` must match a remote
  declared in `apps/portfolio/vite.config.ts` and a loader in `apps/portfolio/src/main.ts`.
- Keep this package free of DOM/runtime code — data and types only, so any app
  can import it cheaply.
- When adding a project: append a `ProjectEntry`. Wiring the actual remote is
  done in the shell (see root AGENTS.md → "Adding a new project").
