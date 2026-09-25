# Holodex legacy shine ports — foundation and pilot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the effect DSL groups, an RGBA path and exact CSS gradients, draw three textures, and port secret-rare's and radiant-holo's shines from pokemon-cards-css, measured headless against poke-holo.simey.me.

**Architecture:** An element that uses a new feature (children, an exact `css-*` gradient, an alpha texture) compiles to an RGBA stack composited by CSS's own formula; every other element compiles exactly as before, which a pinned snapshot proves. Ports transcribe CSS through new `css.ts` converters. This plan ends at the pilot gate; the other twenty ports get a plan of their own once it passes.

**Tech Stack:** TypeScript, three.js `ShaderMaterial` (GLSL ES 3.00), Vitest (node, no DOM), Playwright 1.58 headless for comparisons.

**Spec:** `docs/superpowers/specs/2026-09-25-holodex-legacy-shine-ports-design.md`

## How it landed (2026-09-25)

Executed inline, task by task, each test-first and committed locally: aa3ad47 (pins), a2953af
(compositing, `color`), 34d5f62 (geometry), b8a56b1 (RGBA path, groups), 853a86b (converters),
00e0c04 (glow), f28ae76 (textures), 37891ff (secret-rare), eab6671 (filter), 89b6f91 (radiant).
What the plan did not foresee:

- **CSS filters are not what `applyFilter` does.** radiant-holo's first measurement missed the
  gate on chroma. Swatches under a CSS filter, read back off a headless Chrome screenshot, showed
  Chrome clamping after each of brightness, contrast and saturate, and saturating about CSS's own
  luma (0.213, 0.715, 0.072): that model matches Chrome to 0.33 in 0..255, where `applyFilter`
  (Rec. 601, clamped once) is 8 off on average and 55 at worst. The RGBA path now filters with
  `applyCssFilter` (eab6671); the RGB path keeps `applyFilter`, so the Scarlet & Violet ports and
  the ported glares, which were verified with it, are unchanged until their own sub-project.
- **The harness's probe card is `.card.water`**, so the reference drew radiant's --card-glow blue
  while ours drew the card's Grass green. `cmp/shine/ref.mjs` now sets the probe's type class to the
  sample's.
- **Playwright 1.58 left the pnpm store** mid-session (only 1.63 remains; its Chromium is not
  cached). The scratch harness drives 1.63 with the cached Chromium 1208 headless shell.
- A GLSL compile check (every effect's shader compiled and linked on a headless WebGL2 context,
  through the dev server's own modules) caught nothing, and now runs after every shader change.

**The gate passed.** With the reference fed our textures, at (0.3, 0.3) and (0.7, 0.7):
secret-rare luminance 3.0 / 3.4 and chroma 2.3 / 4.1, radiant-holo 1.7 / 2.6 and 1.7 / 1.6, where
the no-effect floor is 3.7 / 3.4 and 2.9 / 4.8, and 2.1 / 4.0 and 3.3 / 2.3. With the reference's
own images the gaps barely move. Before: 33 and 27–29 for secret-rare, 21–22 and 14–20 for radiant.
Tree: 851 tests, lint, typecheck, Prettier, split 2 / 1, lazy chunk 145.39 KB gz; GPU smoke on
both card pages and both effects sections, with a lose/restore on each.

## Global Constraints

- Never `git push`; commit locally only. Stage by explicit path (never `git add -A`; never stage `.claude/launch.json`). Commit with `git commit -F <file>`, body lines under 100 characters, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never touch the owner's servers (ports 1337, 9000–9007, 9106). The smoke server `holodex-smoke` on 9107 is ours.
- Pace scripted TCGdex requests; a burst of browser CORS errors is throttling, not a regression.
- Copy no image from pokemon-cards-css or pokemon-cards-151 into the repo. Textures are drawn procedurally from `mulberry32` or pure geometry.
- Every element that uses no new feature compiles byte-for-byte as before: the eight Scarlet & Violet ports' and basic's `main()`, and the 21 other legacy effects' ported glare blocks (Task 1 pins them).
- Blend ids are appended, never renumbered. `MAX_STOPS` stays 8 for the older kinds.
- Lazy chunk under 170 KB gz; the three.js split check gives 2 / 1.
- Run commands from `apps/holodex` unless a step says otherwise: `pnpm vitest run <path>`, `pnpm typecheck`, `pnpm lint`, `npx prettier --check <paths>`.

---

### Task 1: Pin the code the ports must not change

**Files:**

- Create: `apps/holodex/src/holo/effects/unchanged.test.ts`

**Interfaces:**

- Produces: an inline snapshot of SHA-256 prefixes, one per pinned block. Later tasks must keep it green without `-u`.

- [ ] **Step 1: Write the test**

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compileEffect } from '../shader/compile';
import { EFFECTS } from './index';
import type { EffectId } from '../select';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Everything the effect draws: main() and all it calls into the per-effect code. */
const mainOf = (src: string) => src.slice(src.indexOf('void main()'));

/** The ported glare painted beneath the shine, up to where the shine begins. */
function beneathOf(src: string): string {
  const from = src.indexOf('  // --- beneath0');
  const to = src.indexOf('  vec3 base = acc;');
  if (from < 0 || to < from) throw new Error('no glare beneath the shine');
  return src.slice(from, to);
}

/** The eight Scarlet & Violet ports, and basic, which the shine ports leave whole. */
const WHOLE: EffectId[] = [
  'basic',
  'ex-regular',
  'ex-full-art',
  'illustration-rare',
  'ex-special-illustration-rare',
  'hyper-rare',
  'poke-ball-holo',
  'masterball-holo',
  'sv-rare-holo',
];

/** The other 21 older effects, whose shines are re-ported but whose glares stay as ported. */
const GLARE_ONLY = (Object.keys(EFFECTS) as EffectId[]).filter(
  (id) => !WHOLE.includes(id) && EFFECTS[id].beneath?.length,
);

describe('code the shine ports must not change', () => {
  it('has 21 older effects whose glare it pins', () => {
    expect(GLARE_ONLY).toHaveLength(21);
  });

  it('compiles every pinned block as it did', () => {
    const pins = Object.fromEntries([
      ...WHOLE.map((id) => [`${id} main()`, sha(mainOf(compileEffect(EFFECTS[id])))]),
      ...GLARE_ONLY.map((id) => [`${id} glare`, sha(beneathOf(compileEffect(EFFECTS[id])))]),
    ]);
    expect(pins).toMatchInlineSnapshot();
  });
});
```

- [ ] **Step 2: Run it once to record the snapshot**

Run: `pnpm vitest run src/holo/effects/unchanged.test.ts`
Expected: PASS, and Vitest writes the object literal into `toMatchInlineSnapshot(...)` (30 keys). If Vitest reports "obsolete" or refuses to write (a `CI` variable in the shell), rerun with `CI= pnpm vitest run src/holo/effects/unchanged.test.ts -u`. Open the file and confirm 9 `main()` keys and 21 `glare` keys.

- [ ] **Step 3: Prove it bites**

Temporarily change one number in `effects/ex-regular.ts` (e.g. its `SHINE_FILTER` brightness `0.45` → `0.46`), run the test, expect FAIL naming `ex-regular main()`, then `git checkout -- src/holo/effects/ex-regular.ts`.

- [ ] **Step 4: Commit**

```bash
git add -- apps/holodex/src/holo/effects/unchanged.test.ts
git commit -F <msg>   # "test(holodex): pin the code the shine ports must leave alone"
```

---

### Task 2: CSS compositing, and the `color` blend

**Files:**

- Modify: `apps/holodex/src/holo/shader/blend.ts`
- Test: `apps/holodex/src/holo/shader/blend.test.ts`

**Interfaces:**

- Produces: `BlendMode` gains `'color'` (`BLEND_ID.color = 16`); `export type RGBA = readonly [number, number, number, number]`; `export function compositeRGBA(mode: BlendMode, backdrop: RGBA, source: RGBA): [number, number, number, number]`; GLSL `float compositeAlpha(float bA, float sA)`, `float compositeChannel(float cb, float bA, float cs, float sA, float blended)`, `vec4 compositeOver(vec4 b, vec4 s, int mode)`, `vec3 blendColor(vec3 b, vec3 s)`.

- [ ] **Step 1: Write the failing tests** (append to `blend.test.ts`; it already imports `blendRGB`, `BLEND_ID`, `blendGLSL`)

```ts
import { compositeRGBA, type RGBA } from './blend';

describe('the color blend', () => {
  it('puts the source’s hue and saturation at the backdrop’s luminosity', () => {
    // SetLum(red, 0.5): red + 0.2 = (1.2, 0.2, 0.2), clipped about l = 0.5
    const out = blendRGB('color', [0.5, 0.5, 0.5], [1, 0, 0]);
    expect(out[0]).toBeCloseTo(1, 5);
    expect(out[1]).toBeCloseTo(0.2857143, 5);
    expect(out[2]).toBeCloseTo(0.2857143, 5);
  });

  it('is appended, so no older blend changes its id', () => {
    expect(BLEND_ID.color).toBe(16);
    expect(blendGLSL).toContain(`case ${BLEND_ID.color}: return blendColor(b, s);`);
  });
});

describe('compositeRGBA, CSS’s compositing', () => {
  const close = (got: number[], want: number[]) =>
    want.forEach((v, i) => expect(got[i], `channel ${i}`).toBeCloseTo(v, 6));

  it('blends an opaque source onto an opaque backdrop', () => {
    close(compositeRGBA('multiply', [0.8, 0.4, 0.2, 1], [0.5, 0.5, 0.5, 1]), [0.4, 0.2, 0.1, 1]);
  });

  it('draws an opaque source as itself over nothing, whatever the blend', () => {
    close(compositeRGBA('difference', [0.3, 0.6, 0.9, 0], [0.2, 0.4, 0.6, 1]), [0.2, 0.4, 0.6, 1]);
  });

  it('leaves the backdrop alone under a transparent source', () => {
    close(compositeRGBA('screen', [0.3, 0.6, 0.9, 0.7], [1, 1, 1, 0]), [0.3, 0.6, 0.9, 0.7]);
  });

  it('mixes half a source over half a backdrop by who covers what', () => {
    // a = 0.75; (0.5·0.5·1 + 0.5·0.5·1 + 0.5·0.5·0) / 0.75
    close(compositeRGBA('normal', [0, 0, 0, 0.5], [1, 1, 1, 0.5]), [2 / 3, 2 / 3, 2 / 3, 0.75]);
  });

  it('is mix(backdrop, blend, alpha) over an opaque backdrop', () => {
    // screen(0.2, 0.6) = 0.68; halfway from 0.2
    close(compositeRGBA('screen', [0.2, 0.2, 0.2, 1], [0.6, 0.6, 0.6, 0.5]), [0.44, 0.44, 0.44, 1]);
  });
});

/** compositeAlpha and compositeChannel, translated from the GLSL itself. */
function transpileComposite() {
  const alpha = /float compositeAlpha\(float bA, float sA\) \{\n([\s\S]*?)\n\}/.exec(
    blendGLSL,
  )?.[1];
  const channel =
    /float compositeChannel\(float cb, float bA, float cs, float sA, float blended\) \{\n([\s\S]*?)\n\}/.exec(
      blendGLSL,
    )?.[1];
  if (!alpha || !channel) throw new Error('the compositing functions changed shape');
  const js = (body: string) => body.replace(/^\s*\/\/.*$/gm, '').replace(/\bfloat /g, 'let ');
  expect(js(channel)).not.toMatch(/\b(?:vec[234]|uniform)\b/);
  const compositeAlpha = new Function('bA', 'sA', js(alpha)) as (b: number, s: number) => number;
  const compositeChannel = new Function(
    'cb',
    'bA',
    'cs',
    'sA',
    'blended',
    'compositeAlpha',
    js(channel),
  ) as (...args: [number, number, number, number, number, typeof compositeAlpha]) => number;
  return {
    compositeAlpha,
    channel: (...a: [number, number, number, number, number]) =>
      compositeChannel(...a, compositeAlpha),
  };
}

describe('compositeOver in GLSL agrees with compositeRGBA', () => {
  const glsl = transpileComposite();
  const modes: BlendMode[] = [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'color-dodge',
    'soft-light',
    'difference',
  ];
  const alphas = [0, 0.25, 0.5, 1];
  it('channel by channel, over a grid of alphas and blends', () => {
    for (const mode of modes)
      for (const bA of alphas)
        for (const sA of alphas) {
          const backdrop: RGBA = [0.2, 0.55, 0.9, bA];
          const source: RGBA = [0.7, 0.35, 0.1, sA];
          const blended = blendRGB(mode, backdrop.slice(0, 3), source.slice(0, 3));
          const want = compositeRGBA(mode, backdrop, source);
          for (let i = 0; i < 3; i += 1) {
            expect(
              glsl.channel(backdrop[i], bA, source[i], sA, blended[i]),
              `${mode} ${bA} ${sA}`,
            ).toBeCloseTo(want[i], 6);
          }
          expect(glsl.compositeAlpha(bA, sA)).toBeCloseTo(want[3], 6);
        }
  });

  it('builds the vec4 from those two, channel by channel', () => {
    expect(blendGLSL).toMatch(
      /vec4 compositeOver\(vec4 b, vec4 s, int mode\) \{\n\s+vec3 blended = blendWith\(mode, b\.rgb, s\.rgb\);\n\s+return vec4\(\n\s+compositeChannel\(b\.r, b\.a, s\.r, s\.a, blended\.r\),\n\s+compositeChannel\(b\.g, b\.a, s\.g, s\.a, blended\.g\),\n\s+compositeChannel\(b\.b, b\.a, s\.b, s\.a, blended\.b\),\n\s+compositeAlpha\(b\.a, s\.a\)\n\s+\);\n\}/,
    );
  });
});
```

(Import `type BlendMode` from `./blend` at the top if the file does not already.)

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/holo/shader/blend.test.ts`
Expected: FAIL — `compositeRGBA` is not exported; `'color'` is not a `BlendMode`.

- [ ] **Step 3: Implement** (in `blend.ts`)

Add `| 'color'` to `BlendMode`, `color: 16,` at the end of `BLEND_ID`, and in `blendRGB`:

```ts
    case 'color':
      return setLum(source, lum(backdrop)).map(clamp01) as Out;
```

After `blendRGB`:

