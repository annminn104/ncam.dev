import { Matrix4, MeshStandardMaterial, ShaderLib, Vector4 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyKoi,
  KOI_EPS,
  KOI_FEED,
  KOI_MAX,
  KOI_STRIDE,
  KOI_SWAY,
  koiFedPosition,
  koiFeedTarget,
  koiFoodCentre,
  koiFoodOf,
  koiHeading,
  koiHunger,
  koiPosition,
  koiRefeed,
  patchKoiFragment,
  patchKoiVertex,
  readKoi,
  readKoiFeed,
  setKoiFood,
} from './koi';
import { globalUniforms } from './uniforms';

/** One fish as pond/swim.py packs it: centre, radii; tilt, z, angular speed, phase; eight, bob, 0, 0. */
const LOOP = [1, 2, 2, 1, 0, -0.3, (2 * Math.PI) / 10, 0, 0, 0, 0, 0];

describe('readKoi', () => {
  it('reads the loops the koi object carries, twelve floats a fish', () => {
    const loops = readKoi([...LOOP, 0, 0, 1, 1, Math.PI / 2, -0.4, -1, 1.5, 1, 0.02, 0, 0]);
    expect(loops).toHaveLength(2);
    expect(loops![0]).toEqual({
      centre: [1, 2],
      radii: [2, 1],
      tilt: 0,
      z: -0.3,
      omega: (2 * Math.PI) / 10,
      phase: 0,
      eight: 0,
      bob: 0,
    });
    expect(loops![1]).toMatchObject({ omega: -1, eight: 1, bob: 0.02 });
  });

  it('refuses what is not a list of whole fish, or more fish than the shader holds', () => {
    expect(readKoi(undefined)).toBeNull();
    expect(readKoi([1, 2, 3])).toBeNull();
    expect(readKoi(['a', ...LOOP.slice(1)])).toBeNull();
    expect(readKoi(Array.from({ length: (KOI_MAX + 1) * KOI_STRIDE }, () => 0.5))).toBeNull();
  });
});

describe('koiPosition and koiHeading', () => {
  const [loop] = readKoi(LOOP)!;

  it('loop a koi round its ellipse in its period, as pond/swim.py does', () => {
    expect(koiPosition(loop, 0)).toEqual([3, 2, -0.3]);
    const quarter = koiPosition(loop, 2.5);
    expect(quarter[0]).toBeCloseTo(1, 9);
    expect(quarter[1]).toBeCloseTo(3, 9);
    const eight = koiPosition({ ...loop, eight: 1 }, 2.5);
    expect([eight[0], eight[1]]).toEqual([expect.closeTo(1, 9), expect.closeTo(2, 9)]);
    const turned = koiPosition({ ...loop, tilt: Math.PI / 2 }, 0);
    expect([turned[0], turned[1]]).toEqual([expect.closeTo(1, 9), expect.closeTo(4, 9)]);
    expect(koiPosition({ ...loop, bob: 0.02 }, 1.25)[2]).toBeCloseTo(-0.28, 9);
  });

  it('turns a koi nose first: at (3, 2) going counter-clockwise its nose, local -Y, points to +Y', () => {
    expect(Math.abs(koiHeading(loop, 0))).toBeCloseTo(Math.PI, 3);
    expect(KOI_EPS).toBe(0.05);
  });
});

