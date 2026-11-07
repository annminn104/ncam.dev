/**
 * A seeded xorshift32 stream: numbers in [0, 1), the same sequence for the same seed (a seed of 0,
 * a state xorshift never leaves, is taken as 1). The runtime maps and prints draw from it, so they
 * come out identical every time they are made.
 */
export function xorshift(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