```ts
export type RGBA = readonly [number, number, number, number];

/**
 * CSS compositing, W3C Compositing and Blending Level 1: `source` over
 * `backdrop`, both straight (unpremultiplied) colour, the blend applied only
 * where both are present. The RGBA path (shader/compile.ts) composites every
 * layer onto the layers beneath it, every child onto its group and every group
 * onto the card with this; compositeOver below is its GLSL.
 */
export function compositeRGBA(
  mode: BlendMode,
  backdrop: RGBA,
  source: RGBA,
): [number, number, number, number] {
  const [bA, sA] = [backdrop[3], source[3]];
  const blended = blendRGB(mode, backdrop.slice(0, 3), source.slice(0, 3));
  const a = sA + bA * (1 - sA);
  const channel = (i: number) =>
    a > 0
      ? (sA * (1 - bA) * source[i] + sA * bA * blended[i] + (1 - sA) * bA * backdrop[i]) / a
      : 0;
  return [channel(0), channel(1), channel(2), a];
}
```

In `blendGLSL`, after `blendColorBurn`:

```glsl
vec3 blendColor(vec3 b, vec3 s) { return bSetLum(s, bLum(b)); }
```

and in `blendWith`, before `case ${BLEND_ID.normal}`:

```glsl
    case ${BLEND_ID.color}: return blendColor(b, s);
```

After `blendWith` (it must follow it, since it calls it):

```glsl
// CSS compositing (compositeRGBA's twin), straight colour: the source's alpha
// over the backdrop's, and each channel a mix of the source, the blend of the
// two and the backdrop, weighted by which of them covers the fragment.
float compositeAlpha(float bA, float sA) {
  return sA + bA * (1.0 - sA);
}

float compositeChannel(float cb, float bA, float cs, float sA, float blended) {
  float a = compositeAlpha(bA, sA);
  return a > 0.0 ? (sA * (1.0 - bA) * cs + sA * bA * blended + (1.0 - sA) * bA * cb) / a : 0.0;
}

vec4 compositeOver(vec4 b, vec4 s, int mode) {
  vec3 blended = blendWith(mode, b.rgb, s.rgb);
  return vec4(
    compositeChannel(b.r, b.a, s.r, s.a, blended.r),
    compositeChannel(b.g, b.a, s.g, s.a, blended.g),
    compositeChannel(b.b, b.a, s.b, s.a, blended.b),
    compositeAlpha(b.a, s.a)
  );
}
```

Update the file's header comment: CSS's sixteen blends are all here now, and compositing too.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/holo/shader/blend.test.ts src/holo/effects/unchanged.test.ts`
Expected: PASS (the pins do not move: blends are appended).

- [ ] **Step 5: Commit** — `feat(holodex): composite as CSS does, and blend with color`

---

### Task 3: Exact-gradient geometry in GLSL, with its twins

**Files:**

- Modify: `apps/holodex/src/holo/shader/sources.ts`, `apps/holodex/src/holo/effects/css.ts`
- Test: `apps/holodex/src/holo/shader/compile.test.ts` (its GLSL-translation section), `apps/holodex/src/holo/effects/css.test.ts`

**Interfaces:**

- Produces (GLSL, in `sourcesGLSL`): `#define MAX_CSS_STOPS 32`; `uniform vec3 uCardGlow;`; `float radialReach(vec2 uv, vec2 centre, vec2 size, vec2 at, float ellipse)` (unclamped); `radialCssDistance(uv, centre, size)` = `clamp(radialReach(uv, centre, size, uPointerUV, 0.0), 0.0, 1.0)`; `float conicTurn(vec2 uv, vec2 centre, float from)`; `float cssStopIndex(float pos[MAX_CSS_STOPS], int count, float t)`; `vec4 cssStops(vec4 stops[MAX_CSS_STOPS], float pos[MAX_CSS_STOPS], int count, float t)`.
- Produces (TS, in `css.ts`): `export const MAX_CSS_STOPS = 32`; `export function reach(centre: [number, number], size: [number, number], at: [number, number], ellipse: boolean, uv: [number, number]): number`; `export function turn(centre: [number, number], from: number, uv: [number, number]): number`; `export function cssStopIndex(pos: readonly number[], t: number): number`.

- [ ] **Step 1: Write the failing tests**

In `css.test.ts`:

```ts
import { cssStopIndex, reach, turn, CARD_ASPECT } from './css';

describe('reach, a CSS radial’s distance in radii', () => {
  it('is 1 at the farthest corner for a circle at the centre', () => {
    expect(reach([0.5, 0.5], [1, 1], [0.5, 0.5], false, [1, 1])).toBeCloseTo(1, 9);
  });
  it('keeps going past the ending shape, unclamped', () => {
    expect(reach([0, 0], [1, 1], [0, 0], false, [1, 1])).toBeCloseTo(1, 9);
    expect(reach([0.5, 0.5], [0.5, 0.5], [0.5, 0.5], false, [1, 1])).toBeCloseTo(2, 9);
  });
  it('makes an ellipse farthest-side’s shape, √2 larger, through the corner', () => {
    // centre (0.5, 0.5) of a cover box: farthest sides 0.5 wide, 0.5 tall;
    // the mid-right edge is 0.5 / (0.5·√2) out, the corner exactly 1
    expect(reach([0.5, 0.5], [1, 1], [0.5, 0.5], true, [1, 0.5])).toBeCloseTo(Math.SQRT1_2, 9);
    expect(reach([0.5, 0.5], [1, 1], [0.5, 0.5], true, [1, 1])).toBeCloseTo(1, 9);
  });
  it('measures the farthest corner from `at`, not the pointer', () => {
    // a 3.5-wide box centred on the card, its centre at 25% of it: farthest side 0.75·3.5
    const r = reach([0.5, 0.5], [3.5, 3.5], [0.25, 0.25], true, [
      0.5 + 0.75 * 3.5 * Math.SQRT2,
      0.5,
    ]);
    expect(r).toBeCloseTo(1, 9);
  });
});

describe('turn, where a point falls around a CSS conic', () => {
  it('starts at the top and runs clockwise', () => {
    expect(turn([0.5, 0.5], 0, [0.5, 0])).toBeCloseTo(0, 9);
    expect(turn([0.5, 0.5], 0, [1, 0.5])).toBeCloseTo(0.25, 9);
    expect(turn([0.5, 0.5], 0, [0.5, 1])).toBeCloseTo(0.5, 9);
    expect(turn([0.5, 0.5], 0, [0, 0.5])).toBeCloseTo(0.75, 9);
  });
  it('measures angles in the card’s true proportions', () => {
    // the card's corner is not at 45°: atan(63 / 88) from the vertical
    expect(turn([0.5, 0.5], 0, [1, 0])).toBeCloseTo(Math.atan2(CARD_ASPECT, 1) / (2 * Math.PI), 9);
  });
  it('starts from `from`', () => {
    expect(turn([0.5, 0.5], 0.25, [1, 0.5])).toBeCloseTo(0, 9);
  });
});

describe('cssStopIndex, CSS’s stop lookup', () => {
  const pos = [0.1, 0.3, 0.3, 0.9];
  it('holds the first stop before it and the last after it', () => {
    expect(cssStopIndex(pos, 0)).toBe(0);
    expect(cssStopIndex(pos, 0.1)).toBe(0);
    expect(cssStopIndex(pos, 1)).toBe(3);
  });
  it('runs linearly between two stops', () => {
    expect(cssStopIndex(pos, 0.2)).toBeCloseTo(0.5, 9);
    expect(cssStopIndex(pos, 0.6)).toBeCloseTo(2.5, 9);
  });
  it('passes a hard edge at once: its near colour on it, its far one just past', () => {
    expect(cssStopIndex(pos, 0.3)).toBe(1);
    expect(cssStopIndex(pos, 0.3000001)).toBeCloseTo(2, 5);
  });
});
```

In `compile.test.ts`, next to `transpileRadialCss`:

```ts
import { cssStopIndex, reach, turn, MAX_CSS_STOPS } from '../effects/css';

/** A scalar GLSL function from sourcesGLSL, as JS, with the built-ins it may call. */
function transpileSource(signature: RegExp, params: string[]) {
  const body = signature.exec(sourcesGLSL)?.[1];
  const aspect = /const float CARD_HEIGHT_OVER_WIDTH = ([^;]+);/.exec(sourcesGLSL)?.[1];
  if (!body || !aspect)
    throw new Error(`${signature} no longer has the shape this translation assumes`);
  const js = body
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\bfloat\(/g, '(')
    .replace(/\b(?:float|int) /g, 'let ')
    .replace(/MAX_CSS_STOPS/g, String(MAX_CSS_STOPS))
    .replace(/CARD_HEIGHT_OVER_WIDTH/g, String(Number(aspect)));
  expect(js).not.toMatch(/\bu[A-Z]\w*/);
  expect(js).not.toMatch(/\b(?:float|vec[234]|uniform)\b/);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const fract = (v: number) => v - Math.floor(v);
  const atan = (y: number, x: number) => Math.atan2(y, x);
  return new Function(...params, 'min', 'max', 'sqrt', 'clamp', 'mix', 'fract', 'atan', js) as (
    ...args: unknown[]
  ) => number;
}
const V = (x: number, y: number) => ({ x, y });
const builtins = [
  Math.min,
  Math.max,
  Math.sqrt,
  (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
  (a: number, b: number, t: number) => a * (1 - t) + b * t,
  (v: number) => v - Math.floor(v),
  (y: number, x: number) => Math.atan2(y, x),
];

describe('the exact gradients’ geometry in GLSL agrees with css.ts', () => {
  const glslReach = transpileSource(
    /float radialReach\(vec2 uv, vec2 centre, vec2 size, vec2 at, float ellipse\) \{\n([\s\S]*?)\n\}/,
    ['uv', 'centre', 'size', 'at', 'ellipse'],
  );
  const glslTurn = transpileSource(
    /float conicTurn\(vec2 uv, vec2 centre, float from\) \{\n([\s\S]*?)\n\}/,
    ['uv', 'centre', 'from'],
  );
  const glslIndex = transpileSource(
    /float cssStopIndex\(float pos\[MAX_CSS_STOPS\], int count, float t\) \{\n([\s\S]*?)\n\}/,
    ['pos', 'count', 't'],
  );

  it('radialReach, circles and ellipses, wherever their centre sits', () => {
    for (const ellipse of [false, true])
      for (const at of [
        [0.5, 0.5],
        [0.2, 0.7],
        [0.9, 0.1],
      ] as [number, number][])
        for (const uv of [
          [0, 0],
          [0.3, 0.8],
          [1, 0.4],
        ] as [number, number][]) {
          const want = reach([0.4, 0.6], [1.5, 2], at, ellipse, uv);
          const got = glslReach(
            V(...uv),
            V(0.4, 0.6),
            V(1.5, 2),
            V(...at),
            ellipse ? 1 : 0,
            ...builtins,
          );
          expect(got).toBeCloseTo(want, 6);
        }
  });

  it('conicTurn, all the way round', () => {
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * 2 * Math.PI;
      const uv: [number, number] = [0.5 + 0.3 * Math.sin(a), 0.5 - 0.3 * Math.cos(a)];
      expect(glslTurn(V(...uv), V(0.5, 0.5), 0.1, ...builtins)).toBeCloseTo(
        turn([0.5, 0.5], 0.1, uv),
        6,
      );
    }
  });

  it('cssStopIndex, hard edges and all', () => {
    const pos = [0, 0.012, 0.0121, 0.024, 0.024, 0.5, 1];
    const padded = [...pos, ...Array(MAX_CSS_STOPS - pos.length).fill(1)];
    for (const t of [-1, 0, 0.006, 0.012, 0.01205, 0.02, 0.024, 0.3, 0.99, 1, 2]) {
      expect(glslIndex(padded, pos.length, t, ...builtins)).toBeCloseTo(cssStopIndex(pos, t), 6);
    }
  });

  it('keeps the older radials’ reach: radialReach at the pointer, as a circle, clamped', () => {
    expect(sourcesGLSL).toContain(
      'return clamp(radialReach(uv, centre, size, uPointerUV, 0.0), 0.0, 1.0);',
    );
  });
});
```

Replace the existing `transpileRadialCss` test's extraction (it reads `radialCssDistance`'s body, which now delegates) with one that composes: translate `radialReach` as above and check `radialCssDistance`'s body is exactly the delegating line; keep its comparisons against `radialT` by evaluating `Math.min(1, Math.max(0, glslReach(uv, centre, size, pointer, 0)))`.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/holo/effects/css.test.ts src/holo/shader/compile.test.ts`
Expected: FAIL — `reach`, `turn`, `cssStopIndex`, `MAX_CSS_STOPS` not exported; the GLSL signatures absent.

- [ ] **Step 3: Implement the TS twins** (in `css.ts`, a new section after `radialT`)

```ts
// ------------------------------------------------------- exact gradients

/** How many stops an exact gradient holds (sources.ts's MAX_CSS_STOPS). */
export const MAX_CSS_STOPS = 32;

/**
 * sources.ts's radialReach: how far out along a CSS radial a point of the card
 * lies, in radii, unclamped. `centre` on the card, `size` its image's, `at`
 * the centre's fraction of that image, which CSS measures the farthest corner
 * from. A circle reaches that corner; an ellipse keeps farthest-side's aspect
 * and grows by √2 to pass through it. Lengths in card widths.
 */
export function reach(
  centre: [number, number],
  size: [number, number],
  at: [number, number],
  ellipse: boolean,
  uv: [number, number],
): number {
  const sideX = size[0] * Math.max(at[0], 1 - at[0]);
  const sideY = size[1] * Math.max(at[1], 1 - at[1]) * CARD_HEIGHT_OVER_WIDTH;
  const dx = uv[0] - centre[0];
  const dy = (uv[1] - centre[1]) * CARD_HEIGHT_OVER_WIDTH;
  return ellipse
    ? Math.hypot(dx / sideX, dy / sideY) / Math.SQRT2
    : Math.hypot(dx, dy) / Math.hypot(sideX, sideY);
}

/**
 * sources.ts's conicTurn: where a point falls around a CSS conic, in turns
 * clockwise from `from` (itself in turns from the top), measured in the
 * card's true proportions as CSS measures a conic's angle.
 */
export function turn(centre: [number, number], from: number, uv: [number, number]): number {
  const dx = uv[0] - centre[0];
  const dy = (uv[1] - centre[1]) * CARD_HEIGHT_OVER_WIDTH;
  const t = Math.atan2(dx, -dy) / (2 * Math.PI) - from;
  return t - Math.floor(t);
}

/**
 * sources.ts's cssStopIndex: t's place among stops at these positions, in
 * stop indices — 0 at or before the first, the last index at or after the
 * last, fractional between two, and past a hard edge (two stops at one place)
 * at once. CSS's own lookup.
 */
export function cssStopIndex(pos: readonly number[], t: number): number {
  let index = 0;
  for (let i = 1; i < pos.length; i += 1) {
    if (t <= pos[i - 1]) break;
    const span = pos[i] - pos[i - 1];
    index = t >= pos[i] ? i : i - 1 + (t - pos[i - 1]) / span;
  }
  return index;
}
```

