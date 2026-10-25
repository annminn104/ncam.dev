import type { Column, ColumnStyle, LotusCluster } from './scenery';

// Where each arena's scenery stands. The board's squares span ±4 and its frame ±4.4, with its
// top at y 0. Anything that rises above the board's level must never come between the camera
// and the board, whatever the player does with the camera (layout.test.ts checks every
// reachable camera); scenery below the board's level cannot.

/** The underside of the board's frame (Board.tsx: 0.3 deep, its top at -0.01): what it sits on. */
export const BOARD_UNDERSIDE = -0.31;

const KARST_PROFILE = (t: number) => 1 - 0.24 * t + 0.07 * Math.sin(t * 9);

export const CLOUD_PEAK = {
  /**
   * The peak under the dais, narrowing away into the cloud sea. Its flat top hides under the
   * dais, whose corners overhang it.
   */
  summit: { x: 0, z: 0, base: -17, top: -0.95, radius: 5, seed: 3 } satisfies Column,
  summitStyle: {
    sides: 12,
    rings: 9,
    profile: (t) => 0.12 + 0.88 * Math.pow(t, 1.4),
    jag: 0.2,
    lean: 0,
    cap: 'flat',
    // Pale grey crags, mossy only along the rim under the dais.
    colors: { base: '#7c8792', top: '#8ba585', cap: '#86a77f' },
    ramp: 6,
  } satisfies ColumnStyle,
  /** Slender karst pillars rising out of the clouds round the summit; their crowns are green. */
  pillars: [
    { x: -17, z: -14, base: -16, top: -1.6, radius: 1.5, seed: 11 },
    { x: 19, z: -19, base: -16, top: -0.4, radius: 1.8, seed: 12 },
    { x: -27, z: -29, base: -16, top: 2.5, radius: 2.0, seed: 13 },
    { x: 9, z: -36, base: -16, top: 1.0, radius: 1.7, seed: 14 },
    { x: 31, z: -9, base: -16, top: 2.0, radius: 1.9, seed: 19 },
    { x: -30, z: 7, base: -16, top: 1.2, radius: 1.8, seed: 15 },
    { x: 24, z: 17, base: -16, top: -0.8, radius: 1.6, seed: 16 },
    { x: -14, z: 27, base: -16, top: 0.6, radius: 1.7, seed: 17 },
    { x: 11, z: 33, base: -16, top: 2.2, radius: 2.0, seed: 18 },
    // Further out, where a phone's tall view of the sea reaches.
    { x: -9, z: -52, base: -16, top: 4.5, radius: 2.4, seed: 41 },
    { x: 15, z: -60, base: -16, top: 3.0, radius: 2.2, seed: 42 },
    { x: -4, z: 58, base: -16, top: 4.0, radius: 2.3, seed: 43 },
    { x: 17, z: 50, base: -16, top: 1.5, radius: 2.0, seed: 44 },
  ] satisfies Column[],
  pillarStyle: {
    sides: 9,
    rings: 6,
    profile: KARST_PROFILE,
    jag: 0.12,
    lean: 0.06,
    cap: 'dome',
    colors: { base: '#5d6b77', top: '#8e9c95', cap: '#5f8f62' },
    ramp: 2,
  } satisfies ColumnStyle,
  /** Peaks on the horizon, painted already hazed (unlit and unfogged). */
  far: [
    { x: -62, z: -108, base: -24, top: 20, radius: 5.5, seed: 21 },
    { x: -48, z: -122, base: -24, top: 12, radius: 4.2, seed: 30 },
    { x: 40, z: -126, base: -24, top: 27, radius: 6.5, seed: 22 },
    { x: 58, z: -112, base: -24, top: 15, radius: 4.5, seed: 31 },
    { x: 112, z: -70, base: -24, top: 18, radius: 5, seed: 23 },
    { x: -126, z: -36, base: -24, top: 24, radius: 6, seed: 24 },
    { x: 124, z: 48, base: -24, top: 22, radius: 6, seed: 25 },
    { x: -102, z: 84, base: -24, top: 15, radius: 4.8, seed: 26 },
    { x: 28, z: 132, base: -24, top: 26, radius: 6.5, seed: 27 },
    { x: -38, z: 142, base: -24, top: 18, radius: 5, seed: 28 },
    { x: 146, z: -12, base: -24, top: 13, radius: 4, seed: 29 },
    { x: -150, z: 20, base: -24, top: 16, radius: 4.5, seed: 32 },
  ] satisfies Column[],
  farStyle: {
    sides: 9,
    rings: 6,
    profile: (t) => 1 - 0.45 * t + 0.06 * Math.sin(t * 9),
    jag: 0.1,
    lean: 0.05,
    cap: 'dome',
    colors: { base: '#d9e8ee', top: '#a7bec8', cap: '#9db7b2' },
  } satisfies ColumnStyle,
  /** Cloud tops stay below this height, under the dais. */
  cloudTop: -2.4,
  /** The hazy floor of the cloud sea, under the puffs, so the sea has no holes. */
  cloudFloor: -8,
};

