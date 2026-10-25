import { describe, expect, it } from 'vitest';
import {
  CHUNK_FAILURE,
  describeFailure,
  GardenStartError,
  GENERIC_FAILURE,
  NO_WEBGL2,
  SceneChunkError,
} from './failure';

describe('describeFailure', () => {
  it("speaks a GardenStartError's own words and offers a retry", () => {
    expect(describeFailure(new GardenStartError(NO_WEBGL2))).toEqual({
      message: NO_WEBGL2,
      retry: true,
    });
  });

  it('says to reload when the scene chunk would not load (lazy imports remember the failure)', () => {
    expect(describeFailure(new SceneChunkError('net::ERR_FAILED'))).toEqual({
      message: CHUNK_FAILURE,
      retry: false,
    });
  });

  it('keeps anything else generic', () => {
    expect(describeFailure(new Error('WebGL context lost'))).toEqual({
      message: GENERIC_FAILURE,
      retry: true,
    });
    expect(describeFailure('nope')).toEqual({ message: GENERIC_FAILURE, retry: true });
  });
});
