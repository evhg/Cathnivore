import { describe, expect, it } from 'vitest'
import { createRng, nextFloat, nextInt, shuffle } from '../src/engine/rng'

// SPEC 9.1: engine functions never mutate their input, and a seeded RNG makes replays deterministic.
// `nextFloat` used to do `rng.seed += 0x6d2b79f5`, mutating the caller's RngState object directly — a real
// bug, since `round.ts`'s `let rng = state.rng` aliases (doesn't copy) the state's own RngState, and
// anything else still holding that same `state` reference (e.g. Game.tsx's undo stack) would see its
// `rng.seed` silently change after the fact.
describe('RngState purity', () => {
  it('nextFloat never mutates its input RngState', () => {
    const rng = createRng(12345)
    const before = { ...rng }
    nextFloat(rng)
    expect(rng).toEqual(before)
  })

  it('nextInt never mutates its input RngState', () => {
    const rng = createRng(12345)
    const before = { ...rng }
    nextInt(rng, 10)
    expect(rng).toEqual(before)
  })

  it('shuffle never mutates its input RngState or input array', () => {
    const rng = createRng(12345)
    const before = { ...rng }
    const items = [1, 2, 3, 4, 5]
    const itemsBefore = [...items]
    shuffle(items, rng)
    expect(rng).toEqual(before)
    expect(items).toEqual(itemsBefore)
  })

  it('reusing the same RngState twice gives the same result both times', () => {
    const rng = createRng(999)
    const [a] = nextFloat(rng)
    const [b] = nextFloat(rng)
    expect(a).toBe(b)
  })

  it('is deterministic: the same seed always produces the same sequence', () => {
    const sequence = (seed: number): number[] => {
      let rng = createRng(seed)
      const out: number[] = []
      for (let i = 0; i < 5; i++) {
        const [value, next] = nextFloat(rng)
        out.push(value)
        rng = next
      }
      return out
    }
    expect(sequence(42)).toEqual(sequence(42))
    expect(sequence(42)).not.toEqual(sequence(43))
  })
})
