import { describe, expect, it } from 'vitest';
import { BootStallError, describeFailure, NoWebGLError, SceneChunkError } from './failure';

describe('describeFailure', () => {
  it('offers a retry unless WebGL is missing', () => {
    expect(describeFailure(new SceneChunkError('x')).retry).toBe(true);
    expect(describeFailure(new NoWebGLError('x')).retry).toBe(false);
    expect(describeFailure('anything').message).toMatch(/music still plays/);
  });

  it('words a stalled download as any boot that could not start, with Try again in place', () => {
    expect(describeFailure(new BootStallError('x'))).toEqual({
      message: "The 3D player couldn't start. The music still plays.",
      retry: true,
    });
  });

  it('reloads the page for a scene chunk that would not load, and only then', () => {
    // The browser remembers a rejected dynamic import until the page reloads.
    expect(describeFailure(new SceneChunkError('x')).reload).toBe(true);
    expect(describeFailure(new NoWebGLError('x')).reload).toBeFalsy();
    expect(describeFailure(new Error('the model would not load')).reload).toBeFalsy();
    expect(describeFailure('anything').reload).toBeFalsy();
  });
});
