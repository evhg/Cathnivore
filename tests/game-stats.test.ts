import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { countGameStats } from '../src/engine/pieces'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, GameEvent } from '../src/engine/types'

const CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// SPEC 4.8: the end screen's "cards bought and schemes played" stats, derived from the log rather than a
// separately tracked counter (see `countGameStats`'s own comment for why).
describe('countGameStats (SPEC 4.8 end-screen stats)', () => {
  it('is zero for a fresh game', () => {
    const state = createGame(CONFIG, 1)
    expect(countGameStats(state)).toEqual({ cardsBought: 0, schemesPlayed: 0 })
  })

  it('counts invest and schemePlayed events, ignoring every other log entry', () => {
    const state = createGame(CONFIG, 1)
    const log: GameEvent[] = [
      { type: 'invest', producer: 'mara', improvementId: 'farm-shop' },
      { type: 'schemePlayed', producer: 'mara', schemeId: 'loss-leader', target: null },
      { type: 'invest', producer: 'tomas', improvementId: 'oyster-beds' },
      { type: 'liberated', region: 'brindleHills', producer: 'mara' },
      { type: 'schemePlayed', producer: 'tomas', schemeId: 'grass-roots', target: 'oakvale' },
    ]
    expect(countGameStats({ ...state, log })).toEqual({ cardsBought: 2, schemesPlayed: 2 })
  })
})
