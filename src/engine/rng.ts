// mulberry32: a small, fast, seeded PRNG whose entire state is one 32-bit int.
// Used everywhere in the engine instead of Math.random so replays are deterministic.
export interface RngState {
  seed: number
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 }
}

// Advances the state and returns a float in [0, 1). Pure: returns a new state alongside the value,
// never writing to `rng` itself (SPEC 9.1: engine functions never mutate their input).
export function nextFloat(rng: RngState): [number, RngState] {
  const seed = (rng.seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, { seed }]
}

// Returns an integer in [0, max).
export function nextInt(rng: RngState, max: number): [number, RngState] {
  const [f, next] = nextFloat(rng)
  return [Math.floor(f * max), next]
}

// Fisher-Yates shuffle, pure: returns a new array and the advanced RNG state.
export function shuffle<T>(items: readonly T[], rng: RngState): [T[], RngState] {
  const result = items.slice()
  let state = rng
  for (let i = result.length - 1; i > 0; i--) {
    const [j, next] = nextInt(state, i + 1)
    state = next
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return [result, state]
}
