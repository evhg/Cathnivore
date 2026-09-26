import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { AGENDA_CARDS_BY_ID } from '../src/content/agenda'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// SPEC 4.8: "Liberated regions ignore Scout and Expand. Agenda cards cannot place pieces there unless
// the card says 'even liberated regions.'" None of these three cards say that, so their piece-placing
// effects must never target a liberated region, even when it would otherwise be the chosen target
// (most/fewest Stalls, most Outlets).
describe('Agenda effects respect the liberated-region exemption (SPEC 4.8)', () => {
  it('"Candor-funded study finds \'natural\' is a risk factor\' bonus never adds Doubt to a liberated region', () => {
    let state = createGame(FULL_CONFIG, 1)
    // Give Brindle Hills (Mara's home) the most Stalls on the board and liberate it.
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, stalls: { mara: 3 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    const card = AGENDA_CARDS_BY_ID.get('candor-natural-risk-factor')!
    const after = card.bonusEffect!(state)
    expect(after.regions.brindleHills.doubt).toBe(0)
  })

  it('"Candor\'s study was peer-reviewed" effect never adds Doubt to a liberated region', () => {
    let state = createGame(FULL_CONFIG, 1)
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, stalls: { mara: 3 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    const card = AGENDA_CARDS_BY_ID.get('candor-peer-reviewed-by-us')!
    const after = card.effect(state)
    expect(after.regions.brindleHills.doubt).toBe(0)
  })

  it('"Sunny the Silo" bonus never adds a Buyout to a liberated region', () => {
    let state = createGame(FULL_CONFIG, 1)
    // Liberated regions always have 0 Outlets, so give a non-liberated region the most Outlets instead,
    // and confirm the liberated region (0 outlets, tied for "most" only if the reducer is unscoped) is
    // never targeted regardless.
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
        highmoor: { ...state.regions.highmoor, outlets: 3 },
      },
    }
    const card = AGENDA_CARDS_BY_ID.get('hollowell-sunny-the-silo')!
    const after = card.bonusEffect!(state)
    expect(after.regions.brindleHills.buyouts).toBe(0)
    expect(after.regions.highmoor.buyouts).toBe(1)
  })
})
