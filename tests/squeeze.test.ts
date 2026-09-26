import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { resolveSqueeze } from '../src/engine/enemy'
import type { GameConfig, PressureCard } from '../src/engine/types'

// SPEC 4.7 Squeeze: "...also remove 1 Stall there, from the producer with the most Stalls in that region
// (on a tie, the current first player)." Regression test for a bug where the tie-break used object
// key-insertion order (whoever opened a Stall in the region first, ever) instead of the current first
// player.

const CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ['brindleHills', 'oakvale'],
  scriptedStart: {
    regions: {
      // tomas's Stall goes in before mara's, so an insertion-order tie-break would pick tomas even when
      // mara is the current first player.
      brindleHills: { stalls: { tomas: 1, mara: 1 }, outlets: 6 },
    },
  },
}

describe('Squeeze stall-loss tie-break (SPEC 4.7)', () => {
  it('removes the current first player\'s Stall on a tie, not whichever producer opened one first', () => {
    let state = createGame(CONFIG, 1)
    const pastureCard: PressureCard = { id: 'test-pasture', stage: 1, regionTypes: ['pasture'] }
    state = { ...state, squeeze: pastureCard, firstPlayer: 'mara' }
    expect(state.regions.brindleHills.stalls.tomas).toBe(1)
    expect(state.regions.brindleHills.stalls.mara).toBe(1)

    const result = resolveSqueeze(state)

    expect(result.regions.brindleHills.stalls.mara).toBe(0)
    expect(result.regions.brindleHills.stalls.tomas).toBe(1)
  })

  it('removes the other producer\'s Stall on a tie when they are the current first player instead', () => {
    let state = createGame(CONFIG, 1)
    const pastureCard: PressureCard = { id: 'test-pasture', stage: 1, regionTypes: ['pasture'] }
    state = { ...state, squeeze: pastureCard, firstPlayer: 'tomas' }

    const result = resolveSqueeze(state)

    expect(result.regions.brindleHills.stalls.tomas).toBe(0)
    expect(result.regions.brindleHills.stalls.mara).toBe(1)
  })
})
