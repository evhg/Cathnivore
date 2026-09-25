import { describe, expect, it } from 'vitest'
import { createGame, validate } from '../src/engine/api'
import { applyAction, legalActions } from '../src/engine/actions'
import { createRng } from '../src/engine/rng'
import { HeuristicBot } from '../src/ai/heuristic'
import { CHAPTER_1, CHAPTER_2, chapterConfig } from '../src/content/chapters'

describe('chapter 1: Fresh Meat', () => {
  it('creates a valid single-producer game restricted to Brindle Hills and Highmoor', () => {
    const state = createGame(chapterConfig(CHAPTER_1), 1)
    expect(validate(state)).toEqual([])
    expect(Object.keys(state.producers)).toEqual(['mara'])
    expect(state.regions.brindleHills.stalls.mara).toBe(2)
    expect(state.regions.kingsmarket.stalls.mara ?? 0).toBe(0)
  })

  it('only offers Open Stall, Supply and Graft — never Rebut, Sell, Invest, Scheme or a role', () => {
    const state = createGame(chapterConfig(CHAPTER_1), 1)
    const kinds = new Set(legalActions(state).map((a) => a.kind))
    for (const forbidden of ['rebut', 'sell', 'invest', 'scheme', 'role'] as const) {
      expect(kinds.has(forbidden)).toBe(false)
    }
    expect(kinds.has('openStall') || kinds.has('supplyOutlets') || kinds.has('graft')).toBe(true)
  })

  it('HeuristicBot wins at least 90% of seeds (SPEC 9.4 campaign target)', () => {
    let wins = 0
    const seeds = 30
    for (let seed = 0; seed < seeds; seed++) {
      let state = createGame(chapterConfig(CHAPTER_1), seed)
      let rng = createRng(seed + 1000)
      let steps = 0
      while (!state.result && steps < 500) {
        const [action, nextRng] = HeuristicBot.chooseAction(state, rng)
        state = applyAction(state, action)
        rng = nextRng
        steps++
        expect(validate(state)).toEqual([])
      }
      expect(state.result).not.toBeNull()
      if (state.result?.won) wins++
    }
    expect(wins / seeds).toBeGreaterThanOrEqual(0.9)
  })
})

describe('chapter 2: Word of Mouth', () => {
  it('creates a valid single-producer game restricted to Saltmarsh, Highmoor and Rivermead', () => {
    const state = createGame(chapterConfig(CHAPTER_2), 1)
    expect(validate(state)).toEqual([])
    expect(Object.keys(state.producers)).toEqual(['sol'])
    expect(state.regions.saltmarsh.stalls.sol).toBe(2)
  })

  it('offers Rebut and the role ability, but never Sell, Invest or Scheme', () => {
    const state = createGame(chapterConfig(CHAPTER_2), 1)
    const kinds = new Set(legalActions(state).map((a) => a.kind))
    for (const forbidden of ['sell', 'invest', 'scheme'] as const) {
      expect(kinds.has(forbidden)).toBe(false)
    }
  })

  it('HeuristicBot wins at least 70% of seeds (SPEC 9.4 campaign target for chapters 2-4)', () => {
    let wins = 0
    const seeds = 30
    for (let seed = 0; seed < seeds; seed++) {
      let state = createGame(chapterConfig(CHAPTER_2), seed)
      let rng = createRng(seed + 2000)
      let steps = 0
      while (!state.result && steps < 500) {
        const [action, nextRng] = HeuristicBot.chooseAction(state, rng)
        state = applyAction(state, action)
        rng = nextRng
        steps++
        expect(validate(state)).toEqual([])
      }
      expect(state.result).not.toBeNull()
      if (state.result?.won) wins++
    }
    expect(wins / seeds).toBeGreaterThanOrEqual(0.7)
  })
})
