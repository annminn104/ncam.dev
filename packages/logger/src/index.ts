/**
 * @ncam/logger — a tiny, dependency-free, isomorphic logger shared across apps.
 *
 * Works in the browser and during SSR (Node): console output is guarded, and the
 * `CustomEvent` sink only fires where `document` exists. Framework-free.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogRecord {
  scope: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  time: number;
}

export interface LoggerOptions {
  /** Namespace shown in the console prefix and record, e.g. 'portfolio'. */
  scope?: string;
  /** Minimum level emitted. Default 'info'. */
  level?: LogLevel;
  /** Emit to the console. Default true. */
  console?: boolean;
  /** Dispatch a CustomEvent on `document` (browser only). Default true. */
  events?: boolean;
  /** CustomEvent name. Default 'ncam:log'. */
  eventName?: string;
  /** Console label prefix. Default `[scope]`. */
  prefix?: string;
  /** Optional extra sink; receives every emitted record (after level filter). */
  sink?: (record: LogRecord) => void;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
  /** Derive a sub-scoped logger (scope becomes `parent:child`). */
  child(scope: string, overrides?: Partial<LoggerOptions>): Logger;
  readonly scope: string;
  readonly level: LogLevel;
}

function toConsole(
  level: LogLevel,
  prefix: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (typeof console === 'undefined') return;
  const fn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'debug'
          ? console.debug
          : console.log;
  const label = prefix ? `${prefix} ${message}` : message;
  if (data) fn(label, data);
  else fn(label);
}

function toEvent(eventName: string, record: LogRecord): void {
  if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
  try {
    document.dispatchEvent(new CustomEvent(eventName, { detail: record, bubbles: true }));
  } catch {
    /* dispatching is best-effort */
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const scope = options.scope ?? 'app';
  const level = options.level ?? 'info';
  const useConsole = options.console ?? true;
  const useEvents = options.events ?? true;
  const eventName = options.eventName ?? 'ncam:log';
  const prefix = options.prefix ?? `[${scope}]`;
  const sink = options.sink;
  const min = LEVELS[level];

  function emit(recordLevel: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVELS[recordLevel] < min) return;
    const record: LogRecord = {
      scope,
      level: recordLevel,
      message,
      time: Date.now(),
      ...(data ? { data } : {}),
    };
    if (useConsole) toConsole(recordLevel, prefix, message, data);
    if (sink) sink(record);
    if (useEvents) toEvent(eventName, record);
  }

  return {
    debug: (message, data) => emit('debug', message, data),
    info: (message, data) => emit('info', message, data),
    warn: (message, data) => emit('warn', message, data),
    error: (message, data) => emit('error', message, data),
    log: (recordLevel, message, data) => emit(recordLevel, message, data),
    child: (childScope, overrides) =>
      createLogger({
        scope: `${scope}:${childScope}`,
        level,
        console: useConsole,
        events: useEvents,
        eventName,
        sink,
        ...overrides,
      }),
    scope,
    level,
  };
}

export default createLogger;
