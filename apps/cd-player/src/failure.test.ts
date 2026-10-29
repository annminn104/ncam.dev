import { describe, expect, it } from 'vitest';
import { describeFailure, NoWebGLError, SceneChunkError } from './failure';

describe('describeFailure', () => {
  it('offers a retry unless WebGL is missing', () => {
    expect(describeFailure(new SceneChunkError('x')).retry).toBe(true);
    expect(describeFailure(new NoWebGLError('x')).retry).toBe(false);
    expect(describeFailure('anything').message).toMatch(/music still plays/);
  });
});
