import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { ALL_REGION_IDS } from '../src/content/map'
import { IMPROVEMENTS_BY_ID } from '../src/content/improvements'
import { SCHEMES_BY_ID } from '../src/content/schemes'
import type { GameConfig, GameState, RegionId } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// Gives Mara enough of every resource to buy/play anything in the market or plan, for tests that don't
// care about exact costs.
function richMara(state: GameState): GameState {
  return {
    ...state,
    producers: {
      ...state.producers,
      mara: { ...state.producers.mara, resources: { produce: 20, marks: 20, goodwill: 20 } },
    },
  }
}

// Forces `id` into Cath's Plan slot 0 for a deterministic test target, without duplicating or losing a
// card: `id` may already be face up (elsewhere in the plan), in the deck or in the discard, depending on
// the seed's shuffle. If it's already in the plan, swap it into slot 0; otherwise pull it out of the deck
// or discard and put whatever was in slot 0 back into the deck to keep the total scheme count correct.
function forceScheme(state: GameState, id: string): GameState {
  const planIndex = state.cathsPlan.indexOf(id)
  if (planIndex >= 0) {
    const cathsPlan = [...state.cathsPlan]
    ;[cathsPlan[0], cathsPlan[planIndex]] = [cathsPlan[planIndex]!, cathsPlan[0] ?? null]
    return { ...state, cathsPlan }
  }
  const displaced = state.cathsPlan[0] ?? null
  return {
    ...state,
    cathsPlan: [id, ...state.cathsPlan.slice(1)],
    schemeDeck: [...state.schemeDeck.filter((s) => s !== id), ...(displaced ? [displaced] : [])],
    schemeDiscard: state.schemeDiscard.filter((s) => s !== id),
  }
}

describe('Invest', () => {
  it('buying an Improvement spends Marks, adds it to the tableau, empties its Market slot, and applies its effect', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    const improvementId = state.market.find((id): id is string => id !== null)!
    const card = IMPROVEMENTS_BY_ID.get(improvementId)!
    const before = state.producers.mara
    state = applyAction(state, { kind: 'invest', improvementId })
    expect(state.producers.mara.resources.marks).toBe(before.resources.marks - card.cost)
    expect(state.producers.mara.improvements).toContain(improvementId)
    expect(state.market).not.toContain(improvementId)
    expect(validate(state)).toEqual([])
  })

  it('is not legal without enough Marks', () => {
    let state = createGame(FULL_CONFIG, 5)
    // Every Improvement costs at least 2 Marks (SPEC 7); 0 is under all of them regardless of the seed's market draw.
    state = {
      ...state,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, marks: 0 } } },
    }
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'invest')).toBe(false)
  })

  it('Farm Shop gives +1 Marks production immediately', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    // Force it into a slot for a deterministic test of its effect.
    state = { ...state, market: ['farm-shop', ...state.market.slice(1)] }
    const before = state.producers.mara.production.marks
    state = applyAction(state, { kind: 'invest', improvementId: 'farm-shop' })
    expect(state.producers.mara.production.marks).toBe(before + 1)
  })
})

