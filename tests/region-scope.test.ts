import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { regionsBorderingLiberated } from '../src/engine/region'
import { legalSchemeTargets } from '../src/content/schemes'
import type { GameConfig } from '../src/engine/types'

// A restricted-map campaign-style config (SPEC 8.1: chapters activate only a subset of the 7 regions).
// Brindle Hills borders Highmoor on the ring, but Highmoor is not active this "chapter".
const RESTRICTED_CONFIG: GameConfig = {
  producers: ['ines', 'tomas'],
  difficulty: 'normal',
  activeRegions: ['rivermead', 'shingleBay', 'oakvale', 'brindleHills', 'kingsmarket'],
}

// SPEC 8.1: a campaign chapter's inactive regions must never become a legal target, even when a card's
// wording ("any region bordering a liberated region," SPEC 5 "Grass Roots") would otherwise include one.
describe('region-scoped targeting respects a restricted activeRegions set', () => {
  it('regionsBorderingLiberated never returns an inactive region', () => {
    let state = createGame(RESTRICTED_CONFIG, 1)
    // Liberate Brindle Hills, whose ring neighbor Highmoor is inactive in this config.
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, stalls: { ines: 1 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    const targets = regionsBorderingLiberated(state)
    expect(targets).not.toContain('highmoor')
    for (const id of targets) expect(RESTRICTED_CONFIG.activeRegions).toContain(id)
  })

  it('"Grass Roots" never offers an inactive region as a legal Scheme target', () => {
    let state = createGame(RESTRICTED_CONFIG, 1)
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, stalls: { ines: 1 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    const targets = legalSchemeTargets(state, 'ines', 'grass-roots')
    expect(targets).not.toContain('highmoor')
  })
})