- [ ] **Step 4: Implement the GLSL** (in `sourcesGLSL`, after `#define MAX_STOPS 8` and after `radialCssDistance`'s doc)

Add under the defines: `#define MAX_CSS_STOPS 32` and, with the uniforms, `uniform vec3 uCardGlow;`.

Replace `radialCssDistance` with:

```glsl
/**
 * How far out along a CSS radial-gradient a fragment is, in radii, unclamped:
 * CSS carries a stop past 100% beyond the ending shape. \`centre\` is on the
 * card, \`size\` its image's, \`at\` the centre's fraction of that image, which
 * CSS measures the farthest corner from, all as fractions of the card. A
 * circle reaches the farthest corner; an ellipse (\`ellipse\` 1) keeps
 * farthest-side's aspect and grows by √2 to pass through it. Lengths are in
 * card widths, so the circle is round on the card. css.ts#reach is the twin.
 */
float radialReach(vec2 uv, vec2 centre, vec2 size, vec2 at, float ellipse) {
  float sideX = size.x * max(at.x, 1.0 - at.x);
  float sideY = size.y * max(at.y, 1.0 - at.y) * CARD_HEIGHT_OVER_WIDTH;
  float dx = uv.x - centre.x;
  float dy = (uv.y - centre.y) * CARD_HEIGHT_OVER_WIDTH;
  float circle = sqrt(dx * dx + dy * dy) / sqrt(sideX * sideX + sideY * sideY);
  float oval = sqrt((dx / sideX) * (dx / sideX) + (dy / sideY) * (dy / sideY)) / 1.4142136;
  return mix(circle, oval, ellipse);
}

/**
 * How far along a CSS radial-gradient(farthest-corner circle at the pointer) a
 * fragment is, 0 at the centre and 1 at the radius: the radial css.ts
 * converts for the older kinds (Source's cssBox), whose centre is the
 * pointer's fraction of its image.
 */
float radialCssDistance(vec2 uv, vec2 centre, vec2 size) {
  return clamp(radialReach(uv, centre, size, uPointerUV, 0.0), 0.0, 1.0);
}
```

After `srcConic`:

```glsl
/**
 * Where a fragment falls around a CSS conic-gradient, in turns clockwise from
 * \`from\` (itself in turns from the top), about \`centre\`, measured in the
 * card's true proportions as CSS measures a conic's angle. css.ts#turn is the
 * twin.
 */
float conicTurn(vec2 uv, vec2 centre, float from) {
  float dx = uv.x - centre.x;
  float dy = (uv.y - centre.y) * CARD_HEIGHT_OVER_WIDTH;
  return fract(atan(dx, -dy) / 6.2831853 - from);
}

/**
 * t's place among an exact gradient's stops, in stop indices: 0 at or before
 * the first, count - 1 at or after the last, fractional between two, and past
 * a hard edge (two stops at one place) at once. css.ts#cssStopIndex is the
 * twin.
 */
float cssStopIndex(float pos[MAX_CSS_STOPS], int count, float t) {
  float index = 0.0;
  for (int i = 1; i < MAX_CSS_STOPS; i += 1) {
    if (i >= count || t <= pos[i - 1]) break;
    float span = pos[i] - pos[i - 1];
    index = t >= pos[i] ? float(i) : float(i - 1) + (t - pos[i - 1]) / span;
  }
  return index;
}

/**
 * An exact gradient's colour at t: its stops premultiplied (as CSS
 * interpolates them), looked up where CSS puts them, and handed back as
 * straight colour and alpha.
 */
vec4 cssStops(vec4 stops[MAX_CSS_STOPS], float pos[MAX_CSS_STOPS], int count, float t) {
  float index = cssStopIndex(pos, count, t);
  int i = int(floor(index));
  int j = min(i + 1, count - 1);
  vec4 c = mix(stops[i], stops[j], index - float(i));
  return vec4(c.a > 0.0 ? c.rgb / c.a : vec3(0.0), c.a);
}
```

(Inside the template string, keep backticks in comments escaped as the file already does, or avoid them.)

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/holo/effects/css.test.ts src/holo/shader/compile.test.ts src/holo/effects/unchanged.test.ts`
Expected: PASS; the pins hold (only the preamble changed).

- [ ] **Step 6: Commit** — `feat(holodex): add exact CSS gradient geometry to the shader`

---

### Task 4: The RGBA path — exact gradients and groups in the compiler

**Files:**

- Modify: `apps/holodex/src/holo/shader/types.ts`, `apps/holodex/src/holo/shader/sources.ts` (`SOURCE_ID`), `apps/holodex/src/holo/shader/compile.ts`
- Test: `apps/holodex/src/holo/shader/compile.test.ts`, `apps/holodex/src/holo/effects/index.test.ts`, `apps/holodex/src/holo/shader/sources.test.ts`

**Interfaces:**

- Consumes: Task 2's `compositeOver`, Task 3's `radialReach`, `conicTurn`, `cssStops`, `uCardGlow`.
- Produces (types.ts):

```ts
/** A stop where CSS puts it, for the exact gradients (the css-* sources). */
export interface GradientStop {
  /** along the gradient: gradient lengths (css-linear), radii (css-radial) or turns (css-conic) */
  at: number;
  color: [number, number, number];
  /** 0..1; left out, 1 */
  alpha?: number;
  /** how much of the colour is the card's glow instead (uCardGlow), 0..1; left out, 0 */
  glow?: number;
}
```

and three `Source` kinds — `{ kind: 'css-linear'; repeating: boolean; line: { a: number; b: number; c: PointerDriven }; stops: GradientStop[] }`, `{ kind: 'css-radial'; centre: [PointerDriven, PointerDriven]; size: [number, number]; at: [PointerDriven, PointerDriven]; ellipse: boolean; stops: GradientStop[] }`, `{ kind: 'css-conic'; centre: [number, number]; from: number; stops: GradientStop[] }` — and `Element.children?: Element[]`.

- Produces (compile.ts): `export function needsRGBA(element: Element): boolean`; `export const ALPHA_TEXTURES: ReadonlySet<Source['kind']>` (empty for now).

- [ ] **Step 1: Write the failing tests** (compile.test.ts)

```ts
import { needsRGBA } from './compile';
import type { Element, GradientStop } from './types';

const stops2: GradientStop[] = [
  { at: 0.1, color: [0, 0, 0], alpha: 0.98 },
  { at: 0.9, color: [0.95, 0.95, 0.95], alpha: 0.15 },
];
const exactRadialLayer = {
  source: {
    kind: 'css-radial' as const,
    centre: [
      { base: 0, fromLeft: 1 },
      { base: 0, fromTop: 1 },
    ] as [PointerDriven, PointerDriven],
    size: [1, 1] as [number, number],
    at: [
      { base: 0, fromLeft: 1 },
      { base: 0, fromTop: 1 },
    ] as [PointerDriven, PointerDriven],
    ellipse: false,
    stops: stops2,
  },
  blend: 'normal' as const,
};
const solid = (c: number): Layer => ({
  source: { kind: 'solid', color: [c, c, c] },
  blend: 'normal',
});

describe('the RGBA path', () => {
  it('is taken by an element with children or an exact gradient, and by nothing else', () => {
    expect(needsRGBA({ layers: [solid(0.5)], mixBlend: 'screen' })).toBe(false);
    expect(needsRGBA({ layers: [exactRadialLayer], mixBlend: 'screen' })).toBe(true);
    expect(
      needsRGBA({
        layers: [solid(0.5)],
        mixBlend: 'screen',
        children: [{ layers: [solid(1)], mixBlend: 'overlay' }],
      }),
    ).toBe(true);
  });

  const group: Element = {
    layers: [exactRadialLayer, { ...solid(0.3), blend: 'overlay' }],
    children: [
      {
        layers: [solid(0.6)],
        filter: { brightness: { base: 1.25 } },
        mixBlend: 'lighten',
        opacity: { base: 0.8 },
      },
      { layers: [solid(0.2)], mixBlend: 'overlay', clip: 'regular' },
    ],
    filter: { brightness: { base: 0.2, fromCenter: 0.3 }, contrast: { base: 2 } },
    mixBlend: 'color-dodge',
  };
  const src = compileEffect({ id: 'group', shine: [group], glare: [] });
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };

  it('starts the group transparent and composites every layer onto it, the first too', () => {
    at('  vec4 stack_shine0 = vec4(0.0);');
    expect(src).toContain(
      `stack_shine0 = compositeOver(stack_shine0, src_shine0_0, ${BLEND_ID.normal});`,
    );
    expect(src).toContain(
      `stack_shine0 = compositeOver(stack_shine0, src_shine0_1, ${BLEND_ID.overlay});`,
    );
  });

  it('draws each child whole — layers, filter, opacity, clip — then composites it onto the group', () => {
    const order = [
      at('  vec4 stack_shine0_c0 = vec4(0.0);'),
      at(
        '  stack_shine0_c0.rgb = applyFilter(stack_shine0_c0.rgb, (1.250000), 1.000000, 1.000000);',
      ),
      at('  stack_shine0_c0.a *= clamp((0.800000), 0.0, 1.0);'),
      at(`  stack_shine0 = compositeOver(stack_shine0, stack_shine0_c0, ${BLEND_ID.lighten});`),
      at('  vec4 stack_shine0_c1 = vec4(0.0);'),
      at(
        '  stack_shine0_c1.a *= clamp(1.000000, 0.0, 1.0) * insideRect(vUv, vec4(0.098500, 0.080000, 0.528500, 0.080000));',
      ),
      at(`  stack_shine0 = compositeOver(stack_shine0, stack_shine0_c1, ${BLEND_ID.overlay});`),
      at(
        '  stack_shine0.rgb = applyFilter(stack_shine0.rgb, (0.200000 + 0.300000 * uPointerFromCenter), (2.000000), 1.000000);',
      ),
      at(
        `  acc = mix(acc, blendWith(${BLEND_ID['color-dodge']}, acc, stack_shine0.rgb), stack_shine0.a * clamp(1.000000 * uCardOpacity, 0.0, 1.0));`,
      ),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('writes an exact gradient’s stops premultiplied, padded to 32, and looks them up where CSS puts them', () => {
    expect(src).toContain(
      'vec4 stops_shine0_0[MAX_CSS_STOPS] = vec4[MAX_CSS_STOPS](vec4(0.000000, 0.000000, 0.000000, 0.980000), vec4(0.142500, 0.142500, 0.142500, 0.150000)',
    );
    expect(src).toContain(
      'float pos_shine0_0[MAX_CSS_STOPS] = float[MAX_CSS_STOPS](0.100000, 0.900000, 0.900000',
    );
    expect(src).toContain(
      'vec4 src_shine0_0 = cssStops(stops_shine0_0, pos_shine0_0, 2, radialReach(vUv, vec2((0.000000 + 1.000000 * (uPointerUV.x)), (0.000000 + 1.000000 * (uPointerUV.y))), vec2(1.000000, 1.000000), vec2((0.000000 + 1.000000 * (uPointerUV.x)), (0.000000 + 1.000000 * (uPointerUV.y))), 0.0));',
    );
  });

  it('draws an older kind inside a group as opaque', () => {
    expect(src).toContain(
      'vec4 src_shine0_1 = vec4(srcSolid(vec3(0.300000, 0.300000, 0.300000)), 1.0);',
    );
  });

  it('mixes a stop part-glow toward uCardGlow before premultiplying', () => {
    const glow = compileEffect({
      id: 'glow',
      shine: [
        {
          layers: [
            {
              ...exactRadialLayer,
              source: {
                ...exactRadialLayer.source,
                stops: [
                  { at: 0.2, color: [0.95, 0.95, 0.95] },
                  { at: 1.3, color: [0, 0, 0], glow: 1 },
                ],
              },
            },
          ],
          mixBlend: 'color-dodge',
        },
      ],
      glare: [],
    });
    expect(glow).toContain(
      'vec4(mix(vec3(0.000000, 0.000000, 0.000000), uCardGlow, 1.000000) * 1.000000, 1.000000)',
    );
  });

  it('draws css-linear along its line, wrapping a repeating one, and css-conic by turns', () => {
    const lin = compileEffect({
      id: 'lin',
      shine: [
        {
          layers: [
            {
              source: {
                kind: 'css-linear',
                repeating: true,
                line: { a: 2, b: -1, c: { base: 0.5, fromLeft: 0.3 } },
                stops: [
                  { at: 0, color: [1, 0, 0] },
                  { at: 1, color: [0, 0, 1] },
                ],
              },
              blend: 'normal',
            },
            {
              source: {
                kind: 'css-conic',
                centre: [0.5, 0.5],
                from: 0,
                stops: [
                  { at: 0, color: [1, 1, 1] },
                  { at: 1, color: [0, 0, 0] },
                ],
              },
              blend: 'overlay',
            },
          ],
          mixBlend: 'screen',
        },
      ],
      glare: [],
    });
    expect(lin).toContain(
      'cssStops(stops_shine0_0, pos_shine0_0, 2, fract((2.000000 * vUv.x + -1.000000 * vUv.y + (0.500000 + 0.300000 * (uPointerUV.x)))))',
    );
    expect(lin).toContain(
      'cssStops(stops_shine0_1, pos_shine0_1, 2, conicTurn(vUv, vec2(0.500000, 0.500000), 0.000000))',
    );
  });

  it('refuses a child with children of its own, and more stops than it holds', () => {
    const deep: Element = {
      layers: [solid(1)],
      mixBlend: 'normal',
      children: [
        {
          layers: [solid(1)],
          mixBlend: 'normal',
          children: [{ layers: [solid(1)], mixBlend: 'normal' }],
        },
      ],
    };
    expect(() => compileEffect({ id: 'deep', shine: [deep], glare: [] })).toThrow(
      /no children of its own/,
    );
    const many: GradientStop[] = Array.from({ length: 33 }, (_, i) => ({
      at: i / 32,
      color: [0, 0, 0],
    }));
    expect(() =>
      compileEffect({
        id: 'many',
        shine: [
          {
            layers: [{ ...exactRadialLayer, source: { ...exactRadialLayer.source, stops: many } }],
            mixBlend: 'normal',
          },
        ],
        glare: [],
      }),
    ).toThrow(/32/);
  });
});
```

In `index.test.ts`, make `elementsOf` include children and update four tests:

```ts
/** Every element an effect paints, and every child inside one. */
const elementsOf = (effect: Effect) =>
  [...(effect.beneath ?? []), ...effect.shine, ...effect.glare].flatMap((el) => [
    el,
    ...(el.children ?? []),
  ]);
const topLevelOf = (effect: Effect) => [
  ...(effect.beneath ?? []),
  ...effect.shine,
  ...effect.glare,
];
```

- "gives every element at least one layer" → `expect(el.layers.length + (el.children?.length ?? 0), key).toBeGreaterThan(0)` for top-level elements; children need `el.layers.length > 0`; add `expect(child.children ?? [], key).toEqual([])` and `expect((el.children ?? []).length, key).toBeLessThanOrEqual(2)` (a shine's `:before` and `:after`).
- "never lets a first layer carry a blend" → skip elements with no layers (`if (el.layers.length)`).
- stop limit → `css-linear`/`css-radial`/`css-conic` counted against 32, the older kinds against 8.
- "compiles every effect…" → count `/vec[34] src_/g` against the layers of `elementsOf(effect)`, and `acc = mix(acc, blendWith(` against `topLevelOf(effect).length`.
- New: `it('gives no exact gradient a size or offset: it draws in the card’s own uv', …)` — for every layer whose kind starts with `css-`, `layer.size` and `layer.offset` are undefined.

In `sources.test.ts`, add `'css-linear'`, `'css-radial'`, `'css-conic'` to the kinds list.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/holo/shader src/holo/effects/index.test.ts`
Expected: FAIL — `needsRGBA` missing, `children` not in `Element`, kinds missing.

- [ ] **Step 3: Implement the types** (types.ts): add `GradientStop` and the three kinds as in Interfaces, each with a doc comment (`css-linear`: "linear-gradient or repeating-linear-gradient drawn as CSS draws it: t = a·u + b·v + c along its gradient line, 0 at the line's start and 1 at its end; a repeating one's stops are one period normalised to 0..1 and t wraps"; `css-radial`: "radial-gradient with CSS's geometry (sources.ts#radialReach)"; `css-conic`: "conic-gradient about `centre`, from `from` turns, clockwise"; all: "RGBA path only; give the layer no size or offset"). Add to `Element`:

```ts
  /**
   * The pseudo-elements that paint inside this element's isolated group, in
   * paint order — resolve the reference's z-index into this order (its
   * pseudo-elements are grid items, so a positive z-index paints after
   * `auto`). Each is drawn whole (its layers, its filter, its opacity and
   * clip on its alpha), then composited onto the group with its mixBlend;
   * the element's filter then applies to the whole group, and its mixBlend
   * composites the group onto the card, as CSS draws `.card__shine`. A child
   * has no children of its own. An element with children compiles to the
   * RGBA path (compile.ts#needsRGBA).
   */
  children?: Element[];
```

In `sources.ts`'s `SOURCE_ID`, append `'css-linear': 15, 'css-radial': 16, 'css-conic': 17`.

- [ ] **Step 4: Implement the compiler** (compile.ts)

Refactor `filterCode` into `filterCall(filter, target)` returning `` `  ${target} = applyFilter(${target}, ${b}, ${c}, ${s});` `` and call it with `` `stack_${prefix}` `` in the RGB path (identical text). Rename today's `elementCode` to `rgbElementCode`. Add:

```ts
/** Textures whose alpha channel is part of the picture; none yet (the cosmos layers and illusion-mask join). */
export const ALPHA_TEXTURES: ReadonlySet<Source['kind']> = new Set<Source['kind']>();

const MAX_CSS_STOPS = 32; // sources.ts's MAX_CSS_STOPS

const isExact = (s: Source) =>
  s.kind === 'css-linear' || s.kind === 'css-radial' || s.kind === 'css-conic';

/**
 * Whether an element compiles to the RGBA path: it has children, or a layer
 * that is an exact gradient or a texture with alpha. Everything else keeps the
 * RGB path, byte for byte (effects/unchanged.test.ts).
 */
export function needsRGBA(element: Element): boolean {
  if (element.children?.length) return true;
  return element.layers.some(({ source }) => isExact(source) || ALPHA_TEXTURES.has(source.kind));
}

type ExactSource = Extract<Source, { kind: 'css-linear' | 'css-radial' | 'css-conic' }>;

/** An exact gradient's stops, premultiplied (glow mixed in first), and their places, padded to 32. */
function cssStopArrays(id: string, stops: GradientStop[]): string[] {
  if (stops.length > MAX_CSS_STOPS) {
    throw new Error(`${stops.length} stops: an exact gradient holds ${MAX_CSS_STOPS}`);
  }
  const pad = MAX_CSS_STOPS - stops.length;
  const colour = (s: GradientStop) => {
    const a = s.alpha ?? 1;
    return s.glow
      ? `vec4(mix(${vec3(s.color)}, uCardGlow, ${f(s.glow)}) * ${f(a)}, ${f(a)})`
      : `vec4(${f(s.color[0] * a)}, ${f(s.color[1] * a)}, ${f(s.color[2] * a)}, ${f(a)})`;
  };
  const last = f(stops[stops.length - 1].at);
  return [
    `  vec4 stops_${id}[MAX_CSS_STOPS] = vec4[MAX_CSS_STOPS](${[...stops.map(colour), ...Array<string>(pad).fill('vec4(0.0)')].join(', ')});`,
    `  float pos_${id}[MAX_CSS_STOPS] = float[MAX_CSS_STOPS](${[...stops.map((s) => f(s.at)), ...Array<string>(pad).fill(last)].join(', ')});`,
  ];
}

function exactExpr(source: ExactSource, decls: string[], id: string): string {
  decls.push(...cssStopArrays(id, source.stops));
  const lookup = (t: string) => `cssStops(stops_${id}, pos_${id}, ${source.stops.length}, ${t})`;
  switch (source.kind) {
    case 'css-linear': {
      const t = `(${f(source.line.a)} * vUv.x + ${f(source.line.b)} * vUv.y + ${driven(source.line.c, 0)})`;
      return lookup(source.repeating ? `fract(${t})` : t);
    }
    case 'css-radial': {
      const [cx, cy] = source.centre.map((p) => driven(p, 0));
      const [ax, ay] = source.at.map((p) => driven(p, 0));
      return lookup(
        `radialReach(vUv, vec2(${cx}, ${cy}), vec2(${f(source.size[0])}, ${f(source.size[1])}), vec2(${ax}, ${ay}), ${source.ellipse ? '1.0' : '0.0'})`,
      );
    }
    case 'css-conic':
      return lookup(
        `conicTurn(vUv, vec2(${f(source.centre[0])}, ${f(source.centre[1])}), ${f(source.from)})`,
      );
  }
}

/** One layer on the RGBA path: its colour and alpha, composited onto the layers beneath. */
function rgbaLayerCode(layer: Layer, index: number, prefix: string): string {
  const id = `${prefix}_${index}`;
  const decls: string[] = [];
  const lines: string[] = [];
  let expr: string;
  if (isExact(layer.source)) {
    expr = exactExpr(layer.source as ExactSource, decls, id);
  } else {
    const size = layer.size ?? [1, 1];
    const uv = `uv_${id}`;
    lines.push(
      `  vec2 ${uv} = uvTransform(vUv, vec2(${f(size[0])}, ${f(size[1])}), vec2(${driven(layer.offset?.x, 0)}, ${driven(layer.offset?.y, 0)}));`,
    );
    // an older kind, and every texture so far, is opaque
    expr = `vec4(${sourceExpr(layer.source, uv, decls, id)}, 1.0)`;
  }
  return [
    ...decls,
    ...lines,
    `  vec4 src_${id} = ${expr};`,
    ...(layer.opacity ? [`  src_${id}.a *= clamp(${driven(layer.opacity, 1)}, 0.0, 1.0);`] : []),
    `  stack_${prefix} = compositeOver(stack_${prefix}, src_${id}, ${BLEND_ID[layer.blend]});`,
  ].join('\n');
}

const rectOf = (shape: NonNullable<Element['clip']>) => {
  const r = regionFor(shape);
  return `insideRect(vUv, vec4(${f(r.top)}, ${f(r.right)}, ${f(r.bottom)}, ${f(r.left)}))`;
};

/** A child: drawn whole inside its parent's group, then composited onto it. */
function childCode(child: Element, index: number, parent: string): string {
  if (child.children?.length) throw new Error('a child has no children of its own');
  const prefix = `${parent}_c${index}`;
  const weight = `clamp(${driven(child.opacity, 1)}, 0.0, 1.0)${child.clip ? ` * ${rectOf(child.clip)}` : ''}`;
  return [
    `  // --- ${prefix}`,
    `  vec4 stack_${prefix} = vec4(0.0);`,
    ...child.layers.map((l, i) => rgbaLayerCode(l, i, prefix)),
    filterCall(child.filter, `stack_${prefix}.rgb`),
    `  stack_${prefix}.a *= ${weight};`,
    `  stack_${parent} = compositeOver(stack_${parent}, stack_${prefix}, ${BLEND_ID[child.mixBlend]});`,
  ].join('\n');
}

/** An element on the RGBA path: its group, filtered, composited onto the card by its alpha. */
function rgbaElementCode(element: Element, prefix: string): string {
  const opacity = driven(element.opacity, 1);
  const clip = element.clip ? rectOf(element.clip) : undefined;
  const weight = `stack_${prefix}.a * clamp(${opacity} * uCardOpacity, 0.0, 1.0)${clip ? ` * clip_${prefix}` : ''}`;
  return [
    `  // --- ${prefix} (rgba)`,
    `  vec4 stack_${prefix} = vec4(0.0);`,
    ...element.layers.map((l, i) => rgbaLayerCode(l, i, prefix)),
    ...(element.children ?? []).map((c, i) => childCode(c, i, prefix)),
    filterCall(element.filter, `stack_${prefix}.rgb`),
    ...(clip ? [`  float clip_${prefix} = ${clip};`] : []),
    `  acc = mix(acc, blendWith(${BLEND_ID[element.mixBlend]}, acc, stack_${prefix}.rgb), ${weight});`,
  ].join('\n');
}

function elementCode(element: Element, prefix: string): string {
  return needsRGBA(element) ? rgbaElementCode(element, prefix) : rgbElementCode(element, prefix);
}
```

`compileEffect` keeps calling `elementCode`. `sourceExpr`'s `switch` needs cases for the three new kinds to stay exhaustive: `throw new Error(`${source.kind} draws on the RGBA path only`)`.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/holo && pnpm typecheck`
Expected: PASS, pins included; typecheck clean.

- [ ] **Step 6: Commit** — `feat(holodex): give the DSL groups, an RGBA path and exact gradients`

---

### Task 5: The exact converters in css.ts

**Files:**

- Modify: `apps/holodex/src/holo/effects/css.ts`
- Test: `apps/holodex/src/holo/effects/css.test.ts`

**Interfaces:**

- Consumes: `gradientLine`, `along`, `plus`, `times`, `POINTER_X/Y`, `COVER`, `CARD_PX`, `CARD_ASPECT` (all in css.ts); Task 4's source kinds.
- Produces: `CssStop.glow?: number`; `export const glowStop = (atPercent: number, alpha = 1): CssStop`; `export function exactLinear(angleDeg: number, stops: CssStop[], box?: CssBox): Background`; `export function exactRepeatingLinear(angleDeg: number, stops: CssStop[], box?: CssBox): Background`; `export function exactRadial(stops: CssStop[], box?: CssBox, options?: { at?: [PointerDriven, PointerDriven]; ellipse?: boolean }): Background`; `export function exactConic(stops: CssStop[], options?: { from?: number }): Background`; `export function gradientLengthPx(angleDeg: number, box: CssBox): number`; `export function autoHeight(width: number, natural: readonly [number, number]): [number, number]`; `export function exactColorAt(stops: GradientStop[], t: number, glow?: RGB): [number, number, number, number]`.

- [ ] **Step 1: Write the failing tests**

```ts
import {
  autoHeight,
  exactColorAt,
  exactConic,
  exactLinear,
  exactRadial,
  exactRepeatingLinear,
  glowStop,
  gradientLengthPx,
  BLACK,
  COVER,
  CENTER,
  grey,
  stop,
  CARD_ASPECT,
  valueAt,
} from './css';

describe('the exact converters', () => {
  it('keep a radial’s stops where CSS wrote them, alpha and all', () => {
    const { source } = exactRadial([stop(BLACK, 10, 0.98), stop(grey(0.95), 90, 0.15)]);
    expect(source).toMatchObject({
      kind: 'css-radial',
      ellipse: false,
      size: [1, 1],
      stops: [
        { at: 0.1, color: [0, 0, 0], alpha: 0.98 },
        { at: 0.9, color: [0.95, 0.95, 0.95], alpha: 0.15 },
      ],
    });
  });

  it('centre a radial at `at` of its image, as background-position places the image', () => {
    const at: [PointerDriven, PointerDriven] = [
      { base: 0.25, fromLeft: 0.5 },
      { base: 0.25, fromTop: 0.5 },
    ];
    const { source } = exactRadial(
      [stop(BLACK, 0), stop(BLACK, 100)],
      { size: [3.5, 3.5], position: [CENTER, CENTER] },
      { at, ellipse: true },
    );
    if (source.kind !== 'css-radial') throw new Error();
    // left edge 0.5 · (1 − 3.5) = −1.25; centre −1.25 + 3.5 · (0.25 + 0.5 p)
    expect(valueAt(source.centre[0], { fromLeft: 0.5 }, 0)).toBeCloseTo(0.5, 9);
    expect(valueAt(source.centre[0], { fromLeft: 0 }, 0)).toBeCloseTo(-0.375, 9);
    expect(source.at).toEqual(at);
  });

  it('write var(--card-glow) as a stop that is all glow', () => {
    expect(glowStop(130)).toEqual({ color: BLACK, at: 1.3, alpha: 1, glow: 1 });
    const { source } = exactRadial([stop(grey(0.95), 20), glowStop(130)]);
    if (source.kind !== 'css-radial') throw new Error();
    expect(source.stops[1]).toEqual({ at: 1.3, color: [0, 0, 0], glow: 1 });
  });

  it('draw a linear gradient along the line CSS draws it on', () => {
    // 90deg across a cover box: 0 at the left edge, 1 at the right
    const { source } = exactLinear(90, [stop(BLACK, 0), stop(grey(1), 100)], COVER);
    if (source.kind !== 'css-linear') throw new Error();
    const t = (u: number, v: number) =>
      source.line.a * u + source.line.b * v + valueAt(source.line.c, {}, 0);
    expect(t(0, 0.3)).toBeCloseTo(0, 9);
    expect(t(1, 0.7)).toBeCloseTo(1, 9);
    expect(source.repeating).toBe(false);
  });

  it('normalise a repeating gradient to one period, and keep hard edges', () => {
    const { source } = exactRepeatingLinear(
      90,
      [stop(grey(0.1), 0), stop(grey(0.1), 1.2), stop(grey(0.2), 1.21), stop(grey(0.2), 2.4)],
      COVER,
    );
    if (source.kind !== 'css-linear') throw new Error();
    expect(source.repeating).toBe(true);
    [0, 0.5, 1.21 / 2.4, 1].forEach((at, i) => expect(source.stops[i].at).toBeCloseTo(at, 12));
    const t = (u: number) => source.line.a * u + valueAt(source.line.c, {}, 0);
    // 2.4% of the gradient line is one period: u = 0.024 is t = 1
    expect(t(0.024)).toBeCloseTo(1, 9);
  });

  it('turn a conic’s evenly spread colours into turns from the top', () => {
    const { source } = exactConic([stop(BLACK, 0), stop(grey(1), 50), stop(BLACK, 100)]);
    expect(source).toMatchObject({ kind: 'css-conic', centre: [0.5, 0.5], from: 0 });
    if (source.kind !== 'css-conic') throw new Error();
    expect(source.stops.map((s) => s.at)).toEqual([0, 0.5, 1]);
  });

  it('move a stop CSS would move: never before an earlier one', () => {
    const { source } = exactRadial([stop(BLACK, 50), stop(grey(1), 20)]);
    if (source.kind !== 'css-radial') throw new Error();
    expect(source.stops.map((s) => s.at)).toEqual([0.5, 0.5]);
  });

  it('measure a gradient line in px, at CARD_PX', () => {
    // 400% × 100% at 55deg: 1200 px wide, 300 / (63/88) px tall
    const h = 300 / CARD_ASPECT;
    expect(gradientLengthPx(55, { size: [4, 1], position: [CENTER, CENTER] })).toBeCloseTo(
      1200 * Math.sin((55 * Math.PI) / 180) + h * Math.cos((55 * Math.PI) / 180),
      6,
    );
  });

  it('size `auto` in proportion to the texture', () => {
    // a square texture 25% of the card wide is 25% · 63/88 of it tall
    expect(autoHeight(0.25, [208, 208])).toEqual([0.25, 0.25 * CARD_ASPECT]);
    expect(autoHeight(0.6, [600, 400])).toEqual([0.6, 0.6 * (400 / 600) * CARD_ASPECT]);
  });

  it('look colours up premultiplied, as the shader does', () => {
    // black at alpha 1 to white at alpha 0: halfway is black at alpha 0.5, not grey
    const got = exactColorAt(
      [
        { at: 0, color: [0, 0, 0] },
        { at: 1, color: [1, 1, 1], alpha: 0 },
      ],
      0.5,
    );
    expect(got.map((v) => +v.toFixed(6))).toEqual([0, 0, 0, 0.5]);
    const glow = exactColorAt(
      [
        { at: 0, color: [0, 0, 0], glow: 1 },
        { at: 1, color: [0, 0, 0], glow: 1 },
      ],
      0.3,
      [0.2, 0.4, 0.6],
    );
    expect(glow.map((v) => +v.toFixed(6))).toEqual([0.2, 0.4, 0.6, 1]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/holo/effects/css.test.ts`
Expected: FAIL — the converters are not exported.

- [ ] **Step 3: Implement** (css.ts, in the exact-gradients section; add `glow?: number` to `CssStop`, and `import type { GradientStop } from '../shader/types'`)

```ts
/** `var(--card-glow) at%`: a stop that is all the card's glow (uCardGlow). */
export const glowStop = (atPercent: number, alpha = 1): CssStop => ({
  color: BLACK,
  at: atPercent / 100,
  alpha,
  glow: 1,
});

/**
 * CSS stops as an exact gradient's: where CSS puts them (a stop placed before
 * an earlier one moves up to it, as CSS moves it), alpha and glow kept.
 */
function exactStops(stops: CssStop[], place: (at: number) => number = (at) => at): GradientStop[] {
  let floor = -Infinity;
  return stops.map((s) => {
    floor = Math.max(floor, s.at);
    const out: GradientStop = { at: place(floor), color: s.color };
    if (s.alpha !== 1) out.alpha = s.alpha;
    if (s.glow) out.glow = s.glow;
    return out;
  });
}

/** `linear-gradient(<angle>deg, stops)` in an image of this box, drawn exactly (RGBA path). */
export function exactLinear(angleDeg: number, stops: CssStop[], box: CssBox = COVER): Background {
  const line = gradientLine(angleDeg, box);
  return { source: { kind: 'css-linear', repeating: false, line, stops: exactStops(stops) } };
}

/**
 * `repeating-linear-gradient(<angle>deg, stops)` in an image of this box,
 * drawn exactly: one period, first stop to last, normalised to 0..1, and t
 * wrapped into it, as CSS repeats the stops.
 */
export function exactRepeatingLinear(
  angleDeg: number,
  stops: CssStop[],
  box: CssBox = COVER,
): Background {
  const first = stops[0].at;
  const span = stops[stops.length - 1].at - first;
  if (!(span > 0)) throw new Error('a repeating gradient needs a period');
  const line = along(gradientLine(angleDeg, box), first, span);
  return {
    source: {
      kind: 'css-linear',
      repeating: true,
      line,
      stops: exactStops(stops, (at) => (at - first) / span),
    },
  };
}

/**
 * `radial-gradient(farthest-corner <circle|ellipse> at <at>, stops)` in an
 * image of this box, drawn exactly: centred at `at` of the image (the pointer,
 * unless given) as background-position places the image.
 */
export function exactRadial(
  stops: CssStop[],
  box: CssBox = COVER,
  options: { at?: [PointerDriven, PointerDriven]; ellipse?: boolean } = {},
): Background {
  const [width, height] = box.size;
  if (width < 1 || height < 1) throw new Error('a radial smaller than the card would tile');
  const at = options.at ?? [POINTER_X, POINTER_Y];
  return {
    source: {
      kind: 'css-radial',
      centre: [
        plus(times(box.position[0], 1 - width), times(at[0], width)),
        plus(times(box.position[1], 1 - height), times(at[1], height)),
      ],
      size: [width, height],
      at,
      ellipse: options.ellipse ?? false,
      stops: exactStops(stops),
    },
  };
}

/** `conic-gradient([from <turns>,] stops)` over the whole card, about its centre, drawn exactly. */
export function exactConic(stops: CssStop[], options: { from?: number } = {}): Background {
  return {
    source: {
      kind: 'css-conic',
      centre: [0.5, 0.5],
      from: options.from ?? 0,
      stops: exactStops(stops),
    },
  };
}

/** A gradient line's length in px at CARD_PX, for stops the CSS places in px. */
export function gradientLengthPx(angleDeg: number, box: CssBox): number {
  const rad = (angleDeg * Math.PI) / 180;
  const width = box.size[0] * CARD_PX;
  const height = (box.size[1] * CARD_PX) / CARD_ASPECT;
  return Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad));
}

/** background-size `<width> auto` for a texture of this natural size, as fractions of the card. */
export function autoHeight(width: number, natural: readonly [number, number]): [number, number] {
  return [width, width * (natural[1] / natural[0]) * CARD_ASPECT];
}

/** An exact gradient's colour at t, as sources.ts's cssStops draws it: straight colour and alpha. */
export function exactColorAt(
  stops: GradientStop[],
  t: number,
  glow: RGB = BLACK,
): [number, number, number, number] {
  const index = cssStopIndex(
    stops.map((s) => s.at),
    t,
  );
  const i = Math.floor(index);
  const j = Math.min(i + 1, stops.length - 1);
  const premul = (s: GradientStop) => {
    const a = s.alpha ?? 1;
    const c = mix(s.color, glow, s.glow ?? 0);
    return [c[0] * a, c[1] * a, c[2] * a, a];
  };
  const [p, q] = [premul(stops[i]), premul(stops[j])];
  const m = p.map((v, k) => v + (q[k] - v) * (index - i));
  return m[3] > 0 ? [m[0] / m[3], m[1] / m[3], m[2] / m[3], m[3]] : [0, 0, 0, 0];
}
```

`gradientLine` returns `{ a, b, c }`, the `line` shape `css-linear` takes; if TypeScript objects to the `Linear` interface's name, export the interface or spread it.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/holo/effects/css.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(holodex): convert CSS gradients exactly for the RGBA path`

---

### Task 6: The card's glow

**Files:**

- Modify: `apps/holodex/src/holo/select.ts`, `apps/holodex/src/holo/HoloCard.tsx`, `apps/holodex/src/holo/canvas-key.ts`, `apps/holodex/src/holo/material.ts`, `apps/holodex/src/holo/scene.ts`
- Test: `apps/holodex/src/holo/select.test.ts`, `apps/holodex/src/holo/canvas-key.test.ts`, `apps/holodex/src/holo/material.test.ts`

**Interfaces:**

- Produces: `HoloSelection.glow: [number, number, number]`; `export const DEFAULT_GLOW`; `export function glowOf(card: Card): [number, number, number]`; the material uniform `uCardGlow` (a `Vector3`), set by `setSelection`.

- [ ] **Step 1: Write the failing tests**

select.test.ts:

```ts
import { DEFAULT_GLOW, glowOf, selectHolo } from './select';
import { hsl } from './effects/css';

describe('the card’s glow, base.css’s --card-glow', () => {
  const card = (types?: string[]) => ({ ...BASE_CARD, types }) as Card; // BASE_CARD: the file's existing minimal card
  const table: Array<[string, [number, number, number]]> = [
    ['Water', hsl(192, 97, 60)],
    ['Fire', hsl(9, 81, 59)],
    ['Grass', hsl(96, 81, 65)],
    ['Lightning', hsl(54, 87, 63)],
    ['Psychic', hsl(281, 62, 58)],
    ['Fighting', [145 / 255, 90 / 255, 39 / 255]],
    ['Darkness', hsl(189, 77, 27)],
    ['Metal', hsl(184, 20, 70)],
    ['Dragon', hsl(51, 60, 35)],
    ['Fairy', hsl(323, 100, 89)],
  ];
  it.each(table)('%s glows as base.css colours it', (type, rgb) => {
    glowOf(card([type])).forEach((v, i) => expect(v).toBeCloseTo(rgb[i], 4));
  });
  it('keeps :root’s glow for Colorless, for a card with no type, and reads only the first type', () => {
    hsl(175, 100, 90).forEach((v, i) => expect(DEFAULT_GLOW[i]).toBeCloseTo(v, 4));
    expect(glowOf(card(['Colorless']))).toEqual(DEFAULT_GLOW);
    expect(glowOf(card(undefined))).toEqual(DEFAULT_GLOW);
    expect(glowOf(card(['Fire', 'Water']))).toEqual(glowOf(card(['Fire'])));
  });
  it('hands the glow to the scene with the selection', () => {
    expect(selectHolo(card(['Grass'])).glow).toEqual(glowOf(card(['Grass'])));
  });
});
```

canvas-key.test.ts: a key test that two selections differing only in `glow` give different keys (and update every existing `selection` literal in the file with `glow: [0.8, 1, 0.9833]`).

material.test.ts: `buildMaterial(EFFECTS.basic).uniforms.uCardGlow.value` is a `Vector3` equal to `DEFAULT_GLOW`.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/holo/select.test.ts src/holo/canvas-key.test.ts src/holo/material.test.ts`
Expected: FAIL — `glowOf` missing, key ignores glow, no `uCardGlow`.

- [ ] **Step 3: Implement**

select.ts (eager — no import from `effects/`):

```ts
/**
 * base.css's --card-glow, which the reference classes a card by its type
 * (`.card.water` …), as RGB 0..1: its hsl() values converted, and Fighting's
 * rgb(). select.test.ts holds each to css.ts#hsl. A card is keyed by its
 * first type; anything else, Colorless and trainers included, keeps :root's.
 */
const GLOW_BY_TYPE: Readonly<Record<string, [number, number, number]>> = {
  Water: [0.212, 0.8328, 0.988],
  Fire: [0.9221, 0.3575, 0.2579],
  Grass: [0.5933, 0.9335, 0.3665],
  Lightning: [0.9519, 0.8875, 0.3081],
  Psychic: [0.6755, 0.3196, 0.8404],
  Fighting: [0.5686, 0.3529, 0.1529],
  Darkness: [0.0621, 0.4155, 0.4779],
  Metal: [0.64, 0.752, 0.76],
  Dragon: [0.56, 0.497, 0.14],
  Fairy: [1, 0.78, 0.9157],
};

/** :root's --card-glow, hsl(175, 100%, 90%). */
export const DEFAULT_GLOW: [number, number, number] = [0.8, 1, 0.9833];

export function glowOf(card: Card): [number, number, number] {
  return GLOW_BY_TYPE[card.types?.[0] ?? ''] ?? DEFAULT_GLOW;
}
```

Add `glow: [number, number, number]` to `HoloSelection` (doc: "the card's --card-glow, for an effect whose stops are part glow (uCardGlow)"), and return `glow: glowOf(card)` from `selectHolo`.

HoloCard.tsx: build the memoised selection with the glow's three numbers as dependencies, and rewrite the comment's last sentence: the glow is a fourth field, which `variant` never changes (it is the card's).

```ts
const [glowR, glowG, glowB] = freshSelection.glow;
const selection = useMemo(
  () => ({
    effect: freshSelection.effect,
    shape: freshSelection.shape,
    invert: freshSelection.invert,
    glow: [glowR, glowG, glowB] as [number, number, number],
  }),
  [freshSelection.effect, freshSelection.shape, freshSelection.invert, glowR, glowG, glowB],
);
```

canvas-key.ts: add `selection.glow` to the JSON array after `selection.invert`, and "the four selection fields" in the comment.

material.ts: `uCardGlow: { value: new Vector3(...DEFAULT_GLOW) },` (import `Vector3` from three and `DEFAULT_GLOW` from `./select`).

scene.ts `setSelection`, after `uInvert`: `material.uniforms.uCardGlow.value.set(...selection.glow);`

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src && pnpm typecheck`
Expected: PASS (views' tests construct selections through `selectHolo`; any literal `HoloSelection` in a test gains `glow`).

- [ ] **Step 5: Commit** — `feat(holodex): hand the card's type glow to the shader`

---

### Task 7: Three textures — glitter redrawn, geometric, trainerbg

**Files:**

- Modify: `apps/holodex/src/holo/textures.ts`, `apps/holodex/src/holo/shader/types.ts`, `apps/holodex/src/holo/shader/sources.ts`, `apps/holodex/src/holo/shader/compile.ts`, `apps/holodex/src/holo/scene.ts`, `apps/holodex/src/holo/material.ts`
- Test: `apps/holodex/src/holo/textures.test.ts`, `apps/holodex/src/holo/scene.test.ts`, `apps/holodex/src/holo/shader/sources.test.ts`

**Interfaces:**

- Produces: `TextureName` gains `'geometric' | 'trainerbg'`; `export const TEXTURE_SIZE: Record<TextureName, readonly [number, number]>`; `export function glitterPixels(width: number, height: number, seed: number): Uint8ClampedArray`; `export function plotSpeck(grey: Float32Array, width: number, height: number, x: number, y: number, size: number, value: number): void`; `export function geometricFigure(i: number, j: number, cells: number, seed: number): number`; `export function geometricPixels(size: number, seed: number): Uint8ClampedArray`; `export function trainerbgPixels(size: number): Uint8ClampedArray`; Source kinds `{ kind: 'geometric'; scale: number }`, `{ kind: 'trainerbg'; scale: number }` (SOURCE_ID 18, 19); samplers `uGeometric`, `uTrainerbg`; `texturesUsedBy` reads children.

- [ ] **Step 1: Write the failing tests** (textures.test.ts)

```ts
import {
  GEOMETRIC_SEED,
  GEOMETRIC_SIZE,
  GLITTER_HEIGHT,
  GLITTER_SEED,
  GLITTER_WIDTH,
  TEXTURE_SIZE,
  TRAINERBG_SIZE,
  geometricFigure,
  geometricPixels,
  glitterPixels,
  plotSpeck,
  trainerbgPixels,
} from './textures';

/** Share of pixels whose grey (red channel) falls in [lo, hi). */
const share = (px: Uint8ClampedArray, lo: number, hi: number) => {
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] >= lo && px[i] < hi) n += 1;
  return n / (px.length / 4);
};
const mean = (px: Uint8ClampedArray, channel: number) => {
  let s = 0;
  for (let i = channel; i < px.length; i += 4) s += px[i];
  return s / (px.length / 4);
};

describe('glitter, drawn to stand in for the reference’s sheet', () => {
  const px = glitterPixels(GLITTER_WIDTH, GLITTER_HEIGHT, GLITTER_SEED);
  it('is the reference’s size, opaque, and the same on every load', () => {
    expect(TEXTURE_SIZE.glitter).toEqual([630, 540]);
    expect(px.length).toBe(630 * 540 * 4);
    expect(glitterPixels(GLITTER_WIDTH, GLITTER_HEIGHT, GLITTER_SEED)).toEqual(px);
    expect(share(new Uint8ClampedArray(px.filter((_, i) => i % 4 === 3)), 255, 256)).toBe(1);
  });
  it('keeps the reference’s tones: mostly near black, a tenth bright', () => {
    // measured off glitter.png headless: mean 51, 61% below 32, 9% at 160 or above
    expect(mean(px, 0)).toBeGreaterThan(40);
    expect(mean(px, 0)).toBeLessThan(62);
    expect(share(px, 0, 32)).toBeGreaterThan(0.5);
    expect(share(px, 0, 32)).toBeLessThan(0.7);
    expect(share(px, 160, 256)).toBeGreaterThan(0.06);
    expect(share(px, 160, 256)).toBeLessThan(0.12);
  });
  it('wraps a speck across the edges, so the sheet tiles', () => {
    const grey = new Float32Array(4 * 3);
    plotSpeck(grey, 4, 3, 3, 2, 2, 200);
    // (3,2), (0,2), (3,0), (0,0) lit; nothing else
    expect([...grey]).toEqual([200, 0, 0, 200, 0, 0, 0, 0, 200, 0, 0, 200]);
  });
});

describe('geometric, a diagonal line maze', () => {
  const cells = 3;
  it('draws the same figure in a cell and its copies across the tile’s edges', () => {
    for (let i = -4; i < 4; i += 1)
      for (let j = -4; j < 4; j += 1) {
        const f = geometricFigure(i, j, cells, GEOMETRIC_SEED);
        expect(geometricFigure(i + cells, j + cells, cells, GEOMETRIC_SEED)).toBe(f);
        expect(geometricFigure(i + cells, j - cells, cells, GEOMETRIC_SEED)).toBe(f);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(6);
      }
  });
  it('uses every figure', () => {
    const seen = new Set<number>();
    for (let u = 0; u < 2 * cells; u += 1)
      for (let v = 0; v < 2 * cells; v += 1) seen.add(geometricFigure(u, v, cells, GEOMETRIC_SEED));
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
  it('is the reference’s size, the same on every load, about a quarter white', () => {
    const px = geometricPixels(GEOMETRIC_SIZE, GEOMETRIC_SEED);
    expect(TEXTURE_SIZE.geometric).toEqual([300, 300]);
    expect(geometricPixels(GEOMETRIC_SIZE, GEOMETRIC_SEED)).toEqual(px);
    expect(mean(px, 0) / 255).toBeGreaterThan(0.22);
    expect(mean(px, 0) / 255).toBeLessThan(0.34);
  });
  it('tiles: its left column continues its right, and its top row its bottom', () => {
    const px = geometricPixels(GEOMETRIC_SIZE, GEOMETRIC_SEED);
    const at = (x: number, y: number) => px[(y * GEOMETRIC_SIZE + x) * 4];
    let edge = 0;
    let inner = 0;
    for (let k = 0; k < GEOMETRIC_SIZE; k += 1) {
      edge +=
        Math.abs(at(0, k) - at(GEOMETRIC_SIZE - 1, k)) +
        Math.abs(at(k, 0) - at(k, GEOMETRIC_SIZE - 1));
      inner += Math.abs(at(150, k) - at(149, k)) + Math.abs(at(k, 150) - at(k, 149));
    }
    // across the seam, neighbours differ no more than neighbours inside do
    expect(edge).toBeLessThan(inner * 1.5);
  });
});

describe('trainerbg, blue wavy lines on white', () => {
  const px = trainerbgPixels(TRAINERBG_SIZE);
  it('is the reference’s size and colour', () => {
    expect(TEXTURE_SIZE.trainerbg).toEqual([208, 208]);
    // measured off trainerbg.png: mean (204, 234, 245)
    expect(mean(px, 0)).toBeGreaterThan(190);
    expect(mean(px, 0)).toBeLessThan(215);
    expect(mean(px, 1)).toBeGreaterThan(226);
    expect(mean(px, 2)).toBeGreaterThan(238);
  });
  it('crosses a row 16 times, bunching as the lines wave', () => {
    const row = Array.from({ length: TRAINERBG_SIZE }, (_, x) => px[x * 4] < 128);
    const starts = row.flatMap((ink, x) =>
      ink && !row[(x + TRAINERBG_SIZE - 1) % TRAINERBG_SIZE] ? [x] : [],
    );
    expect(starts).toHaveLength(16);
    const gaps = starts.map((x, i) => (starts[(i + 1) % 16] - x + TRAINERBG_SIZE) % TRAINERBG_SIZE);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(4);
  });
});
```

scene.test.ts: `texturesUsedBy` names a texture sampled only inside a child:

```ts
it('names a texture sampled only inside a child', () => {
  const effect: Effect = {
    id: 'child-only',
    shine: [
      {
        layers: [{ source: { kind: 'solid', color: [0, 0, 0] }, blend: 'normal' }],
        mixBlend: 'screen',
        children: [
          {
            layers: [{ source: { kind: 'geometric', scale: 1 }, blend: 'normal' }],
            mixBlend: 'lighten',
          },
        ],
      },
    ],
    glare: [],
  };
  expect(texturesUsedBy(effect)).toEqual(['geometric']);
});
```

sources.test.ts: add `'geometric'`, `'trainerbg'` to the kinds list.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/holo/textures.test.ts src/holo/scene.test.ts src/holo/shader/sources.test.ts`
Expected: FAIL — the generators and kinds are missing.

- [ ] **Step 3: Implement the pure parts** (textures.ts, in the tested section)

```ts
// ---------------------------------------------------------------- glitter

export const GLITTER_WIDTH = 630;
export const GLITTER_HEIGHT = 540;
export const GLITTER_SEED = 630;

/**
 * The reference's glitter.png, measured headless: a 630 × 540 sheet, mean
 * grey 51, 61% of it below 32 and 9% at 160 or above — a dark grain lit by
 * dense specks and a few star flares. Drawn to those tones, not copied.
 */
const GLITTER = {
  ground: { mean: 32, max: 127 },
  specks: { count: 6500, sizes: [1, 1, 2, 2, 3], low: 160, high: 255 },
  stars: { count: 60, arm: [3, 9], low: 200, high: 255 },
};

/** A square speck of this grey, wrapped across the sheet's edges; the brighter value wins. */
export function plotSpeck(
  grey: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  size: number,
  value: number,
): void {
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
      const i = ((y + dy) % height) * width + ((x + dx) % width);
      grey[i] = Math.max(grey[i], value);
    }
  }
}

/** A four-pointed flare: arms on the axes, fading to nothing at their tips, wrapped. */
function plotStar(
  grey: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  arm: number,
  value: number,
) {
  plotSpeck(grey, width, height, x, y, 1, value);
  for (let k = 1; k <= arm; k += 1) {
    const v = value * (1 - k / (arm + 1));
    for (const [dx, dy] of [
      [k, 0],
      [-k, 0],
      [0, k],
      [0, -k],
    ]) {
      plotSpeck(grey, width, height, (x + dx + width) % width, (y + dy + height) % height, 1, v);
    }
  }
}

export function glitterPixels(width: number, height: number, seed: number): Uint8ClampedArray {
  const random = mulberry32(seed);
  const grey = new Float32Array(width * height);
  for (let i = 0; i < grey.length; i += 1) {
    grey[i] = Math.min(GLITTER.ground.max, -GLITTER.ground.mean * Math.log(1 - random()));
  }
  const { specks, stars } = GLITTER;
  for (let n = 0; n < specks.count; n += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const size = specks.sizes[Math.floor(random() * specks.sizes.length)];
    plotSpeck(grey, width, height, x, y, size, specks.low + random() * (specks.high - specks.low));
  }
  for (let n = 0; n < stars.count; n += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const arm = stars.arm[0] + Math.floor(random() * (stars.arm[1] - stars.arm[0] + 1));
    plotStar(grey, width, height, x, y, arm, stars.low + random() * (stars.high - stars.low));
  }
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < grey.length; i += 1) out.set([grey[i], grey[i], grey[i], 255], i * 4);
  return out;
}

// -------------------------------------------------------------- geometric

export const GEOMETRIC_SIZE = 300;
export const GEOMETRIC_SEED = 300;

/**
 * The reference's geometric.png, measured headless: white stripes on black at
 * 45°, about 11.8 px apart and 3.3 px wide, turning in nested Ls. Here: 18
 * stripes per tile along each diagonal, 28% of each period white, in maze
 * cells six stripes across.
 */
const GEOMETRIC = { stripes: 18, white: 0.28, cellStripes: 6, samples: 4 };

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Which figure fills maze cell (i, j): straight stripes along either diagonal
 * (0, 1), or nested Ls about one of the cell's four corners (2–5). Cells sit
 * on the diagonals p = x + y and q = x − y; the tile repeats every `cells`
 * cells along both, as (i + cells, j ± cells), so a cell and its copies
 * across the tile's edges draw the same figure.
 */
export function geometricFigure(i: number, j: number, cells: number, seed: number): number {
  const u = mod(i + j, 2 * cells);
  const v = mod(i - j, 2 * cells);
  return Math.floor(mulberry32(seed * 7919 + u * 104729 + v * 1299709)() * 6);
}

export function geometricPixels(size: number, seed: number): Uint8ClampedArray {
  const period = size / GEOMETRIC.stripes;
  const cell = period * GEOMETRIC.cellStripes;
  const cells = size / cell;
  const figures = new Map<string, number>();
  const figure = (i: number, j: number) => {
    const key = `${mod(i + j, 2 * cells)},${mod(i - j, 2 * cells)}`;
    let f = figures.get(key);
    if (f === undefined) figures.set(key, (f = geometricFigure(i, j, cells, seed)));
    return f;
  };
  const n = GEOMETRIC.samples;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let white = 0;
      for (let sy = 0; sy < n; sy += 1) {
        for (let sx = 0; sx < n; sx += 1) {
          const p = x + (sx + 0.5) / n + (y + (sy + 0.5) / n);
          const q = x + (sx + 0.5) / n - (y + (sy + 0.5) / n);
          const i = Math.floor(p / cell);
          const j = Math.floor(q / cell);
          const s = p - i * cell;
          const t = q - j * cell;
          const fig = figure(i, j);
          const corner = fig - 2;
          const d =
            fig === 0
              ? s
              : fig === 1
                ? t
                : Math.max(corner & 1 ? cell - s : s, corner & 2 ? cell - t : t);
          if (Math.abs(mod(d / period, 1) - 0.5) < GEOMETRIC.white / 2) white += 1;
        }
      }
      const v = Math.round((white / (n * n)) * 255);
      out.set([v, v, v, 255], (y * size + x) * 4);
    }
  }
  return out;
}

