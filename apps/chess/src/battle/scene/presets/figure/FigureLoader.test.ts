import type { BufferGeometry } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeOwned } from '../../dispose';
import { FigureLoader } from './FigureLoader';
import { figureGlb } from './glb-fixture';

const { clear } = vi.hoisted(() => ({ clear: vi.fn() }));
vi.mock('@react-three/fiber', () => ({ useLoader: { clear } }));

/** A packed fixture GLB as a data: URL, which fetch reads like any other. */
async function dataUrl(): Promise<string> {
  const bytes = Buffer.from(await figureGlb({ packed: true }));
  return `data:model/gltf-binary;base64,${bytes.toString('base64')}`;
}

function load(url: string): Promise<BufferGeometry> {
  return new Promise((resolve, reject) => new FigureLoader().load(url, resolve, undefined, reject));
}

describe('FigureLoader', () => {
  it('turns a figure file into the geometry its materials read', async () => {
    const geometry = await load(await dataUrl());
    expect(Object.keys(geometry.attributes).sort()).toEqual([
      '_line',
      '_slot',
      'normal',
      'outlineNormal',
      'position',
    ]);
    expect(geometry.getAttribute('outlineNormal').itemSize).toBe(3);
    expect(geometry.index?.count).toBe(6);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
  });

  it('hands the geometry to the battle, which frees it and forgets the file', async () => {
    const url = await dataUrl();
    const geometry = await load(url);
    const free = vi.spyOn(geometry, 'dispose');
    disposeOwned();
    expect(free).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledWith(FigureLoader, url);
  });

  it('reports a file it cannot read', async () => {
    await expect(load('data:model/gltf-binary;base64,AAAA')).rejects.toThrow(/not a GLB/);
  });
});
