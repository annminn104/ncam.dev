import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compileEffect } from '../shader/compile';
import { EFFECTS } from './index';
import type { EffectId } from '../select';

/**
 * The shine ports extend the compiler with an RGBA path, but promise that
 * every element using none of it compiles exactly as before. This holds them
 * to it: a digest of each block that must not move, recorded before the
 * compiler changed. A change here means an untouched effect's shader changed.
 */

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Everything an effect draws with: main() and the per-effect code in it. */
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

/** The other 21 older effects: their shines are re-ported, their glares stay as ported. */
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
    expect(pins).toMatchInlineSnapshot(`
      {
        "amazing-rare glare": "fa78a3396c21cb6c",
        "basic main()": "c90b8fd6a018e740",
        "cosmos-holo glare": "2380e0a01ae89da8",
        "ex-full-art main()": "ecb626e59e4bbeb9",
        "ex-regular main()": "066c8da37df5a529",
        "ex-special-illustration-rare main()": "feddf44b1b48e989",
        "hyper-rare main()": "bb75315e324dbf6c",
        "illustration-rare main()": "08112fe0dde99054",
        "masterball-holo main()": "c7fa6e50b1e6e6e1",
        "poke-ball-holo main()": "22dc3f582d1080a0",
        "radiant-holo glare": "fcb2275f01e0eff5",
        "rainbow-alt glare": "4cc12b53028b2a94",
        "rainbow-holo glare": "d0fcd1aed088f65b",
        "regular-holo glare": "d4c8796887f5fec0",
        "reverse-holo glare": "ee1dee0ed33704d4",
        "secret-rare glare": "146c76073bc49469",
        "shiny-rare glare": "8c56d4e8873b6e5f",
        "shiny-v glare": "341692e6398c324a",
        "shiny-vmax glare": "43aed43c2365dfb5",
        "sv-rare-holo main()": "67334f7469cfcccb",
        "swsh-pikachu glare": "4ecc6e844a382e19",
        "trainer-full-art glare": "23a8a279a0589420",
        "trainer-gallery-holo glare": "1bb17390f2a3484f",
        "trainer-gallery-secret-rare glare": "68fce98b18348ddd",
        "trainer-gallery-v-max glare": "5369c0a20485fa7c",
        "trainer-gallery-v-regular glare": "c8b6422df07137c2",
        "v-full-art glare": "e2885be9cf8d76dd",
        "v-max glare": "46ece0064356f34c",
        "v-regular glare": "a21040b593205274",
        "v-star glare": "fd6c09f6dcf855d4",
      }
    `);
  });
});
