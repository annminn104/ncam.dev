import { describe, expect, it } from 'vitest';
import { assetUrl } from './asset-url';

describe('assetUrl', () => {
  it("resolves against the remote's own base, whatever page loaded it", () => {
    expect(assetUrl('assets/scene.json', 'https://garden.example/')).toBe(
      'https://garden.example/assets/scene.json',
    );
    expect(assetUrl('/basis/', 'https://garden.example')).toBe('https://garden.example/basis/');
    expect(assetUrl('assets/scene.json', 'http://localhost:9010/garden/')).toBe(
      'http://localhost:9010/garden/assets/scene.json',
    );
  });

  it('stays root-relative without a base', () => {
    expect(assetUrl('assets/scene.json', '')).toBe('/assets/scene.json');
  });
});
