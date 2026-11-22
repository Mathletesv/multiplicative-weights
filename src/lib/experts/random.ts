/** Mulberry32 keeps demonstration runs repeatable across builds and browsers. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 0x100000000;
  };
}

export function freshSeed(previous: number): number {
  const draw = Math.floor(Math.random() * 0x100000000);
  return draw === previous ? (draw + 1) >>> 0 : draw;
}

export function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Draw from a Gaussian conditioned on the result falling in [0, 1]. */
export function sampleTruncatedGaussian(
  random: () => number,
  mean: number,
  standardDeviation: number,
): number {
  while (true) {
    const standardNormal = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
    const sample = mean + standardDeviation * standardNormal;
    if (sample >= 0 && sample <= 1) return sample;
  }
}
