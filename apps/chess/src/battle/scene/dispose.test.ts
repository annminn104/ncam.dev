import type { BufferGeometry, Material, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeOwned, onDispose, own } from './dispose';

// dispose.ts only imports types from three, so plain objects stand in for GPU resources.
const resource = <T extends BufferGeometry | Material | Texture>() =>
  ({ dispose: vi.fn() }) as unknown as T;

describe('own / disposeOwned', () => {
  it('hands the resource back untouched', () => {
    const geometry = resource<BufferGeometry>();
    expect(own(geometry)).toBe(geometry);
    expect(geometry.dispose).not.toHaveBeenCalled();
    disposeOwned();
  });

  it('frees every owned resource once, and forgets it afterwards', () => {
    const geometry = own(resource<BufferGeometry>());
    const material = own(resource<Material>());
    const texture = own(resource<Texture>());
    disposeOwned();
    for (const r of [geometry, material, texture]) expect(r.dispose).toHaveBeenCalledTimes(1);
    disposeOwned();
    for (const r of [geometry, material, texture]) expect(r.dispose).toHaveBeenCalledTimes(1);
  });

  it('does not free a resource twice when it is owned twice', () => {
    const geometry = own(own(resource<BufferGeometry>()));
    disposeOwned();
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('onDispose', () => {
  it('empties the caches on every disposal, after the resources are freed', () => {
    const order: string[] = [];
    const geometry = own(resource<BufferGeometry>());
    vi.mocked(geometry.dispose).mockImplementation(() => void order.push('dispose'));
    const reset = vi.fn(() => void order.push('reset'));
    onDispose(reset);

    disposeOwned();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['dispose', 'reset']);

    // Registered once, it keeps clearing the cache for every later battle.
    disposeOwned();
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('registering the same reset twice runs it once', () => {
    const reset = vi.fn();
    onDispose(reset);
    onDispose(reset);
    disposeOwned();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
