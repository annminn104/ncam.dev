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

describe('disposeOwned when something throws', () => {
  it('still frees every other resource and empties every cache, then reports the failure', () => {
    const before = own(resource<BufferGeometry>());
    const broken = own(resource<Material>());
    const after = own(resource<Texture>());
    const failure = new Error('lost context');
    vi.mocked(broken.dispose).mockImplementation(() => {
      throw failure;
    });
    const reset = vi.fn();
    onDispose(reset);

    expect(() => disposeOwned()).toThrow(failure);
    expect(before.dispose).toHaveBeenCalledTimes(1);
    expect(after.dispose).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);

    // Forgotten all the same: the next battle neither frees them again nor hits the error.
    expect(() => disposeOwned()).not.toThrow();
    expect(broken.dispose).toHaveBeenCalledTimes(1);
    expect(after.dispose).toHaveBeenCalledTimes(1);
  });

  it('runs every reset even when one throws', () => {
    const failure = new Error('reset failed');
    const first = vi.fn<() => void>(() => {
      throw failure;
    });
    const second = vi.fn();
    onDispose(first);
    onDispose(second);
    const geometry = own(resource<BufferGeometry>());

    expect(() => disposeOwned()).toThrow(failure);
    expect(second).toHaveBeenCalledTimes(1);
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    // A reset that throws stays registered; the caches are module-level and outlive a battle.
    first.mockImplementation(() => undefined);
    disposeOwned();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('reports every failure when more than one thing throws', () => {
    const errors = [new Error('a'), new Error('b')];
    for (const e of errors) {
      const r = own(resource<BufferGeometry>());
      vi.mocked(r.dispose).mockImplementation(() => {
        throw e;
      });
    }
    let thrown: unknown;
    try {
      disposeOwned();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toEqual(errors);
  });
});
