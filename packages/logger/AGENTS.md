# AGENTS.md — @ncam/logger

A tiny, dependency-free, **isomorphic** logger shared by all apps.

- Ships **raw TypeScript** (`src/index.ts` is the entry) — consumers are Vite
  apps that transpile it. No build step, no runtime deps.
- **Isomorphic / SSR-safe:** console output is guarded; the `CustomEvent` sink
  only fires where `document` exists (browser). Safe to import in SSR/Node code.

## API

```ts
import { createLogger } from '@ncam/logger';

const log = createLogger({ scope: 'portfolio' /*, level, console, events, eventName, prefix, sink */ });
log.info('project.open', { id: 'toonhub' });   // → console + CustomEvent('ncam:log')
log.debug(...); log.warn(...); log.error(...);
const child = log.child('router');              // scope 'portfolio:router'
```

Each call emits a `LogRecord` `{ scope, level, message, data?, time }` to:

1. the console (if `console !== false`), and
2. a `CustomEvent(eventName, { detail: record })` on `document` (browser only, if `events !== false`).

## Rules

- Keep it **dependency-free and framework-free** (DOM + Node only). Do not import
  app code here.
- Anything browser-only (`document`, `CustomEvent`) must stay guarded so SSR
  never throws.
- Level order: `debug < info < warn < error`; records below the configured
  `level` are dropped before any sink runs.
- Apps may pass a custom `sink` (e.g. to forward to an external service) or set
  `eventName` (toonhub uses `'toonhub:action'` to keep its action-event name).