describe('Scheme', () => {
  it('playing a Scheme spends Goodwill, empties its Cath\'s Plan slot, discards it, and applies its effect', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = forceScheme(state, 'leaked-memo')
    const before = state.producers.mara.resources.goodwill
    const beforeRift = state.rift
    // Saltmarsh (a Coast region) starts with 1 Doubt (SPEC 4.3.2), so it's a legal target.
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(before - SCHEMES_BY_ID.get('leaked-memo')!.cost)
    expect(state.cathsPlan).not.toContain('leaked-memo')
    expect(state.schemeDiscard).toContain('leaked-memo')
    expect(state.rift).toBe(beforeRift + 2)
    expect(validate(state)).toEqual([])
  })

  it('Loss Leader removes 2 Outlets from a targeted region with the player\'s Stall', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = forceScheme(state, 'loss-leader')
    // Mara's home (Brindle Hills) keeps its starting Outlet and she starts with a Stall there.
    const before = state.regions.brindleHills.outlets
    expect(before).toBeGreaterThanOrEqual(1)
    state = applyAction(state, { kind: 'scheme', schemeId: 'loss-leader', targetRegion: 'brindleHills' })
    expect(state.regions.brindleHills.outlets).toBe(Math.max(0, before - 2))
  })

  it('is not offered as a legal action without enough Goodwill', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = forceScheme(state, 'leaked-memo')
    state = {
      ...state,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, goodwill: 0 } } },
    }
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'scheme')).toBe(false)
  })

  it('a required-target Scheme with no legal target is not offered', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    // Grass Roots needs a region bordering a liberated one; nothing is liberated at game start.
    state = forceScheme(state, 'grass-roots')
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'scheme' && a.schemeId === 'grass-roots')).toBe(false)
  })

  // SPEC 5: "Grass Roots (1): Open a Stall for free in any region bordering a liberated region." — no
  // requirement that the acting producer already have a Stall network near the target. Rivermead borders
  // Saltmarsh and Shingle Bay, neither of which borders Mara's home Brindle Hills (her only Stall at game
  // start), so this exercises the case tests/kingsmarket-stall-cap.test.ts's Grass Roots coverage doesn't:
  // a target with no adjacency to the acting producer's own Stalls at all.
  it('offers a region bordering a liberated region even with no adjacency to the acting producer\'s own Stalls', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    const removedOutlets = state.regions.rivermead.outlets
    state = {
      ...state,
      outletPool: state.outletPool + removedOutlets,
      regions: {
        ...state.regions,
        rivermead: { ...state.regions.rivermead, stalls: { tomas: 1 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    state = forceScheme(state, 'grass-roots')
    const actions = legalActions(state)
    const grassRoots = actions.filter((a) => a.kind === 'scheme' && a.schemeId === 'grass-roots')
    expect(grassRoots.some((a) => a.kind === 'scheme' && a.targetRegion === 'saltmarsh')).toBe(true)

    state = applyAction(state, { kind: 'scheme', schemeId: 'grass-roots', targetRegion: 'saltmarsh' })
    expect(state.regions.saltmarsh.stalls.mara).toBe(1)
    expect(validate(state)).toEqual([])
  })
})

describe('freeSchemePlays (SPEC 8.2 ch6 "the Plan unlocks and the players get one free Scheme")', () => {
  it('lets a producer with 0 Goodwill play a Scheme for free, and decrements the grant', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = forceScheme(state, 'leaked-memo')
    state = {
      ...state,
      freeSchemePlays: 1,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, goodwill: 0 } } },
    }
    expect(legalActions(state).some((a) => a.kind === 'scheme' && a.schemeId === 'leaked-memo')).toBe(true)
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(0)
    expect(state.freeSchemePlays).toBe(0)
    expect(state.cathsPlan).not.toContain('leaked-memo')
    expect(validate(state)).toEqual([])
  })

  it('does not spend the grant when the producer could already afford the card', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = forceScheme(state, 'leaked-memo')
    state = { ...state, freeSchemePlays: 1 }
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(before - SCHEMES_BY_ID.get('leaked-memo')!.cost)
    expect(state.freeSchemePlays).toBe(1)
  })

  it('the unlockCathsPlan scripted trigger grants exactly one free play alongside unlocking the Plan', () => {
    const config: GameConfig = {
      ...FULL_CONFIG,
      cathsPlanLocked: true,
      scriptedTrigger: { liberatedCount: 0, effect: 'unlockCathsPlan', sceneId: 'planUnlocked' },
    }
    let state = createGame(config, 5)
    expect(state.cathsPlanLocked).toBe(true)
    expect(state.freeSchemePlays).toBe(0)
    // Round 1 -> 2 cleanup: liberatedCount (0) already meets the trigger's threshold, so it fires here.
    for (let i = 0; i < 6; i++) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
    expect(state.cathsPlanLocked).toBe(false)
    expect(state.freeSchemePlays).toBe(1)
  })
})

