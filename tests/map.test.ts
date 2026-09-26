import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { regionMatchesPressureSlot, REGIONS, ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig } from '../src/engine/types'

const CONFIG: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ALL_REGION_IDS }

// SPEC 10.2: "Tapping [a Squeeze/Expand/Scout card] highlights the matching regions on the map" — the
// plan-strip buttons (src/ui/Game.tsx) and the map's own SQUEEZE/EXPAND badges (src/ui/Map.tsx) both use
// this one region-type match, so this only needs testing once, at the data level.
describe('regionMatchesPressureSlot', () => {
  it('matches a region whose type is named by the given slot\'s card, and not one that isn\'t', () => {
    const state = createGame(CONFIG, 5)
    for (const slot of ['squeeze', 'expand', 'scout'] as const) {
      const card = state[slot]
      if (!card) continue
      for (const id of ALL_REGION_IDS) {
        const expected = card.regionTypes.includes(REGIONS[id].type)
        expect(regionMatchesPressureSlot(state, id, slot)).toBe(expected)
      }
    }
  })

  it('returns false for every region when the slot has no card', () => {
    const state = createGame(CONFIG, 5)
    const noCardState = { ...state, scout: null }
    for (const id of ALL_REGION_IDS) {
      expect(regionMatchesPressureSlot(noCardState, id, 'scout')).toBe(false)
    }
  })
})
