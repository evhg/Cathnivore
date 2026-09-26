import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { evaluate } from '../src/ai/evaluation'
import { ALL_REGION_IDS, REGIONS } from '../src/content/map'
import type { GameConfig, GameState } from '../src/engine/types'

const CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

function baseState(): GameState {
  return createGame(CONFIG, 1)
}

// SPEC 9.2 credits HeuristicBot's evaluation with "protecting regions in the Squeeze and Expand slots" —
// only the Squeeze half had a matching term (`squeezeCoverageScore`) until this test's fix. Expand's own
// rule (4.7) only escalates a region that "has at least 1 enemy piece" there already, so the matching
// defensive signal is having *cleared* an Expand-targeted region, not having a Stall in it.
describe('evaluate expand coverage', () => {
  it('scores higher when an Expand-targeted region has no enemy pieces left', () => {
    const state = baseState()
    const target = ALL_REGION_IDS.find((id) => id !== 'kingsmarket' && state.regions[id].outlets > 0)!

    const withExpandTarget: GameState = {
      ...state,
      expand: { id: 'pressure-2-1', stage: 2, regionTypes: [REGIONS[target].type] },
    }
    const cleared: GameState = {
      ...withExpandTarget,
      regions: { ...withExpandTarget.regions, [target]: { ...withExpandTarget.regions[target], outlets: 0, buyouts: 0, doubt: 0 } },
    }
    expect(evaluate(cleared)).toBeGreaterThan(evaluate(withExpandTarget))
  })

  it('treats no active Expand slot the same as full coverage (no penalty)', () => {
    const withoutExpand: GameState = { ...baseState(), expand: null }
    const target = ALL_REGION_IDS.find((id) => id !== 'kingsmarket' && withoutExpand.regions[id].outlets > 0)!
    const clearedNoExpand: GameState = {
      ...withoutExpand,
      regions: { ...withoutExpand.regions, [target]: { ...withoutExpand.regions[target], outlets: 0, buyouts: 0, doubt: 0 } },
    }
    // Clearing a region does other, unrelated things too (enemyPieces, production via later actions —
    // here it's a pure piece removal), so compare against the same clear *with* an Expand slot whose
    // (empty) region-type list can't match anything at all, isolating the "no Expand slot" vs. "an Expand
    // slot that can't reach here" cases, both of which should score identically (full coverage, vacuously).
    const nonMatchingExpand: GameState = { ...clearedNoExpand, expand: { id: 'pressure-2-1', stage: 2, regionTypes: [] } }
    expect(evaluate(clearedNoExpand)).toBe(evaluate(nonMatchingExpand))
  })
})
