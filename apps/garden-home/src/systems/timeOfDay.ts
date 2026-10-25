import { Color, Vector3 } from 'three';
import type { TimeOverride } from '../params';

export interface SkyTimes {
  sunrise: string;
  sunset: string;
}

export interface SkyState {
  elevationDeg: number;
  sunDir: Vector3;
  sunColor: Color;
  sunIntensity: number;
  hemiIntensity: number;
  skyTop: Color;
  skyBottom: Color;
  nightFactor: number;
}

const MAX_ELEVATION = 60;
const NIGHT_DEPTH = 20;
const DEG = Math.PI / 180;
/** Below this change in elevation (deg) or direction (as a squared chord length), the sun counts as settled. */
const SETTLED_DEG = 0.01;
const SETTLED_DIRECTION_SQ = (SETTLED_DEG * DEG) ** 2;
const DAY_TOP = new Color('#6fb7ff');
const DAY_BOTTOM = new Color('#dff1ff');
const DUSK_TOP = new Color('#41508f');
const DUSK_BOTTOM = new Color('#ffb38a');
const NIGHT_TOP = new Color('#070b1e');
const NIGHT_BOTTOM = new Color('#1a2242');
const SUN_LOW = new Color('#ffb36b');
const SUN_HIGH = new Color('#fff4e0');

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Stylised sun path: a sine arc between sunrise and sunset, a shallow dip below the horizon at night. */
export function sunPosition(
  minutes: number,
  sky: SkyTimes,
): { elevationDeg: number; azimuthDeg: number } {
  const sunrise = toMinutes(sky.sunrise);
  const sunset = toMinutes(sky.sunset);
  const dayLength = sunset - sunrise;
  if (minutes >= sunrise && minutes <= sunset) {
    const p = (minutes - sunrise) / dayLength;
    return { elevationDeg: Math.sin(p * Math.PI) * MAX_ELEVATION, azimuthDeg: -90 + 180 * p };
  }
  const p = ((((minutes - sunset) % 1440) + 1440) % 1440) / (1440 - dayLength);
  return { elevationDeg: -Math.sin(p * Math.PI) * NIGHT_DEPTH, azimuthDeg: 90 + 180 * p };
}

export function computeSky(date: Date, sky: SkyTimes): SkyState {
  const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const { elevationDeg, azimuthDeg } = sunPosition(minutes, sky);
  const el = elevationDeg * DEG;
  const az = azimuthDeg * DEG;
  const day = smoothstep(-6, 12, elevationDeg);
  const dusk = 1 - Math.min(1, Math.abs(elevationDeg) / 12);
  return {
    elevationDeg,
    sunDir: new Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el),
    ).normalize(),
    sunColor: SUN_LOW.clone().lerp(SUN_HIGH, smoothstep(0, 30, elevationDeg)),
    sunIntensity: 3 * smoothstep(-2, 15, elevationDeg),
    hemiIntensity: 0.25 + 0.75 * day,
    skyTop: NIGHT_TOP.clone()
      .lerp(DAY_TOP, day)
      .lerp(DUSK_TOP, dusk * 0.6),
    skyBottom: NIGHT_BOTTOM.clone()
      .lerp(DAY_BOTTOM, day)
      .lerp(DUSK_BOTTOM, dusk * 0.7),
    nightFactor: smoothstep(6, -6, elevationDeg),
  };
}

/** Moonlight is fully in by the time the sun touches the horizon (night factor 0.5). */
export const MOON_RAMP = 2;
/**
 * The moon is the night's key light: high in the sky in front of the house (three space, +z is the façade side) and
 * shadow-casting like the sun, so the slabs keep it — and its blue — out of the rooms while the yard stays moonlit.
 */
export const MOON_DIR = new Vector3(0.35, 0.8, 0.5).normalize();
export const MOON_COLOR = new Color('#9db4f0');
export const MOON_INTENSITY = 0.8;

export interface KeyLight {
  dir: Vector3;
  color: Color;
  intensity: number;
}

/** The shadow-casting directional light: the sun by day, the moon at night, whichever shines brighter. */
export function keyLight(s: SkyState, out: KeyLight): KeyLight {
  const moon = MOON_INTENSITY * Math.min(1, s.nightFactor * MOON_RAMP);
  if (s.sunIntensity >= moon) {
    out.dir.copy(s.sunDir);
    out.color.copy(s.sunColor);
    out.intensity = s.sunIntensity;
  } else {
    out.dir.copy(MOON_DIR);
    out.color.copy(MOON_COLOR);
    out.intensity = moon;
  }
  return out;
}

export function cloneSky(s: SkyState): SkyState {
  return {
    ...s,
    sunDir: s.sunDir.clone(),
    sunColor: s.sunColor.clone(),
    skyTop: s.skyTop.clone(),
    skyBottom: s.skyBottom.clone(),
  };
}

/**
 * Moves `current` toward `target` by k (0..1) in place. Returns true while the sun is still moving,
 * either in elevation or in direction (azimuth changes near noon even when elevation is flat).
 */
export function mixSky(current: SkyState, target: SkyState, k: number): boolean {
  const moving =
    Math.abs(current.elevationDeg - target.elevationDeg) > SETTLED_DEG ||
    current.sunDir.distanceToSquared(target.sunDir) > SETTLED_DIRECTION_SQ;
  current.elevationDeg += (target.elevationDeg - current.elevationDeg) * k;
  current.sunDir.lerp(target.sunDir, k).normalize();
  current.sunColor.lerp(target.sunColor, k);
  current.sunIntensity += (target.sunIntensity - current.sunIntensity) * k;
  current.hemiIntensity += (target.hemiIntensity - current.hemiIntensity) * k;
  current.skyTop.lerp(target.skyTop, k);
  current.skyBottom.lerp(target.skyBottom, k);
  current.nightFactor += (target.nightFactor - current.nightFactor) * k;
  return moving;
}

/** Real time, or today at the ?t=HH:MM override. */
export function resolveNow(override: TimeOverride | null, now: Date = new Date()): Date {
  if (!override) return now;
  const date = new Date(now);
  date.setHours(override.hours, override.minutes, 0, 0);
  return date;
}
