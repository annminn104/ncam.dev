import type { Color } from 'three';

export interface SkyColors {
  top: Color;
  bottom: Color;
}

/** How much the sky reflection lights the PBR materials by day; glass multiplies it by GLASS_ENV_INTENSITY. */
export const ENV_INTENSITY = 0.5;
/**
 * At full night the reflection drops to this share: the navy night sky otherwise tints every surface, and glass (which
 * reflects it 1.5×) lays a blue veil over the warmly lit rooms behind it.
 */
export const NIGHT_ENV_SCALE = 0.3;

/** scene.environmentIntensity for a night factor (0 = day, 1 = full night). */
export function environmentIntensity(nightFactor: number): number {
  return ENV_INTENSITY * (1 + (NIGHT_ENV_SCALE - 1) * nightFactor);
}

/** Largest per-channel change (linear RGB) of either sky colour that still reuses the last environment map. */
export const ENV_REFRESH_THRESHOLD = 0.02;

function channelDelta(a: Color, b: Color): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

/** True when the sky drifted far enough from the colours of the last PMREM to render a new one (villa spec §7). */
export function shouldRefreshEnvironment(
  last: SkyColors | null,
  now: SkyColors,
  threshold: number = ENV_REFRESH_THRESHOLD,
): boolean {
  if (last === null) return true;
  return (
    channelDelta(last.top, now.top) > threshold || channelDelta(last.bottom, now.bottom) > threshold
  );
}
