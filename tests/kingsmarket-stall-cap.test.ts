import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { canOpenStallIn, canMarketDayOpenIn, kingsmarketOpen, stallCap, regionsBorderingLiberated } from '../src/engine/region'
import { legalSchemeTargets } from '../src/content/schemes'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, GameState } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['tomas', 'ines'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

function liberate(state: GameState, region: keyof GameState['regions']): GameState {
  return {
    ...state,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], stalls: { ines: 1 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
    },
  }
}

// SPEC 4.8: "Kingsmarket is guarded: nobody may place a Stall there, by any means, unless at least 2 of
// its neighbours are liberated." Kingsmarket borders all 6 outer regions (SPEC 4.2), so this is 2 of those 6.
describe('Kingsmarket guard (SPEC 4.8)', () => {
  it('is closed with 0 or 1 liberated neighbours, and opens at exactly 2', () => {
    let state = createGame(FULL_CONFIG, 1)
    expect(kingsmarketOpen(state)).toBe(false)
    state = liberate(state, 'highmoor')
    expect(kingsmarketOpen(state)).toBe(false) // only 1 neighbour liberated
    state = liberate(state, 'saltmarsh')
    expect(kingsmarketOpen(state)).toBe(true) // 2 neighbours liberated
  })

  it('blocks the normal Open Stall action into Kingsmarket while closed, and admits it once open', () => {
    let state = createGame(FULL_CONFIG, 1)
    // Give tomas a foothold in a Kingsmarket neighbour so adjacency is otherwise satisfied.
    state = { ...state, regions: { ...state.regions, highmoor: { ...state.regions.highmoor, stalls: { tomas: 1 } } } }
    expect(canOpenStallIn(state, 'tomas', 'kingsmarket')).toBe(false)
    expect(legalActions(state).some((a) => a.kind === 'openStall' && a.region === 'kingsmarket')).toBe(false)

    state = liberate(state, 'highmoor')
    state = liberate(state, 'saltmarsh')
    // liberate() above overwrote highmoor's tomas stall; give tomas adjacency via oakvale (his home) instead.
    state = { ...state, regions: { ...state.regions, oakvale: { ...state.regions.oakvale, stalls: { tomas: 1 } } } }
    expect(canOpenStallIn(state, 'tomas', 'kingsmarket')).toBe(true)
  })

  it("blocks Tomas's free Market Day placement into Kingsmarket while closed", () => {
    let state = createGame(FULL_CONFIG, 1)
    // Any producer has a Stall in a Kingsmarket neighbour, so Market Day's adjacency is satisfied.
    state = { ...state, regions: { ...state.regions, highmoor: { ...state.regions.highmoor, stalls: { ines: 1 } } } }
    expect(canMarketDayOpenIn(state, 'kingsmarket')).toBe(false)
    expect(() => applyAction(state, { kind: 'role', targetRegion: 'kingsmarket' })).toThrow()
  })

  it('blocks the "Grass Roots" Scheme from targeting Kingsmarket while closed, even though it borders a liberated region', () => {
    let state = createGame(FULL_CONFIG, 1)
    // Liberating exactly one Kingsmarket neighbour makes Kingsmarket "bordering a liberated region" for
    // Grass Roots's wording, but the guard (needs 2) must still block it.
    state = liberate(state, 'highmoor')
    expect(regionsBorderingLiberated(state)).toContain('kingsmarket')
    expect(legalSchemeTargets(state, 'ines', 'grass-roots')).not.toContain('kingsmarket')
  })
})

// SPEC 4.6.1: "maximum of 3 Stalls per region (all producers combined, minus 1 per Lost Land token there,
// never below 1)."
describe('Stall cap (SPEC 4.6.1) and Lost Land interaction', () => {
  it('reduces by 1 per Lost Land token and never goes below 1', () => {
    const region = { id: 'highmoor' as const, stalls: {}, outlets: 0, buyouts: 0, doubt: 0, lostLand: 0, liberated: false, everLiberated: false }
    expect(stallCap(region)).toBe(3)
    expect(stallCap({ ...region, lostLand: 1 })).toBe(2)
    expect(stallCap({ ...region, lostLand: 2 })).toBe(1)
    expect(stallCap({ ...region, lostLand: 3 })).toBe(1) // would be 0 uncapped; floor is 1
    expect(stallCap({ ...region, lostLand: 5 })).toBe(1)
  })

  it('blocks every free-placement path once a region is at its (possibly reduced) cap', () => {
    let state = createGame(FULL_CONFIG, 1)
    // 2 Lost Land tokens in Highmoor => cap 1. Already has 1 Stall (ines) => at cap.
    state = {
      ...state,
      regions: { ...state.regions, highmoor: { ...state.regions.highmoor, stalls: { ines: 1 }, lostLand: 2 } },
    }
    expect(stallCap(state.regions.highmoor)).toBe(1)
    // Normal Open Stall: tomas has no adjacency issue if we also give him a stall there directly for the
    // "contains your Stall" clause, but the cap must still block it regardless of adjacency.
    state = { ...state, regions: { ...state.regions, oakvale: { ...state.regions.oakvale, stalls: { tomas: 1 } } } }
    expect(canOpenStallIn(state, 'tomas', 'highmoor')).toBe(false)
    // Market Day (Tomas) and Grass Roots (any producer) must also respect the cap.
    expect(canMarketDayOpenIn(state, 'highmoor')).toBe(false)
    expect(legalSchemeTargets(state, 'ines', 'grass-roots')).not.toContain('highmoor')
  })

  it('does not force removal of excess Stalls when a Lost Land token lowers the cap below the current count', () => {
    // SPEC 4.7's Squeeze only removes a Stall when Damage >= Defence + 3, which is a separate condition
    // from placing the Lost Land token itself; the cap is a placement rule, not an ongoing invariant.
    let state = createGame(FULL_CONFIG, 1)
    state = {
      ...state,
      regions: { ...state.regions, highmoor: { ...state.regions.highmoor, stalls: { ines: 3 }, lostLand: 2 } },
    }
    // 3 Stalls sit above the now-reduced cap of 1, and nothing in the engine should have stripped them.
    expect(stallCap(state.regions.highmoor)).toBe(1)
    expect(state.regions.highmoor.stalls.ines).toBe(3)
    // Further placement is still blocked while over cap.
    expect(canOpenStallIn(state, 'ines', 'highmoor')).toBe(false)
  })
})
