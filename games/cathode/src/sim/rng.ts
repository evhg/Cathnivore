// CATHODE's seeded random numbers. Every roll in the rules (loot, crits, elite modifiers, enemy names)
// goes through an `Rng`, so a seed reproduces a drop, a fight or the weekly Most Wanted contract exactly,
// in tests, in the browser and on every phone. The generator is mulberry32: 32 bits of state, fast, and
// good enough for games. Its whole state is one number, so a save can store it and resume the stream.

/** A seeded stream of random numbers. `state` is the mulberry32 state; copy it to fork or save the stream. */
export interface Rng {
  /** The generator's internal state (a uint32). Saving it and passing it to `createRng` resumes the stream. */
  state: number;
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [lo, hi], both inclusive. */
  int(lo: number, hi: number): number;
  /** A float in [lo, hi). */
  float(lo: number, hi: number): number;
  /** True with probability `p` (clamped to 0..1). */
  chance(p: number): boolean;
  /** A uniformly chosen element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** An element chosen with probability proportional to its weight. Throws if every weight is 0. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** A Fisher-Yates shuffled copy. */
  shuffle<T>(items: readonly T[]): T[];
  /** A new independent stream derived from this one (advances this stream by one step). */
  fork(): Rng;
}

/** Hashes a string (a contract name, a week number) into a 32-bit seed with FNV-1a. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Creates a stream from a numeric or string seed. The same seed always gives the same numbers. */
export function createRng(seed: number | string): Rng {
  const rng: Rng = {
    state: (typeof seed === "string" ? hashSeed(seed) : Math.floor(seed)) >>> 0,
    next() {
      // mulberry32 (Tommy Ettinger): a Weyl sequence through an xorshift-multiply mixer.
      rng.state = (rng.state + 0x6d2b79f5) >>> 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(lo, hi) {
      const a = Math.ceil(Math.min(lo, hi));
      const b = Math.floor(Math.max(lo, hi));
      return a + Math.floor(rng.next() * (b - a + 1));
    },
    float(lo, hi) {
      return lo + rng.next() * (hi - lo);
    },
    chance(p) {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return rng.next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error("pick from an empty list");
      return items[Math.floor(rng.next() * items.length)] as (typeof items)[number];
    },
    weighted(entries) {
      let total = 0;
      for (const [, w] of entries) total += Math.max(0, w);
      if (total <= 0) throw new Error("weighted pick with no positive weight");
      let roll = rng.next() * total;
      for (const [item, w] of entries) {
        if (w <= 0) continue;
        roll -= w;
        if (roll < 0) return item;
      }
      // Floating-point leftovers land on the last positive entry.
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e && e[1] > 0) return e[0];
      }
      throw new Error("unreachable");
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const tmp = out[i] as (typeof out)[number];
        out[i] = out[j] as (typeof out)[number];
        out[j] = tmp;
      }
      return out;
    },
    fork() {
      return createRng(Math.floor(rng.next() * 4294967296) ^ 0x9e3779b9);
    },
  };
  return rng;
}