// SPEC 7's "~30% ongoing discounts or abilities" effect mix (see DECISIONS.md): these four cards were
// converted from plain production bumps to real ongoing abilities to close a real gap a hardening-review
// audit found (only 2 of 36 cards were pure ongoing-ability cards, vs. SPEC 7's ~11-card target).
describe('ongoing-ability Improvements added for the SPEC 7 effect-mix fix', () => {
  // Grants `id` to Mara directly (skipping a real purchase, since these tests only care about the
  // ability's effect), pulling it out of wherever it currently sits so `validate()`'s pool-total
  // invariant still holds.
  function withImprovement(state: GameState, id: string): GameState {
    return {
      ...state,
      producers: { ...state.producers, mara: { ...state.producers.mara, improvements: [...state.producers.mara.improvements, id] } },
      market: state.market.map((slot) => (slot === id ? null : slot)),
      improvementDeck: state.improvementDeck.filter((cardId) => cardId !== id),
    }
  }

  it('Wagon Wheel Press: Sell yields 1 extra Marks', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = withImprovement(state, 'wagon-wheel-press')
    const before = state.producers.mara.resources.marks
    state = applyAction(state, { kind: 'sell', count: 2 })
    expect(state.producers.mara.resources.marks).toBe(before + 2 + 1)
    expect(validate(state)).toEqual([])
  })

  it('Compost Exchange: Graft yields 1 extra Produce', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = withImprovement(state, 'compost-exchange')
    const before = state.producers.mara.resources.produce
    state = applyAction(state, { kind: 'graft' })
    expect(state.producers.mara.resources.produce).toBe(before + 1 + 1)
    expect(validate(state)).toEqual([])
  })

  it('Press Contact: Schemes cost 1 less Goodwill, minimum 1', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = withImprovement(state, 'press-contact')
    state = forceScheme(state, 'leaked-memo')
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(before - (SCHEMES_BY_ID.get('leaked-memo')!.cost - 1))
  })

  it('Wholesale Account: Improvements cost 1 less Marks, minimum 1, but never discounts its own purchase', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = withImprovement(state, 'wholesale-account')
    const improvementId = state.market.find((id): id is string => id !== null && id !== 'wholesale-account')!
    const card = IMPROVEMENTS_BY_ID.get(improvementId)!
    const before = state.producers.mara.resources.marks
    state = applyAction(state, { kind: 'invest', improvementId })
    expect(state.producers.mara.resources.marks).toBe(before - Math.max(1, card.cost - 1))
  })

  it('Wholesale Account discount has a floor of 1 Mark even on the cheapest Improvements', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = withImprovement(state, 'wholesale-account')
    // Force a 2-Marks card (the SPEC 7 minimum) into the market to exercise the floor.
    state = { ...state, market: ['harbour-stall-licence', state.market[1] ?? null, state.market[2] ?? null, state.market[3] ?? null] }
    const before = state.producers.mara.resources.marks
    state = applyAction(state, { kind: 'invest', improvementId: 'harbour-stall-licence' })
    expect(state.producers.mara.resources.marks).toBe(before - 1)
  })

  it('Letterpress Flyers: Schemes cost 1 less Goodwill, minimum 1 (same shape as Press Contact)', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = withImprovement(state, 'letterpress-flyers')
    state = forceScheme(state, 'leaked-memo')
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(before - (SCHEMES_BY_ID.get('leaked-memo')!.cost - 1))
  })

  it('Press Contact and Letterpress Flyers do not stack: owning both still only discounts Schemes by 1', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = withImprovement(state, 'press-contact')
    state = withImprovement(state, 'letterpress-flyers')
    state = forceScheme(state, 'leaked-memo')
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(before - (SCHEMES_BY_ID.get('leaked-memo')!.cost - 1))
  })

  // Sets up a region with 2 Stalls (SPEC 4.6.2's Buyout-clearing requirement), 1 Buyout and 2 Doubt,
  // so Supply Buyout and Rebut are both legal on it regardless of the seed's starting layout.
  function withClearableRegion(state: GameState): GameState {
    return {
      ...state,
      regions: {
        ...state.regions,
        highmoor: {
          ...state.regions.highmoor,
          stalls: { ...state.regions.highmoor.stalls, mara: 2 },
          buyouts: 1,
          doubt: 2,
        },
      },
    }
  }

  it('Community Larder: Supply Buyout costs 1 less Produce, and never touches the 2-Stall requirement', () => {
    let state = richMara(withClearableRegion(createGame(FULL_CONFIG, 5)))
    state = withImprovement(state, 'community-larder')
    const before = state.producers.mara.resources.produce
    state = applyAction(state, { kind: 'supplyBuyout', region: 'highmoor' })
    expect(state.producers.mara.resources.produce).toBe(before - 2)
    expect(state.regions.highmoor.buyouts).toBe(0)
  })

  it('Community Larder discount has a floor of 2 Produce, and stacks only once even with multiple copies', () => {
    let state = richMara(withClearableRegion(createGame(FULL_CONFIG, 5)))
    // Grant a second copy directly (bypassing the market, which never deals duplicates) to prove the
    // floor holds even in that case: hasImprovement is a boolean membership check, so it can never stack.
    state = withImprovement(state, 'community-larder')
    state = { ...state, producers: { ...state.producers, mara: { ...state.producers.mara, improvements: [...state.producers.mara.improvements, 'community-larder'] } } }
    const before = state.producers.mara.resources.produce
    state = applyAction(state, { kind: 'supplyBuyout', region: 'highmoor' })
    expect(state.producers.mara.resources.produce).toBe(before - 2)
  })

  it('Supply Buyout still requires at least 2 Stalls even with Community Larder', () => {
    let state = richMara(withClearableRegion(createGame(FULL_CONFIG, 5)))
    state = withImprovement(state, 'community-larder')
    state = { ...state, regions: { ...state.regions, highmoor: { ...state.regions.highmoor, stalls: { ...state.regions.highmoor.stalls, mara: 1 } } } }
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'supplyBuyout')).toBe(false)
  })

  // Sets `region` up with a lone Mara Stall and `outlets` Outlets, no Buyout/Doubt, so `supplyOutlets` is
  // legal there regardless of the seed's starting layout.
  function withOutletRegion(state: GameState, region: RegionId, outlets: number): GameState {
    return {
      ...state,
      regions: {
        ...state.regions,
        [region]: { ...state.regions[region], stalls: { ...state.regions[region].stalls, mara: 1 }, outlets, buyouts: 0, doubt: 0 },
      },
    }
  }

  // SPEC 7: Mobile Butcher/Wholesale Crate Deal/Harbour Stall Licence each give a matching Pasture/Crop/
  // Coast region type its own "Supply costs 1 less Produce per Outlet (minimum 1)" discount — previously
  // untested (only Wholesale Account's floor test happened to reference Harbour Stall Licence's id, without
  // exercising its actual Supply discount).
  const supplyDiscountCards: { id: string; region: RegionId; type: string }[] = [
    { id: 'mobile-butcher', region: 'highmoor', type: 'Pasture' },
    { id: 'wholesale-crate-deal', region: 'rivermead', type: 'Crop' },
    { id: 'harbour-stall-licence', region: 'saltmarsh', type: 'Coast' },
  ]

  for (const { id, region, type } of supplyDiscountCards) {
    it(`${id}: Supply costs 1 less Produce per Outlet in a ${type} region`, () => {
      let state = richMara(withOutletRegion(createGame(FULL_CONFIG, 5), region, 2))
      state = withImprovement(state, id)
      const before = state.producers.mara.resources.produce
      state = applyAction(state, { kind: 'supplyOutlets', region, count: 2 })
      // Base cost is 2 Produce/Outlet (SPEC 4.6.2); the discount is 1 less per Outlet, so 2 Outlets cost
      // (2-1)*2 = 2, not the undiscounted (2*2 = 4).
      expect(state.producers.mara.resources.produce).toBe(before - 2)
      expect(state.regions[region].outlets).toBe(0)
    })

    it(`${id} does not discount Supply in a region of a different type`, () => {
      const otherRegion = supplyDiscountCards.find((c) => c.id !== id)!.region
      let state = richMara(withOutletRegion(createGame(FULL_CONFIG, 5), otherRegion, 1))
      state = withImprovement(state, id)
      const before = state.producers.mara.resources.produce
      state = applyAction(state, { kind: 'supplyOutlets', region: otherRegion, count: 1 })
      expect(state.producers.mara.resources.produce).toBe(before - 2)
    })
  }

  it('Tide Tables: Rebut costs 1 less Goodwill overall, applied per action, not per Doubt removed', () => {
    let state = richMara(withClearableRegion(createGame(FULL_CONFIG, 5)))
    state = withImprovement(state, 'tide-tables')
    // Removing 1 Doubt: base cost 1, minus the flat 1 discount, floored at 1 — not free.
    const before1 = state.producers.mara.resources.goodwill
    const oneDoubt = applyAction(state, { kind: 'rebut', region: 'highmoor', count: 1 })
    expect(oneDoubt.producers.mara.resources.goodwill).toBe(before1 - 1)
    // Removing 2 Doubt: base cost 2, minus the flat 1 discount = 1 — not less than the 1-Doubt cost above
    // (no inverted-cost bug where clearing more Doubt is cheaper than clearing less).
    const before2 = state.producers.mara.resources.goodwill
    const twoDoubt = applyAction(state, { kind: 'rebut', region: 'highmoor', count: 2 })
    expect(twoDoubt.producers.mara.resources.goodwill).toBe(before2 - 1)
  })

  it('without Tide Tables, Rebut costs scale with Doubt removed (1 for 1, 2 for 2)', () => {
    let state = richMara(withClearableRegion(createGame(FULL_CONFIG, 5)))
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'rebut', region: 'highmoor', count: 2 })
    expect(state.producers.mara.resources.goodwill).toBe(before - 2)
  })

  // These three cards' ongoing effects live in actions.ts's rebut/sell/graft handlers (see the comments
  // there); a gate-2 audit found their code comments claimed test coverage that didn't actually exist.
  it('Soil Lab Report: Rebut removes 1 extra Doubt for free', () => {
    let state = richMara(withClearableRegion(createGame(FULL_CONFIG, 5)))
    state = withImprovement(state, 'soil-lab-report')
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'rebut', region: 'highmoor', count: 1 })
    // Paid for removing 1 Doubt, but 2 are actually removed (the free bonus).
    expect(state.producers.mara.resources.goodwill).toBe(before - 1)
    expect(state.regions.highmoor.doubt).toBe(0)
  })

  it('without Soil Lab Report, Rebut only removes the Doubt paid for', () => {
    let state = richMara(withClearableRegion(createGame(FULL_CONFIG, 5)))
    state = applyAction(state, { kind: 'rebut', region: 'highmoor', count: 1 })
    expect(state.regions.highmoor.doubt).toBe(1)
  })

  it('Polytunnel: Sell also yields 1 extra Goodwill', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = withImprovement(state, 'polytunnel')
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'sell', count: 2 })
    expect(state.producers.mara.resources.goodwill).toBe(before + 1)
  })

  it('Seed Library: Graft also yields 1 extra Marks', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = withImprovement(state, 'seed-library')
    const before = state.producers.mara.resources.marks
    state = applyAction(state, { kind: 'graft' })
    expect(state.producers.mara.resources.marks).toBe(before + 1 + 1)
  })
})
