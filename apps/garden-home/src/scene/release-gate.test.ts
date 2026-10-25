import { describe, expect, it, vi } from 'vitest';
import { createReleaseGate } from './release-gate';

/** A gate whose deferred runs wait in `deferred` until the test calls flush(). */
function setup() {
  const release = vi.fn();
  const deferred: Array<() => void> = [];
  const gate = createReleaseGate(release, (run) => deferred.push(run));
  const flush = () => {
    while (deferred.length > 0) deferred.shift()?.();
  };
  return { gate, release, deferred, flush };
}

describe('createReleaseGate', () => {
  it('releases at once when no scene is mounted', () => {
    const { gate, release } = setup();
    gate.request();
    expect(release).toHaveBeenCalledOnce();
  });

  it('waits for the mounted scene to unmount, then releases once the deferred run comes', () => {
    const { gate, release, deferred, flush } = setup();
    const unmount = gate.mount();
    gate.request();
    expect(release).not.toHaveBeenCalled();
    unmount();
    expect(release).not.toHaveBeenCalled();
    expect(deferred).toHaveLength(1);
    flush();
    expect(release).toHaveBeenCalledOnce();
  });

  it("never releases for an unmount and mount without a request (StrictMode's simulated unmount)", () => {
    const { gate, release, deferred, flush } = setup();
    gate.mount()();
    gate.mount();
    flush();
    expect(deferred).toHaveLength(0);
    expect(release).not.toHaveBeenCalled();
  });

  it('keeps the resources of a scene mounted after the request', () => {
    const { gate, release, flush } = setup();
    const first = gate.mount();
    gate.request();
    first();
    gate.mount();
    flush();
    expect(release).not.toHaveBeenCalled();
  });

  it('waits for every scene mounted at the request', () => {
    const { gate, release, deferred, flush } = setup();
    const one = gate.mount();
    const two = gate.mount();
    gate.request();
    one();
    expect(deferred).toHaveLength(0);
    two();
    expect(deferred).toHaveLength(1);
    flush();
    expect(release).toHaveBeenCalledOnce();
  });

  it('starts afresh after a release: the next request releases at once again', () => {
    const { gate, release, flush } = setup();
    const unmount = gate.mount();
    gate.request();
    unmount();
    flush();
    gate.request();
    expect(release).toHaveBeenCalledTimes(2);
  });
});