export const BLOOD_MOON = {
  lava: -7.6,
  /** The basalt pillar the board stands on, rising out of the lava. */
  pillar: { x: 0, z: 0, base: -9.5, top: BOARD_UNDERSIDE, radius: 6.9, seed: 5 } satisfies Column,
  pillarStyle: {
    sides: 7,
    rings: 5,
    profile: (t) => 1.12 - 0.12 * t,
    jag: 0.05,
    lean: 0,
    cap: 'flat',
    colors: { base: '#5c2a20', top: '#2a1e20', cap: '#161012' },
    // 1 at the lava's surface, 0 three units above it (the shader clamps).
    heat: { base: 1.6, top: -1.35 },
    tile: 5,
  } satisfies ColumnStyle,
  /** Jagged spires standing in the lava round the pillar: the abyss's canyon. */
  spires: [
    { x: -14, z: -11, base: -9, top: -1.6, radius: 1.9, seed: 31 },
    { x: 15, z: -14, base: -9, top: -0.8, radius: 2.3, seed: 32 },
    { x: -22, z: -24, base: -9, top: -0.6, radius: 2.8, seed: 33 },
    { x: 4, z: -26, base: -9, top: -2.2, radius: 2.2, seed: 34 },
    { x: 26, z: -30, base: -9, top: -0.4, radius: 3.2, seed: 35 },
    { x: -19, z: 6, base: -9, top: -1.2, radius: 2.1, seed: 36 },
    { x: 20, z: 9, base: -9, top: -1.4, radius: 2.4, seed: 37 },
    { x: -12, z: 21, base: -9, top: -0.9, radius: 2.5, seed: 38 },
    { x: 9, z: 24, base: -9, top: -1.8, radius: 2.0, seed: 39 },
    { x: -34, z: -6, base: -9, top: 0.4, radius: 3.4, seed: 40 },
    { x: 34, z: -2, base: -9, top: 0.2, radius: 3.2, seed: 41 },
  ] satisfies Column[],
  spireStyle: {
    sides: 6,
    rings: 5,
    profile: (t) => 0.14 + 0.86 * Math.pow(1 - t, 0.9),
    jag: 0.18,
    lean: 0.1,
    cap: 'point',
    colors: { base: '#5a2418', top: '#1c1214', cap: '#1c1214' },
    heat: { base: 1.6, top: -1.8 },
    tile: 4,
  } satisfies ColumnStyle,
  /** Radii of the canyon walls on the horizon, beyond the farthest the camera can go. */
  canyon: [105, 150] as [near: number, far: number],
};

export const LOTUS_LAKE = {
  water: -1,
  /** The stone terraces under the board, from the top down: radius and height. */
  terraces: [
    [6.9, 0.4],
    [7.9, 0.5],
  ] as [radius: number, height: number][],
  /** Radii of the hills round the far shore, beyond the farthest the camera can go. */
  hills: [125, 170] as [near: number, far: number],
  /** Lotus round the platform, more of them where each player's view of the lake falls. */
  clusters: [
    { x: -9.5, z: -9, pads: 3, flower: true, seed: 51 },
    { x: 10.5, z: -11, pads: 2, flower: true, seed: 52 },
    { x: -4, z: -14.5, pads: 2, flower: false, seed: 53 },
    { x: 5.5, z: -17, pads: 3, flower: true, seed: 54 },
    { x: -14, z: -16, pads: 2, flower: true, seed: 55 },
    { x: -11, z: 1.5, pads: 2, flower: false, seed: 56 },
    { x: 11.5, z: -2, pads: 3, flower: true, seed: 57 },
    { x: -9, z: 9.5, pads: 3, flower: true, seed: 58 },
    { x: 8.5, z: 11, pads: 2, flower: true, seed: 59 },
    { x: 2.5, z: 14, pads: 2, flower: false, seed: 60 },
    { x: -4, z: 17, pads: 3, flower: true, seed: 61 },
    { x: 13, z: 6, pads: 2, flower: false, seed: 62 },
    { x: -18, z: -4, pads: 2, flower: true, seed: 63 },
    { x: 17, z: 15, pads: 3, flower: true, seed: 64 },
    // Along each player's line of sight, where a phone's narrow view of the lake falls.
    { x: -3, z: 11, pads: 2, flower: true, seed: 65 },
    { x: 1.5, z: -12.5, pads: 2, flower: true, seed: 66 },
    { x: -5.5, z: -22, pads: 3, flower: true, seed: 67 },
    { x: 3, z: -28, pads: 2, flower: false, seed: 68 },
    { x: 5, z: 22, pads: 2, flower: true, seed: 69 },
  ] satisfies LotusCluster[],
};