// -------------------------------------------------------------- trainerbg

export const TRAINERBG_SIZE = 208;

/**
 * The reference's trainerbg.png, measured headless: 16 blue lines per 208 px
 * tile rising left to right, each waving twice across it about 4.8 px either
 * way, about 2.2 px thick, ink rgb(42, 176, 210) on white.
 */
const TRAINERBG = {
  lines: 16,
  waves: 2,
  amplitude: 4.8,
  width: 2.2,
  ink: [42, 176, 210],
  samples: 4,
};

export function trainerbgPixels(size: number): Uint8ClampedArray {
  const period = size / TRAINERBG.lines;
  const k = (2 * Math.PI * TRAINERBG.waves) / size;
  const n = TRAINERBG.samples;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let ink = 0;
      for (let sy = 0; sy < n; sy += 1) {
        for (let sx = 0; sx < n; sx += 1) {
          const px = x + (sx + 0.5) / n;
          const py = y + (sy + 0.5) / n;
          // lines of constant phi, rising left to right; the wave runs along them
          const wave = TRAINERBG.amplitude * k * Math.cos(k * (px - py));
          const phi = px + py + TRAINERBG.amplitude * Math.sin(k * (px - py));
          const m = mod(phi, period);
          const distance = Math.min(m, period - m) / Math.hypot(1 + wave, 1 - wave);
          if (distance < TRAINERBG.width / 2) ink += 1;
        }
      }
      const f = ink / (n * n);
      const [r, g, b] = TRAINERBG.ink;
      out.set(
        [255 + (r - 255) * f, 255 + (g - 255) * f, 255 + (b - 255) * f, 255],
        (y * size + x) * 4,
      );
    }
  }
  return out;
}
```

`TEXTURE_SIZE`, after the constants: `glitter: [GLITTER_WIDTH, GLITTER_HEIGHT]`, `grain: [1024, 1024]`, `iri: [IRI_SIZE, IRI_SIZE]`, `birthday: [BIRTHDAY_WIDTH, BIRTHDAY_HEIGHT]`, the four balls `[BALL_TILE, BALL_TILE]`, `geometric: [GEOMETRIC_SIZE, GEOMETRIC_SIZE]`, `trainerbg: [TRAINERBG_SIZE, TRAINERBG_SIZE]`.

Browser part: replace `sparkle()` with `fromPixels(GLITTER_WIDTH, GLITTER_HEIGHT, glitterPixels(GLITTER_WIDTH, GLITTER_HEIGHT, GLITTER_SEED))`, where

```ts
function fromPixels(width: number, height: number, pixels: Uint8ClampedArray): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(width, height);
  const image = ctx.createImageData(width, height);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
  return canvas;
}
```

(and `iri()` can use it too); add `geometric: () => fromPixels(GEOMETRIC_SIZE, GEOMETRIC_SIZE, geometricPixels(GEOMETRIC_SIZE, GEOMETRIC_SEED))` and `trainerbg: () => fromPixels(TRAINERBG_SIZE, TRAINERBG_SIZE, trainerbgPixels(TRAINERBG_SIZE))` to `GENERATORS`. Update the header: glitter is seeded now; grain alone still draws with `Math.random` (until the next plan redraws it).

- [ ] **Step 4: Wire the kinds**

types.ts: `| { kind: 'geometric'; scale: number }` (doc: "a diagonal line maze, standing in for the reference's geometric.png") and `| { kind: 'trainerbg'; scale: number }` ("blue wavy lines on white, for trainerbg.png"). sources.ts: `SOURCE_ID` `geometric: 18, trainerbg: 19`; `uniform sampler2D uGeometric;`, `uniform sampler2D uTrainerbg;`; `vec3 srcGeometric(vec2 uv, float scale) { return texture(uGeometric, uv * scale).rgb; }` and `srcTrainerbg` likewise. compile.ts `sourceExpr`: `case 'geometric': return `srcGeometric(${uv}, ${f(source.scale)})`;` and `trainerbg`. scene.ts: `SHARED_TEXTURE_UNIFORM` gains `geometric: 'uGeometric', trainerbg: 'uTrainerbg'`, and `texturesUsedBy` walks `[element, ...(element.children ?? [])]`. material.ts: `uGeometric: { value: null }, uTrainerbg: { value: null },`.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src && pnpm typecheck`
Expected: PASS; the pins hold (only the preamble grew).

