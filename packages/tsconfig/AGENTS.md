# AGENTS.md — @ncam/tsconfig

The one shared TypeScript config, `base.json`. No code and no build step: each
workspace's `tsconfig.json` extends it and adds only what that workspace needs.

## `base.json`

It is for type-checking only (`noEmit`): Vite and Nitro transpile the apps, and
`tsc` never emits.

- `target` and `lib` are ES2022, plus `DOM` and `DOM.Iterable`; `module` is
  `ESNext` with `moduleResolution: "bundler"` and `resolveJsonModule`.
- `strict`, `noUnusedLocals`, `noUnusedParameters` and
  `noFallthroughCasesInSwitch` are on.
- `verbatimModuleSyntax` and `isolatedModules` are on, so every type-only import
  is written `import type`, as a per-file transpiler needs.
- `esModuleInterop`, `skipLibCheck` and `forceConsistentCasingInFileNames` are
  on; `allowJs` is off.

## Who extends it

Every app but `apps/strapi` (bali, holodex, immersive-ocean, mindloop,
portfolio, profile, toonhub, viktor) and every package with TypeScript (cms,
logger, mf-remote, project-registry) extends it through
`"extends": "@ncam/tsconfig/base.json"`, with a `workspace:*` dependency on this
package. Each adds its own `include` and `types` (`vite/client` and `node` in
the apps, `node` in the packages), and the React apps add `jsx: "react-jsx"`.

`apps/strapi` keeps Strapi's own config (CommonJS, Node resolution, ES2020),
the shape Strapi's server build expects; don't point it at `base.json`.
`packages/design-tokens` is CSS only.

## Rules

- Keep `base.json` to options that hold for every consumer. Anything
  framework- or runtime-specific (`jsx`, `types`, extra `lib` entries) belongs
  in the consumer's own `tsconfig.json`.
- A change here re-types twelve workspaces, so run `pnpm typecheck` at the root.
  Turbo hashes `base.json` into every consumer's `typecheck` task (checked
  2026-09-27), so a changed base never replays a cached pass.
- `noEmit` stays on: nothing in the repo consumes `tsc` output.
- `files` in `package.json` must list every config file that consumers extend.
