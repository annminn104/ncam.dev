import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ENV_INTENSITY,
  ENV_REFRESH_THRESHOLD,
  environmentIntensity,
  NIGHT_ENV_SCALE,
  shouldRefreshEnvironment,
} from './environmentPolicy';

const rgb = (r: number, g: number, b: number) => new Color().setRGB(r, g, b);
const noon = { top: rgb(0.2, 0.45, 1.0), bottom: rgb(0.75, 0.88, 1.0) };

describe('shouldRefreshEnvironment', () => {
  it('renders the first environment map', () => {
    expect(shouldRefreshEnvironment(null, noon)).toBe(true);
  });

  it('reuses the map while the sky is unchanged', () => {
    expect(
      shouldRefreshEnvironment(noon, { top: noon.top.clone(), bottom: noon.bottom.clone() }),
    ).toBe(false);
  });

  it('ignores drift below the threshold', () => {
    const drift = ENV_REFRESH_THRESHOLD / 2;
    expect(
      shouldRefreshEnvironment(noon, { top: rgb(0.2 + drift, 0.45, 1.0), bottom: noon.bottom }),
    ).toBe(false);
  });

  it('refreshes when either colour moves past the threshold', () => {
    const step = ENV_REFRESH_THRESHOLD * 2;
    expect(
      shouldRefreshEnvironment(noon, { top: rgb(0.2, 0.45 - step, 1.0), bottom: noon.bottom }),
    ).toBe(true);
    expect(
      shouldRefreshEnvironment(noon, { top: noon.top, bottom: rgb(0.75, 0.88, 1.0 - step) }),
    ).toBe(true);
  });
});

describe('environmentIntensity', () => {
  it('keeps the full sky reflection by day', () => {
    expect(environmentIntensity(0)).toBe(ENV_INTENSITY);
  });

  it('dims the dark night sky reflection so glass and rooms are not veiled in blue', () => {
    expect(environmentIntensity(1)).toBeCloseTo(ENV_INTENSITY * NIGHT_ENV_SCALE);
    expect(NIGHT_ENV_SCALE).toBeLessThan(0.5);
  });

  it('fades smoothly with the night factor', () => {
    let last = Infinity;
    for (let n = 0; n <= 1; n += 0.1) {
      const v = environmentIntensity(n);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
  });
});
