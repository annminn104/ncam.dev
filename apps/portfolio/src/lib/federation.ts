import type { ModuleFederation } from '@module-federation/runtime';
import { createLogger } from '@ncam/logger';

const log = createLogger({ scope: 'portfolio' });

/** Federation host name — must match `federation({ name })` in vite.config.ts. */
export const HOST_NAME = 'portfolio';

export async function getHostRuntime(): Promise<ModuleFederation> {
  const { getInstance } = await import('@module-federation/runtime');
  const runtime = getInstance((instance) => instance.name === HOST_NAME) ?? getInstance();
  if (!runtime) throw new Error('federation host runtime is not initialised');
  return runtime;
}

/**
 * Make a remote loadable again after a failed attempt (typically: the remote
 * was not up yet when the host booted). Two caches remember the failure and
 * never expire on their own — runtime-core keeps the rejected entry-load
 * promise, and the vite plugin's SSR loader caches its (null) SSR-entry
 * resolution — so without this the remote stays un-renderable until restart.
 */
export async function forgetFailedRemote(runtime: ModuleFederation, name: string): Promise<void> {
  const remote = runtime.options.remotes.find((candidate) => candidate.name === name);
  if (!remote) {
    log.warn('federation.forget-skipped', {
      remote: name,
      known: runtime.options.remotes.map((candidate) => candidate.name),
    });
    return;
  }
  // Re-registering with `force` drops the remote's module and its cached entry load.
  runtime.registerRemotes([{ ...remote }], { force: true });
  if ('entry' in remote && remote.entry) {
    const { revalidate } = await import('@module-federation/vite/ssrEntryLoader');
    revalidate(remote.entry);
  }
  log.info('federation.remote-reset', { remote: name });
}

/**
 * Resolve an exposed module of a remote on the SERVER. In the production server
 * bundle the federation plugin rewrites `import('<remote>/<module>')` into a
 * wrapper that boots the host runtime and starts loading the remote — but its
 * promise is created once per process (it rejects forever after one failure)
 * and its namespace never carries the remote's real exports. So the transformed
 * import is awaited only for its side effect and the module is always read from
 * the runtime itself; on failure the remote's caches are reset for next time.
 */
/**
 * Upper bound for resolving one federated module during SSR. The MF runtime can
 * leave a load pending forever (e.g. an unreachable remote during share
 * negotiation); a request must never hang on that — time out, reset the remote
 * and let the client mount the module instead.
 */
export const SSR_LOAD_TIMEOUT_MS = 8_000;

function withTimeout<T>(label: string, promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function loadRemoteModuleSSR<T>(
  remote: string,
  exposed: string,
  load: () => Promise<unknown>,
  timeoutMs = SSR_LOAD_TIMEOUT_MS,
): Promise<T> {
  const id = `${remote}/${exposed}`;
  const startedAt = Date.now();
  const step = (name: string) =>
    log.debug('federation.ssr-step', { module: id, step: name, ms: Date.now() - startedAt });
  step('import-wrapper');
  await withTimeout(`import ${id}`, load(), timeoutMs).catch(() => undefined);
  step('runtime');
  const runtime = await withTimeout('host runtime', getHostRuntime(), timeoutMs);
  try {
    step('load-remote');
    const exports = await withTimeout(`loadRemote ${id}`, runtime.loadRemote<T>(id), timeoutMs);
    step('loaded');
    if (!exports) throw new Error(`${id} resolved to nothing`);
    return exports;
  } catch (error) {
    await forgetFailedRemote(runtime, remote).catch((cleanupError: unknown) => {
      log.warn('federation.forget-failed', { remote, exposed, error: String(cleanupError) });
    });
    throw error;
  }
}
