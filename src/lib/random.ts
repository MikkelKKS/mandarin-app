export function shuffle<T>(arr: readonly T[], rnd = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: readonly T[], rnd = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export function sample<T>(arr: readonly T[], n: number, rnd = Math.random): T[] {
  return shuffle(arr, rnd).slice(0, n);
}

/** Small deterministic PRNG for tests. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