- [ ] **Step 6: Look at them**

On the smoke server, render each texture in a page (`await import('/src/holo/textures.ts')`, `makeTexture(name).toDataURL()`), screenshot at 1:1 in the scratchpad next to the reference's, and compare by eye: motif, scale, density. Adjust a constant (not the tests' bounds) if one is visibly off; rerun Step 5.

- [ ] **Step 7: Commit** — `feat(holodex): draw glitter anew, and a maze and waves to stand in for the reference's`

---

### Task 8: The comparison harness's shared-texture mode

**Files (scratchpad, not committed):** `$S/cmp/shine/` with `S=/private/tmp/claude-502/-Users-mason-nguyencaominhanh-Mason-Workspace-ncam/e0870a3b-c2b4-4b99-bf0a-f22db85c397f/scratchpad`

**Interfaces:**

- Consumes: `$S/cmp/legacy/{ours.mjs,ref.mjs,stats.mjs}` and `$S/cmp/legacy/floor/` (no-effect captures of `secret-rare` sm115-69 and `radiant-holo` swsh10.5-004 at (0.3, 0.3) and (0.7, 0.7)).
- Produces: `textures.mjs` (our textures as PNGs), `ref.mjs` with `SHARED=1`, `stats.mjs` reporting a luminance gap and a chroma gap per effect and point, and the floors.