describe('patchKoiVertex', () => {
  it('moves each fish of the merged mesh along its loop and turns its normals with it', () => {
    const out = patchKoiVertex(ShaderLib.physical.vertexShader);
    expect(out).toContain('attribute vec2 koiFish;');
    expect(out).toContain(`uniform vec4 uKoiA[${KOI_MAX}];`);
    expect(out).toContain('uniform mat4 uKoiSpace;');
    // the loop of pond/swim.py: phase + speed * t round the turned ellipse, or the figure of eight
    expect(out).toContain('b.w + b.z * t');
    expect(out).toContain('mix(sin(s), sin(2.0 * s), c.x)');
    // the time wraps at each fish's own period, so the angles stay small however long the wallpaper runs
    expect(out).toMatch(/mod\(uTime, 6\.2831853 \/ abs\(/);
    expect(out).toMatch(/objectNormal = /);
    expect(out).toMatch(/transformed = \(uKoiSpaceInv \* /);
  });

  it('throws when the expected chunks are missing', () => {
    expect(() => patchKoiVertex('void main() {}')).toThrow(/begin_vertex/);
  });
});

describe('patchKoiFragment', () => {
  it('tints a fish towards the water the deeper it swims, darker at night', () => {
    const out = patchKoiFragment(ShaderLib.physical.fragmentShader);
    expect(out).toContain('varying float vKoiDepth;');
    expect(out).toMatch(
      /#include <opaque_fragment>\s*\n\s*.*gl_FragColor\.rgb = mix\(gl_FragColor\.rgb, uKoiTint \* mix\(1\.0, 0\.3, uNight\)/,
    );
    expect(() => patchKoiFragment('void main() {}')).toThrow(/opaque_fragment/);
  });
});

describe('applyKoi', () => {
  it('draws the fish after the water, with the loops, the module space and the shared clock as uniforms', () => {
    const material = new MeshStandardMaterial();
    const space = new Matrix4().makeScale(2, 2, 2).setPosition(1, 0, -1);
    applyKoi(material, readKoi([...LOOP, ...LOOP])!, space, -0.07);
    expect([material.transparent, material.depthWrite]).toEqual([true, true]);
    // glTF doubleSided would make three draw a transparent DoubleSide fish twice (back faces, then front faces)
    expect(material.forceSinglePass).toBe(true);
    expect(material.customProgramCacheKey()).toBe('koi');
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: ShaderLib.physical.fragmentShader,
      defines: {},
    };
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.uniforms.uTime).toBe(globalUniforms.uTime);
    expect(shader.uniforms.uNight).toBe(globalUniforms.uNight);
    const a = shader.uniforms.uKoiA.value as Vector4[];
    expect(a).toHaveLength(KOI_MAX);
    expect(a[0].toArray()).toEqual([1, 2, 2, 1]);
    expect((shader.uniforms.uKoiB.value as Vector4[])[1].toArray()).toEqual([
      0,
      -0.3,
      (2 * Math.PI) / 10,
      0,
    ]);
    expect(shader.uniforms.uKoiWater.value).toBe(-0.07);
    expect(
      (shader.uniforms.uKoiSpaceInv.value as Matrix4).clone().multiply(space).equals(new Matrix4()),
    ).toBe(true);
    expect(shader.vertexShader).toContain('koiPath');
    expect(shader.fragmentShader).toContain('uKoiTint');
  });
});

describe('patchKoiVertex: the tail', () => {
  it('sways on a clock of its own that wraps after whole strokes, so it never snaps when a loop comes round', () => {
    const out = patchKoiVertex(ShaderLib.physical.vertexShader);
    const stroke = ((2 * Math.PI) / KOI_SWAY.speed).toFixed(7);
    expect(out).toContain(`mod(uTime, ${stroke}) * ${KOI_SWAY.speed.toFixed(1)}`);
    expect(out).not.toMatch(/sin\(koiT \*/); // the loop's own wrapped time is a whole loop, not whole strokes
  });
});

describe('feeding the koi', () => {
  const loops = readKoi([...LOOP, ...LOOP.map((v, i) => (i === 7 ? Math.PI : v))])!;
  /** The feeding disc of a pond: the food lands in it wherever the click fell. */
  const DISC = { centre: [1, 2] as [number, number], radius: 1.5 };

  it('draws them to the food in a few seconds, keeps them there a while, then lets them swim their loops again', () => {
    expect(koiHunger(-1)).toBe(0);
    expect(koiHunger(0)).toBe(0);
    expect(koiHunger(KOI_FEED.gather)).toBe(1);
    expect(koiHunger((KOI_FEED.gather + KOI_FEED.stay) / 2)).toBe(1);
    expect(koiHunger(KOI_FEED.leave)).toBe(0);
    expect(koiHunger(KOI_FEED.gather / 2)).toBeGreaterThan(0);
  });

  it('gathers them in two rings round the food just under the surface, then back on their loops', () => {
    const feed = koiRefeed(null, [1, 2], 10);
    expect(feed).toEqual({ x: 1, y: 2, at: 10, from: [1, 2], start: 10 });
    for (const index of [0, 1]) {
      const [x, y, z] = koiFedPosition(loops[index], 15, 15, index, 2, feed, -0.07);
      expect(Math.hypot(x - 1, y - 2)).toBeCloseTo(KOI_FEED.rings[index % 2], 6);
      expect(z).toBeCloseTo(-0.07 - KOI_FEED.depths[index % 2], 6);
    }
    expect(koiFedPosition(loops[0], 40, 40, 0, 2, feed, -0.07)).toEqual(koiPosition(loops[0], 40)); // the food is gone
    expect(koiFedPosition(loops[0], 5, 5, 0, 2, null, -0.07)).toEqual(koiPosition(loops[0], 5)); // never fed
  });

  it('works out a fed koi as pond/swim.py fed_position does (the layout check samples it)', () => {
    expect(KOI_FEED).toEqual({
      gather: 3,
      stay: 9,
      leave: 13,
      glide: 1,
      rings: [0.45, 0.8],
      depths: [0.16, 0.25],
      spin: 0.4,
    });
    // the same loop, food and moment as SwimTest: the rings' middle 0.352 of the way from (0.5, 2) to (1.5, 2.5)
    const food = { x: 1.5, y: 2.5, at: 10, from: [0.5, 2] as [number, number], start: 9 };
    expect(koiFoodCentre(food, 10.4)).toEqual([expect.closeTo(0.852, 9), expect.closeTo(2.176, 9)]);
    const pinned = [
      [1.892413, 2.043563, -0.268495],
      [2.187618, 1.909465, -0.309001],
    ];
    for (const index of [0, 1]) {
      const got = koiFedPosition(loops[0], 10.4, 10.4, index, 2, food, -0.07);
      got.forEach((value, k) => expect(value).toBeCloseTo(pinned[index][k], 5));
    }
  });

  it("drops the food where the click fell, inside the pond's feeding disc", () => {
    expect(koiFeedTarget(DISC, [1.5, 2.5])).toEqual([1.5, 2.5]); // in the disc: where it fell
    const [x, y] = koiFeedTarget(DISC, [9, 2]); // far east: on the disc's east rim
    expect([x, y]).toEqual([expect.closeTo(2.5, 9), expect.closeTo(2, 9)]);
    for (let gx = -10; gx <= 10; gx += 0.5) {
      for (let gy = -10; gy <= 10; gy += 0.5) {
        const [fx, fy] = koiFeedTarget(DISC, [gx, gy]);
        expect(Math.hypot(fx - 1, fy - 2)).toBeLessThanOrEqual(DISC.radius + 1e-9);
      }
    }
  });

  it('reads the feeding disc the koi object carries, or none when it is not one', () => {
    expect(readKoiFeed([0.21, -0.31, 1.2])).toEqual({ centre: [0.21, -0.31], radius: 1.2 });
    expect(readKoiFeed(undefined)).toBeNull();
    expect(readKoiFeed([0, 0])).toBeNull();
    expect(readKoiFeed([0, 0, -1])).toBeNull();
  });

  describe('food thrown again while they are still fed', () => {
    const first = koiRefeed(null, [1, 2], 10);
    const again: [number, number] = [2.2, 1.3];
    // while they gather, circle the food, leave it, and once they are back on their loops
    for (const at of [11, 14, 20.5, 30]) {
      const second = koiRefeed(first, again, at);

      it(`keeps every koi where it was at ${at} s and only then draws it to the new food`, () => {
        expect(koiHunger(at - second.start)).toBeCloseTo(koiHunger(at - first.start), 9); // as far off its loop
        for (const index of [0, 1]) {
          const loop = loops[index];
          const before = koiFedPosition(loop, at - 1e-3, at - 1e-3, index, 2, first, -0.07);
          const after = koiFedPosition(loop, at + 1e-3, at + 1e-3, index, 2, second, -0.07);
          expect(Math.hypot(...after.map((v, k) => v - before[k]))).toBeLessThan(0.02);
          let last = after;
          for (let k = 1; k <= 45; k++) {
            // a second and a half, a frame at 30 fps
            const now = at + k / 30;
            const next = koiFedPosition(loop, now, now, index, 2, second, -0.07);
            expect(Math.hypot(...next.map((v, j) => v - last[j]))).toBeLessThan(0.15); // no jump: under 4.5 m/s
            last = next;
          }
          // a few seconds on it circles the new food
          const [x, y] = koiFedPosition(loop, at + 4, at + 4, index, 2, second, -0.07);
          expect(Math.hypot(x - again[0], y - again[1])).toBeCloseTo(KOI_FEED.rings[index % 2], 6);
        }
      });
    }
  });

  it('carries the food to the shader: where it fell and when, where the rings glide from and when the koi set off', () => {
    const out = patchKoiVertex(ShaderLib.physical.vertexShader);
    expect(out).toContain('uniform vec4 uKoiFeed;');
    expect(out).toContain('uniform vec4 uKoiFeedFrom;');
    expect(out).toContain('uniform float uKoiCount;');
    expect(out).toMatch(/vec3 koiAt\(int i, float t, float now\)/);
    expect(out).toContain('koiAt(koiI, koiT, uTime)');
    expect(out).toContain(`smoothstep(uKoiFeed.z, uKoiFeed.z + ${KOI_FEED.glide.toFixed(1)}, now)`);
    expect(out).toContain('float dt = now - uKoiFeedFrom.z;');
  });

  it('writes the food into the uniforms and reads it back from them', () => {
    const uniforms = applyKoi(new MeshStandardMaterial(), loops, new Matrix4(), -0.07);
    expect(koiFoodOf(uniforms)).toBeNull(); // unfed
    const food = { x: 1.5, y: 2.5, at: 10, from: [0.5, 2] as [number, number], start: 9 };
    setKoiFood(uniforms, food);
    expect(uniforms.uKoiFeed.value.toArray()).toEqual([1.5, 2.5, 10, 1]);
    expect(uniforms.uKoiFeedFrom.value.toArray()).toEqual([0.5, 2, 9, 0]);
    expect(koiFoodOf(uniforms)).toEqual(food);
  });
});
