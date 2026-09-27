import type { ModuleFederation } from '@module-federation/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// forgetFailedRemote also drops the SSR entry loader's cached resolution; stub
// that module so the test sees the call without loading the plugin's loader.
const revalidate = vi.hoisted(() => vi.fn());
vi.mock('@module-federation/vite/ssrEntryLoader', () => ({ revalidate }));

import { forgetFailedRemote } from './federation';

type Remote = { name: string; alias?: string; entry: string };

function fakeRuntime(remotes: Remote[]) {
  const registerRemotes = vi.fn();
  const runtime = { options: { remotes }, registerRemotes } as unknown as ModuleFederation;
  return { runtime, registerRemotes };
}

describe('forgetFailedRemote', () => {
  beforeEach(() => revalidate.mockClear());

  it('finds a remote that the federation plugin registered under a scoped name by its alias', async () => {
    const holodex = {
      name: '__mfe_internal__portfolio__mf_owner__90967736505204__holodex',
      alias: 'holodex',
      entry: 'http://localhost:9007/remoteEntry.js',
    };
    const { runtime, registerRemotes } = fakeRuntime([holodex]);

    await forgetFailedRemote(runtime, 'holodex');

    expect(registerRemotes).toHaveBeenCalledWith([holodex], { force: true });
    expect(revalidate).toHaveBeenCalledWith(holodex.entry);
  });

  it('still finds a remote registered under its plain name', async () => {
    const profile = { name: 'profile', entry: 'http://localhost:9006/remoteEntry.js' };
    const { runtime, registerRemotes } = fakeRuntime([profile]);

    await forgetFailedRemote(runtime, 'profile');

    expect(registerRemotes).toHaveBeenCalledWith([profile], { force: true });
    expect(revalidate).toHaveBeenCalledWith(profile.entry);
  });

  it('leaves the runtime alone when no remote matches', async () => {
    const { runtime, registerRemotes } = fakeRuntime([
      { name: 'profile', entry: 'http://localhost:9006/remoteEntry.js' },
    ]);

    await forgetFailedRemote(runtime, 'holodex');

    expect(registerRemotes).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});
