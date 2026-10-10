import { afterEach, describe, expect, it, vi } from 'vitest';
import { projects } from '@ncam/project-registry';
import { ssrAssetBase } from './ssr-asset-base';

const TOONHUB = 'https://toonhub.example.test';

describe('ssrAssetBase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hands TOONHUB the host's idea of its origin, as every server render did before", () => {
    vi.stubEnv('VITE_TOONHUB_ORIGIN', TOONHUB);
    expect(ssrAssetBase('toonhub')).toBe(TOONHUB);
  });

  it('hands every other remote none, so each names its files from its own origin', () => {
    vi.stubEnv('VITE_TOONHUB_ORIGIN', TOONHUB);
    // Chess honours an assetBase: handed TOONHUB's, its server-rendered arena previews would
    // point at TOONHUB, and disagree with the client's, which come from chess's own origin.
    expect(ssrAssetBase('chess')).toBeUndefined();
    const others = projects.filter((project) => project.remote !== 'toonhub');
    expect(others.length).toBeGreaterThan(0);
    for (const { remote } of others) expect(ssrAssetBase(remote)).toBeUndefined();
  });
});