- [ ] **Step 1: Export our textures**

```js
// textures.mjs — our generated textures as PNGs, rendered by the dev server's own makeTexture.
//   node textures.mjs glitter geometric trainerbg  ->  tex/<name>.png
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const {
  chromium,
} = require('/Users/mason.nguyencaominhanh/Mason_Workspace/ncam/node_modules/.pnpm/playwright@1.58.0/node_modules/playwright');
const names = process.argv.slice(2);
const OUT = new URL('./tex/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:9107/', { waitUntil: 'networkidle' });
const urls = await page.evaluate(async (names) => {
  const m = await import('/src/holo/textures.ts');
  return Object.fromEntries(names.map((n) => [n, m.makeTexture(n).toDataURL('image/png')]));
}, names);
for (const [name, url] of Object.entries(urls))
  await writeFile(`${OUT}${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
```

Run: `node textures.mjs glitter geometric trainerbg`; expect three PNGs of 630×540, 300×300, 208×208 (`file tex/*.png`).

- [ ] **Step 2: ref.mjs, shared mode**

Copy `$S/cmp/legacy/ref.mjs` to `$S/cmp/shine/ref.mjs`, import `SAMPLES`/`POINTS` from `../legacy/ours.mjs`, and before `page.goto` add:

```js
const REFERENCE_IMAGE = {
  glitter: 'glitter.png',
  geometric: 'geometric.png',
  trainerbg: 'trainerbg.png',
};
if (process.env.SHARED) {
  for (const [ours, theirs] of Object.entries(REFERENCE_IMAGE)) {
    const body = await readFile(new URL(`./tex/${ours}.png`, import.meta.url));
    await page.route(`**/img/${theirs}`, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body }),
    );
  }
}
```

(A fresh browser per run keeps the cache from answering first.)

- [ ] **Step 3: stats.mjs with chroma**

Copy `$S/cmp/legacy/stats.mjs`; in the page function also collect, per region, `Math.max(r, g, b) - Math.min(r, g, b)` for each pixel into `chroma`, sort, and return `{ lum: [p10, p50, p97], chroma: [p10, p50, p97] }`; print per effect and point `lum gap` and `chroma gap` (mean absolute difference across the 3 regions × 3 percentiles, as now), reading `ours-*` and `ref-*` from `TAG`'s directory. Run it on `TAG=../legacy/floor` to print the floors.

- [ ] **Step 4: Record the "before"**

Run: `ONLY=secret-rare,radiant-holo TAG=shine-before node ../legacy/ours.mjs` (writes to `../legacy/shine-before/`; move the files to `$S/cmp/shine/shine-before/`), then `ONLY=secret-rare,radiant-holo TAG=shine-before node ref.mjs` (own textures) and `node stats.mjs` for both. Note the four lum and chroma gaps and the floors in the ledger (`.superpowers/sdd/2026-09-21-holodex-holo-v2/progress.md`).

---

### Task 9: Port secret-rare's shine

**Files:**

- Modify: `apps/holodex/src/holo/effects/secret-rare.ts`
- Create: `apps/holodex/src/holo/effects/legacy-shines.test.ts`

**Interfaces:**

- Consumes: Tasks 4, 5 and 7.

- [ ] **Step 1: Write the failing test** (values copied by hand from `secret-rare.css`, never computed with `css.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { BLEND_ID } from '../shader/blend';
import type { Effect, Element, GradientStop, Layer } from '../shader/types';
import { EFFECTS } from './index';

const kinds = (el: Element) => el.layers.map((l: Layer) => `${l.source.kind} ${l.blend}`);
const stopsOf = (layer: Layer): GradientStop[] =>
  'stops' in layer.source && layer.source.kind.startsWith('css-')
    ? (layer.source.stops as GradientStop[])
    : [];

describe('secret-rare’s shine, as secret-rare.css draws it unmasked', () => {
  const effect: Effect = EFFECTS['secret-rare'];
  const [shine] = effect.shine;

  it('is one group, colour-dodged through the unmasked filter', () => {
    expect(effect.shine).toHaveLength(1);
    expect(shine.mixBlend).toBe('color-dodge');
    expect(shine.filter).toEqual({
      brightness: { base: 0.2, fromCenter: 0.3 },
      contrast: { base: 2 },
      saturate: { base: 0.75 },
    });
  });

  it('stacks its background bottom first: radial, conic, then both glitters', () => {
    expect(kinds(shine)).toEqual([
      'css-radial normal',
      'css-conic overlay',
      'glitter hard-light',
      'glitter soft-light',
    ]);
    expect(stopsOf(shine.layers[0])).toEqual([
      { at: 0.1, color: [0, 0, 0], alpha: 0.98 },
      { at: 0.9, color: [0.95, 0.95, 0.95], alpha: 0.15 },
    ]);
    expect(stopsOf(shine.layers[1]).map((s) => s.at)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(shine.layers[2].size).toEqual([4, 4]);
  });

  it('paints :before, then :after', () => {
    const [before, after] = shine.children ?? [];
    expect(kinds(before)).toEqual([
      'css-radial normal',
      'css-linear multiply',
      'geometric hard-light',
    ]);
    expect(before.mixBlend).toBe('lighten');
    expect(before.opacity).toEqual({ base: 0.8 });
    expect(before.filter).toEqual({
      brightness: { base: 1.25 },
      contrast: { base: 1.25 },
      saturate: { base: 0.35 },
    });
    expect(stopsOf(before.layers[0])).toEqual([
      { at: 0.1, color: expect.any(Array), alpha: 0.95 },
      { at: 0.7, color: [0, 0, 0] },
    ]);
    expect(kinds(after)).toEqual(['glitter normal']);
    expect(after.mixBlend).toBe('overlay');
    expect(after.filter).toEqual({
      brightness: { base: 0.6, fromCenter: 0.6 },
      contrast: { base: 1.5 },
      saturate: { base: 1 },
    });
  });

  it('keeps its glare beneath, as ported', () => {
    expect(effect.beneath).toHaveLength(1);
    expect(effect.beneath?.[0].mixBlend).toBe('hard-light');
    expect(BLEND_ID[shine.mixBlend]).toBe(BLEND_ID['color-dodge']);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/holo/effects/legacy-shines.test.ts`
Expected: FAIL (today's shine is two derived elements).

- [ ] **Step 3: Port it** (secret-rare.ts, replacing `shine` and the header; `beneath` unchanged)

```ts
import type { Effect, PointerDriven } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  BLACK,
  CENTER,
  COVER,
  POINTER_X,
  POINTER_Y,
  autoHeight,
  exactConic,
  exactLinear,
  exactRadial,
  fixed,
  fixedFilter,
  grey,
  hsl,
  plus,
  pxTall,
  pxWide,
  radial,
  stop,
  sunpillarClr,
  texture,
  times,
} from './css';
import { glareNeutral } from './legacy-glare';

/** secret-rare.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1.3, contrast: 1.5 };

/** --glittersize: 25% of the card each way. */
const GLITTER: [number, number] = [0.25, 0.25];

/** .card__shine's own sunpillars: base.css starts --sunpillar-clr-1 at --sunpillar-1. */
const [S1, , , S4, S5, S6] = sunpillarClr(1);

/**
 * background-position `calc(50% - (var(--shift) * 2) * <pointer> + var(--shift))`
 * for an image `size` of the card: centred, then nudged `shift` against the
 * pointer (--shift: 1px, at CARD_PX).
 */
const nudged = (pointer: PointerDriven, shift: number, size: number): PointerDriven =>
  plus(CENTER, times(plus(fixed(shift), times(pointer, -2 * shift)), 1 / (1 - size)));

/**
 * A secret rare, ported from pokemon-cards-css's secret-rare.css on its
 * unmasked path (css.ts has the conversions): one group — conic sunpillars
 * overlaid on a dark radial under two glitters — with a gold `:before`
 * (geometric, the unmasked --foil, hard-lit on a gold linear and a pale
 * radial, lightened) and a glitter `:after` overlaid, the whole colour-dodged.
 * The glare is ported too, hard-lit beneath the shine (legacy-glare.ts).
 *
 * Approximations:
 * - The glitter and geometric sheets are drawn here (textures.ts), not the
 *   reference's images.
 * - --shift's 1px is at CARD_PX.
 */
export const secretRare: Effect = {
  id: 'secret-rare',
  shine: [
    {
      layers: [
        { ...exactRadial([stop(BLACK, 10, 0.98), stop(grey(0.95), 90, 0.15)]), blend: 'normal' },
        {
          ...exactConic([stop(S4, 0), stop(S5, 25), stop(S6, 50), stop(S1, 75), stop(S4, 100)]),
          blend: 'overlay',
        },
        {
          ...texture('glitter', { size: GLITTER, position: [fixed(0.55), fixed(0.55)] }),
          blend: 'hard-light',
        },
        {
          ...texture('glitter', { size: GLITTER, position: [fixed(0.45), fixed(0.45)] }),
          blend: 'soft-light',
        },
      ],
      children: [
        {
          // :before
          layers: [
            { ...exactRadial([stop(hsl(10, 20, 90), 10, 0.95), stop(BLACK, 70)]), blend: 'normal' },
            {
              ...exactLinear(45, [stop(hsl(46, 95, 50), 0), stop(hsl(52, 100, 69), 100)]),
              blend: 'multiply',
            },
            {
              ...texture('geometric', {
                size: autoHeight(0.33, TEXTURE_SIZE.geometric),
                position: [CENTER, CENTER],
              }),
              blend: 'hard-light',
            },
          ],
          filter: fixedFilter({ brightness: 1.25, contrast: 1.25, saturate: 0.35 }),
          mixBlend: 'lighten',
          opacity: fixed(0.8),
        },
        {
          // :after
          layers: [
            {
              ...texture('glitter', {
                size: GLITTER,
                position: [
                  nudged(POINTER_X, pxWide(1), GLITTER[0]),
                  nudged(POINTER_Y, pxTall(1), GLITTER[1]),
                ],
              }),
              blend: 'normal',
            },
          ],
          filter: {
            brightness: { base: 0.6, fromCenter: 0.6 },
            contrast: fixed(1.5),
            saturate: fixed(1),
          },
          mixBlend: 'overlay',
        },
      ],
      filter: {
        brightness: { base: 0.2, fromCenter: 0.3 },
        contrast: fixed(2),
        saturate: fixed(0.75),
      },
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [/* unchanged */],
  glare: [],
};
```

(Keep the existing `beneath` element verbatim; drop the `SUNPILLAR` import from `palette.ts`. If `fixedFilter` returns `saturate: fixed(1)` where the test expects none, the test's value is the source of truth for the CSS — adjust the code, not the test.)

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/holo && pnpm typecheck`
Expected: PASS; `unchanged.test.ts` holds (secret-rare's glare block untouched).

- [ ] **Step 5: Look, then measure**

With 9107 running: `ONLY=secret-rare TAG=shine-pilot node $S/cmp/legacy/ours.mjs` (look for `holo.compile-failed` in its output — there must be none), move the captures to `$S/cmp/shine/shine-pilot/`, then `ONLY=secret-rare TAG=shine-pilot SHARED=1 node ref.mjs` and `node stats.mjs`. Record the gaps against the floor. Build a side-by-side (`$S/tex/side.mjs`) and look at it.

- [ ] **Step 6: Commit** — `feat(holodex): port secret-rare's shine from pokemon-cards-css`

---

### Task 10: Port radiant-holo's shine

**Files:**

- Modify: `apps/holodex/src/holo/effects/radiant-holo.ts`, `apps/holodex/src/holo/effects/legacy-shines.test.ts`

- [ ] **Step 1: Write the failing test** (append; values from `radiant-holo.css`)

```ts
describe('radiant-holo’s shine, as radiant-holo.css draws it unmasked', () => {
  const effect: Effect = EFFECTS['radiant-holo'];
  const [shine] = effect.shine;

  it('is one group, colour-dodged through its filter', () => {
    expect(effect.shine).toHaveLength(1);
    expect(shine.mixBlend).toBe('color-dodge');
    expect(shine.filter).toEqual({
      brightness: { base: 0.5 },
      contrast: { base: 2 },
      saturate: { base: 1.75 },
    });
  });

  it('crosses two sets of grey bars under a glowing ellipse', () => {
    expect(kinds(shine)).toEqual([
      'css-linear normal',
      'css-linear darken',
      'css-radial exclusion',
    ]);
    for (const layer of shine.layers.slice(0, 2)) {
      const stops = stopsOf(layer);
      expect(stops).toHaveLength(21);
      expect(stops.map((s) => +s.color[0].toFixed(3))).toEqual([
        0.1, 0.1, 0.1, 0.2, 0.2, 0.35, 0.35, 0.425, 0.425, 0.5, 0.5, 0.425, 0.425, 0.35, 0.35, 0.2,
        0.2, 0.1, 0.1, 0, 0,
      ]);
      expect(stops[0].at).toBe(0);
      expect(stops[20].at).toBe(1);
      expect(layer.source.kind === 'css-linear' && layer.source.repeating).toBe(true);
    }
    const ellipse = shine.layers[2].source;
    expect(ellipse.kind === 'css-radial' && ellipse.ellipse).toBe(true);
    expect(stopsOf(shine.layers[2])).toEqual([
      { at: 0.2, color: [0.95, 0.95, 0.95] },
      { at: 1.3, color: [0, 0, 0], glow: 1 },
    ]);
  });

  it('paints :after (z-index auto) before :before (z-index 2)', () => {
    const [after, before] = shine.children ?? [];
    expect(kinds(after)).toEqual(['css-linear normal', 'trainerbg difference']);
    expect(after.mixBlend).toBe('color-dodge');
    expect(after.clip).toBe('regular');
    expect(after.filter).toEqual({
      brightness: { base: 0.6 },
      contrast: { base: 3 },
      saturate: { base: 2 },
    });
    expect(stopsOf(after.layers[0])).toHaveLength(7);
    expect(kinds(before)).toEqual(['css-radial normal', 'glitter color-dodge']);
    expect(before.mixBlend).toBe('overlay');
    expect(before.filter).toEqual({
      brightness: { base: 0.66 },
      contrast: { base: 2 },
      saturate: { base: 0.5 },
    });
    expect(stopsOf(before.layers[0]).map((s) => [s.at, s.alpha])).toEqual([
      [0.1, 0.8],
      [0.2, 0.9],
      [0.5, 0.5],
    ]);
    expect(before.layers[1].size).toEqual([1 / 0.15, 1 / 0.15]);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/holo/effects/legacy-shines.test.ts`
Expected: FAIL.

- [ ] **Step 3: Port it** (radiant-holo.ts; `beneath` unchanged)

```ts
import type { Effect, PointerDriven } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  CENTER,
  COVER,
  POINTER_X,
  POINTER_Y,
  WHITE,
  autoHeight,
  exactRadial,
  exactRepeatingLinear,
  fixed,
  fixedFilter,
  glowStop,
  gradientLengthPx,
  grey,
  hsl,
  plus,
  radial,
  stop,
  texture,
  times,
  type CssBox,
  type CssStop,
} from './css';
import { glareNeutral } from './legacy-glare';

/** radiant-holo.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1.5 };

/** --barwidth, as a percentage of the gradient line. */
const BARWIDTH = 1.2;
const BAR_GREYS = [0.1, 0.2, 0.35, 0.425, 0.5, 0.425, 0.35, 0.2, 0.1, 0];

/**
 * The bars exactly as the CSS writes them: 10% grey at 0% and 1%, then each
 * grey held for one --barwidth, starting 0.01% after the last ends.
 */
function bars(): CssStop[] {
  const stops = [stop(grey(0.1), 0), stop(grey(0.1), 1)];
  BAR_GREYS.forEach((g, i) => {
    if (i > 0) stops.push(stop(grey(g), BARWIDTH * i + 0.01));
    stops.push(stop(grey(g), BARWIDTH * (i + 1)));
  });
  return stops;
}

/** `calc(((var(--background-x) - 50%) * k) + 50%)` */
const around = (p: PointerDriven, k: number): PointerDriven =>
  plus(times(p, k), fixed(0.5 - 0.5 * k));

/** Both bar images: 210% of the card, moving half as far again as --background. */
const BARS: CssBox = {
  size: [2.1, 2.1],
  position: [around(BACKGROUND_X, 1.5), around(BACKGROUND_Y, 1.5)],
};

/** `at calc((var(--pointer-x) * 0.5) + 25%) …`: the ellipses follow the pointer half as far. */
const HALFWAY: [PointerDriven, PointerDriven] = [
  plus(fixed(0.25), times(POINTER_X, 0.5)),
  plus(fixed(0.25), times(POINTER_Y, 0.5)),
];

/** :after's rainbow: 400% × 100%, running 2.5 times as far as --background, the other way. */
const RAINBOW: CssBox = {
  size: [4, 1],
  position: [around(BACKGROUND_X, -2.5), around(BACKGROUND_Y, -2.5)],
};
/** --space: 200px, along that rainbow's 55° line at CARD_PX. */
const SPACE = (200 / gradientLengthPx(55, RAINBOW)) * 100;
const RAINBOW_STOPS: CssStop[] = [
  hsl(3, 95, 85),
  hsl(207, 100, 84),
  hsl(29, 100, 85),
  hsl(160, 100, 86),
  hsl(309, 94, 87),
  hsl(188, 95, 85),
  hsl(3, 95, 85),
].map((color, i) => stop(color, SPACE * (i + 1)));

/**
 * A radiant rare, ported from pokemon-cards-css's radiant-holo.css on its
 * unmasked path (css.ts has the conversions): grey bars crossed at ±45°
 * darkened together, under an ellipse of near-white running out to the
 * card's type glow (--card-glow, uCardGlow), excluded; then its `:after`
 * (trainerbg, the unmasked --foil, differenced onto a pastel rainbow,
 * colour-dodged, kept to the art window) and, above it by z-index, its
 * `:before` (glitter dodged onto a dark ellipse, overlaid), the whole group
 * colour-dodged inside the card's borders. The glare is ported too,
 * hard-lit beneath the shine (legacy-glare.ts).
 *
 * Approximations:
 * - trainerbg and glitter are drawn here (textures.ts), not the reference's
 *   images.
 * - --space's 200px is at CARD_PX.
 */
export const radiantHolo: Effect = {
  id: 'radiant-holo',
  shine: [
    {
      layers: [
        { ...exactRepeatingLinear(-45, bars(), BARS), blend: 'normal' },
        { ...exactRepeatingLinear(45, bars(), BARS), blend: 'darken' },
        {
          ...exactRadial([stop(grey(0.95), 20), glowStop(130)], COVER, {
            at: HALFWAY,
            ellipse: true,
          }),
          blend: 'exclusion',
        },
      ],
      children: [
        {
          // :after (z-index auto), in the art window
          layers: [
            { ...exactRepeatingLinear(55, RAINBOW_STOPS, RAINBOW), blend: 'normal' },
            {
              ...texture('trainerbg', {
                size: autoHeight(0.25, TEXTURE_SIZE.trainerbg),
                position: [CENTER, CENTER],
              }),
              blend: 'difference',
            },
          ],
          filter: fixedFilter({ brightness: 0.6, contrast: 3, saturate: 2 }),
          mixBlend: 'color-dodge',
          clip: 'regular',
        },
        {
          // :before (z-index 2)
          layers: [
            {
              ...exactRadial(
                [stop(grey(0.58), 10, 0.8), stop(grey(0.2), 20, 0.9), stop(grey(0.2), 50, 0.5)],
                { size: [3.5, 3.5], position: [CENTER, CENTER] },
                { at: HALFWAY, ellipse: true },
              ),
              blend: 'normal',
            },
            {
              ...texture('glitter', { size: [0.15, 0.15], position: [CENTER, CENTER] }),
              blend: 'color-dodge',
            },
          ],
          filter: fixedFilter({ brightness: 0.66, contrast: 2, saturate: 0.5 }),
          mixBlend: 'overlay',
        },
      ],
      filter: fixedFilter({ brightness: 0.5, contrast: 2, saturate: 1.75 }),
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [/* unchanged */],
  glare: [],
};
```

(`fixedFilter` returns all three terms; where the test lists a CSS filter with two, the third is CSS's default 1 — make the test list it too, copied from the CSS, rather than special-case the code.)

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/holo && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Look, then measure** — as Task 9 Step 5, with `ONLY=radiant-holo` (a Grass card, so its glow is green).

- [ ] **Step 6: Commit** — `feat(holodex): port radiant-holo's shine from pokemon-cards-css`

---

### Task 11: The pilot gate

- [ ] **Step 1: Measure both**

`ONLY=secret-rare,radiant-holo TAG=shine-pilot node $S/cmp/legacy/ours.mjs` (captures into place), then `SHARED=1 node ref.mjs` and `node stats.mjs`; separately the reference with its own textures (no `SHARED`) into `shine-pilot-own/`.

- [ ] **Step 2: Decide**

The pilot **passes** when, with shared textures, each effect's lum gap and chroma gap at both points are within 1.5 × that point's floor (from `../legacy/floor`). Record every number and the own-texture numbers beside the "before" (Task 8 Step 4) in the ledger.

- If it passes: continue with Step 3.
- If it misses: stop. Examine the worst region first (decompose with injected CSS on the reference and `children: []` on ours, as AGENTS.md describes); if the cause is a port error, fix it and re-measure; otherwise document the DSL additions and the numbers in `apps/holodex/AGENTS.md`, commit, and report to the owner with the side-by-sides. Do not start the other twenty.

- [ ] **Step 3: Verify the tree**

From the repo root: `pnpm vitest run`, `pnpm lint`, `pnpm --filter @ncam/holodex typecheck`, `npx prettier --check apps/holodex docs/superpowers`. From `apps/holodex`: `rm -rf dist dist-ssr && pnpm build`, then the split check (AGENTS.md: 2 matches, 1 client) and the lazy chunk's gz size under 170 KB.

- [ ] **Step 4: GPU smoke on 9107**

`/card/sm115-69` and `/card/swsh10.5-004`: canvas shown, art `invisible`, `data-effect` right, no `holo.compile-failed` in the console; a `WEBGL_lose_context` lose/restore on each rebuilds a fresh canvas. `/effects/secret-rare` and `/effects/radiant-holo`: the live tile draws.

- [ ] **Step 5: Show the owner** — side-by-sides of ours and the reference (own textures) for both, at both points, sent to the owner with the numbers.

- [ ] **Step 6: Commit** the ledger note only if anything in the repo changed (it is gitignored); otherwise nothing to commit.

---

### Task 12: Plan the other twenty

- [ ] **Step 1:** With the pilot passed, write `docs/superpowers/plans/2026-09-25-holodex-legacy-shine-ports-rest.md` for the spec's remaining order of work — the illusion trio; v-star; v-max and trainer-gallery-v-max; the glitter family; v-regular and trainer-gallery-v-regular; cosmos-holo; regular-holo, reverse-holo, trainer-full-art, trainer-gallery-holo; basic — plus the remaining textures (grain redrawn, illusion, illusion-mask, ancient, vmaxbg, the three cosmos layers, with `ALPHA_TEXTURES`), the clip agreements (each shine's CSS clip-path against `select.ts`'s `ClipShape`), `palette.ts`'s retirement and the docs. Each port task carries its CSS transcribed as Tasks 9 and 10 do.
- [ ] **Step 2:** Commit it (`docs(holodex): plan the rest of the legacy shine ports`) and execute it.
