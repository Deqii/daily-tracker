/** Result of a deterministic toss: a seeded, uniform value in [0, 1). */
export type Random = () => number;

/** 32-bit FNV-1a hash of a string, returned as an unsigned integer. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** Mulberry32, a seeded PRNG whose whole stream is determined by `seed`. */
export function mulberry32(seed: number): Random {
  let state = seed | 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
