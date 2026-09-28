import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { addBuyout, addDoubt, addOutlets, removeOutlets } from '../src/engine/pieces'
import { ALL_REGION_IDS } from '../src/content/map'
import { SCHEMES } from '../src/content/schemes'
import type { GameConfig, GameState } from '../src/engine/types'

// SPEC 11.4 gate 2: "a unit test for every action, enemy step, Agenda card, Scheme, Improvement and win or
// loss rule." tests/rules-text.test.ts only checked each Scheme's `text`/`line`/`cost` shape, never its
// `effect`; 23 of the 30 Schemes had no test anywhere that actually called `effect` (a fresh audit found
// this gap — see DECISIONS.md). This file closes it: every Scheme is played for real through `applyAction`
// against a board stocked so every targeting shape (region with a Stall, any region with a Stall, any
// non-liberated region) has a legal target, and the result must be crash-free and invariant-clean.

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// Forces `id` into Cath's Plan slot 0 (same approach as tests/invest-scheme.test.ts's `forceScheme`),
// without duplicating or losing a card from the deck/discard.
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
    schemeDeck: state.schemeDeck.filter((c) => c !== id),
    schemeDiscard: displaced ? [...state.schemeDiscard.filter((c) => c !== id), displaced] : state.schemeDiscard.filter((c) => c !== id),
  }
}

// A board where Brindle Hills (Mara's home, so always has her Stall) also carries 2 extra Outlets, 1
// Buyout and 2 Doubt (added through the real pool-tracking helpers, so `validate()`'s pool-total invariant
// still holds) — enough for every "region with your Stall"/"any region with a Stall" targeting shape at
// once — plus a liberated Highmoor (for Grass Roots' "borders a liberated region" target on Saltmarsh),
// plenty of resources, and an untouched Agenda/Pressure deck for the information Schemes.
function richBoard(seed: number): GameState {
  let state = createGame(FULL_CONFIG, seed)
  state = {
    ...state,
    producers: {
      ...state.producers,
      mara: { ...state.producers.mara, resources: { produce: 20, marks: 20, goodwill: 20 } },
    },
  }
  state = addOutlets(state, 'brindleHills', 2)
  state = addBuyout(state, 'brindleHills', 1)
  state = addDoubt(state, 'brindleHills', 2)
  // Highmoor starts with 1 Outlet (SPEC 4.3.2, every non-home region) and no Stall; clear it through the
  // pool-safe helper, then give Mara a Stall there and mark it liberated (SPEC 4.8: a Stall, no enemy
  // pieces) so Grass Roots has a bordering-a-liberated-region target (Saltmarsh) to place into.
  state = removeOutlets(state, 'highmoor', state.regions.highmoor.outlets)
  state = {
    ...state,
    regions: {
      ...state.regions,
      highmoor: { ...state.regions.highmoor, stalls: { mara: 1 }, liberated: true, everLiberated: true },
    },
  }
  return state
}

describe('Every Scheme resolves cleanly when played (SPEC 11.4 gate 2)', () => {
  for (const card of SCHEMES) {
    it(`${card.name}: plays through applyAction without crashing or violating invariants`, () => {
      const state = forceScheme(richBoard(7), card.id)
      const action = legalActions(state).find((a) => a.kind === 'scheme' && a.schemeId === card.id)
      expect(action, `no legal 'scheme' action found for ${card.id} on the stocked board`).toBeDefined()
      const after = applyAction(state, action!)
      expect(validate(after)).toEqual([])
      // Every Scheme empties its own Cath's Plan slot and discards itself (SPEC 5), regardless of effect.
      expect(after.cathsPlan[0]).not.toBe(card.id)
      expect(after.schemeDiscard).toContain(card.id)
    })
  }
})

// A fresh review session found "Two For One"'s `text` claimed an unconditional "Remove 1 Outlet and 1
// Doubt," but `legalTargets` only requires *either* to be present (an OR, not an AND) and `effect` removes
// only what's actually there — so the card was legally playable on a region with just one of the two. Text
// fixed to say "(whichever it has)" rather than tightening `legalTargets` to an AND, since the OR-gated
// legality is the established, already-balance-tuned design (SPEC 4 lets the balance loop tune numbers, not
// silently retighten a card's targeting rule). `richBoard` above always gives Brindle Hills *both* an
// Outlet and Doubt, so the plain "resolves cleanly" test above never exercises the OR-only-satisfied case —
// this covers it directly.
// SPEC 11.4 gate 2: the "resolves cleanly" loop above only checks validate() never fails, never what a
// card actually *does*. A follow-up audit found 21 of the 30 Schemes had no test asserting their specific
// numeric effect anywhere (plus Steak-out's actual reorder, previously only checked for its irreversible
// flag in tests/undo.test.ts). Each of these plays the real card through `applyAction` on `richBoard`
// (Brindle Hills: Mara's Stall, 3 Outlets, 1 Buyout, 2 Doubt; Highmoor: liberated, Mara's Stall, no enemy
// pieces) and asserts the exact resulting delta.
describe("Every previously-untested Scheme's specific numeric effect (SPEC 11.4 gate 2)", () => {
  function play(state: GameState, schemeId: string, targetRegion?: string): GameState {
    state = forceScheme(state, schemeId)
    const action = legalActions(state).find(
      (a) => a.kind === 'scheme' && a.schemeId === schemeId && (targetRegion === undefined || (a as { targetRegion?: string }).targetRegion === targetRegion),
    )
    expect(action, `no legal 'scheme' action found for ${schemeId}${targetRegion ? ` targeting ${targetRegion}` : ''}`).toBeDefined()
    return applyAction(state, action!)
  }

  it('Sunlight: the chosen region skips Squeeze this round', () => {
    const after = play(richBoard(7), 'sunlight', 'rivermead')
    expect(after.squeezeSkip).toContain('rivermead')
  })

  it('Price War: removes 1 Outlet from a region with your Stall', () => {
    const after = play(richBoard(7), 'price-war', 'brindleHills')
    expect(after.regions.brindleHills.outlets).toBe(2)
  })

  it('Buy It Back: removes 1 Buyout from a region with your Stall, returning it to the pool', () => {
    const before = richBoard(7)
    const after = play(before, 'buyout-the-buyout', 'brindleHills')
    expect(after.regions.brindleHills.buyouts).toBe(0)
    expect(after.buyoutPool).toBe(before.buyoutPool + 1)
  })

  it('Friendly Inspector: removes 1 Doubt from a region with your Stall', () => {
    const after = play(richBoard(7), 'friendly-inspector', 'brindleHills')
    expect(after.regions.brindleHills.doubt).toBe(1)
  })

  it('Good Harvest: gain 3 Produce', () => {
    const before = richBoard(7)
    const after = play(before, 'good-harvest')
    expect(after.producers.mara.resources.produce).toBe(before.producers.mara.resources.produce + 3)
  })

  it('Small Loan: gain 3 Marks', () => {
    const before = richBoard(7)
    const after = play(before, 'small-loan')
    expect(after.producers.mara.resources.marks).toBe(before.producers.mara.resources.marks + 3)
  })

  it('Goodwill Tour: +1 Goodwill production', () => {
    const before = richBoard(7)
    const after = play(before, 'goodwill-tour')
    expect(after.producers.mara.production.goodwill).toBe(before.producers.mara.production.goodwill + 1)
  })

  it('Seasonal Bonus: +1 Produce production and +1 Marks production', () => {
    const before = richBoard(7)
    const after = play(before, 'seasonal-bonus')
    expect(after.producers.mara.production.produce).toBe(before.producers.mara.production.produce + 1)
    expect(after.producers.mara.production.marks).toBe(before.producers.mara.production.marks + 1)
  })

  it('Inside Source: swaps the top two cards of the Agenda deck', () => {
    const before = richBoard(7)
    const [a, b] = before.agendaDeck
    const after = play(before, 'inside-source')
    expect(after.agendaDeck[0]).toBe(b)
    expect(after.agendaDeck[1]).toBe(a)
    expect(after.agendaDeck.slice(2)).toEqual(before.agendaDeck.slice(2))
  })

  it('Whistleblower: Rift +1', () => {
    const before = richBoard(7)
    const after = play(before, 'whistleblower')
    expect(after.rift).toBe(before.rift + 1)
  })

  it('Competing Lawsuits: Rift +2', () => {
    const before = richBoard(7)
    const after = play(before, 'competing-lawsuits')
    expect(after.rift).toBe(before.rift + 2)
  })

  it('Closed For Stocktake: the chosen region skips Expand this round', () => {
    const after = play(richBoard(7), 'closed-for-stocktake', 'rivermead')
    expect(after.expandSkip).toContain('rivermead')
  })

  it('Fence Jumpers: removes 1 Buyout from a region with your Stall, returning it to the pool', () => {
    const before = richBoard(7)
    const after = play(before, 'fence-jumpers', 'brindleHills')
    expect(after.regions.brindleHills.buyouts).toBe(0)
    expect(after.buyoutPool).toBe(before.buyoutPool + 1)
  })

  it('Late Delivery: removes 2 Outlets from any region with a Stall', () => {
    const after = play(richBoard(7), 'late-delivery', 'brindleHills')
    expect(after.regions.brindleHills.outlets).toBe(1)
  })

  it('Quiet Word: removes 1 Doubt from any region with a Stall', () => {
    const after = play(richBoard(7), 'quiet-word', 'brindleHills')
    expect(after.regions.brindleHills.doubt).toBe(1)
  })

  it('Undercut: removes 1 Outlet from any region with a Stall', () => {
    const after = play(richBoard(7), 'undercut', 'brindleHills')
    expect(after.regions.brindleHills.outlets).toBe(2)
  })

  it('Bumper Crop: gain 2 Produce and 1 Marks', () => {
    const before = richBoard(7)
    const after = play(before, 'bumper-crop')
    expect(after.producers.mara.resources.produce).toBe(before.producers.mara.resources.produce + 2)
    expect(after.producers.mara.resources.marks).toBe(before.producers.mara.resources.marks + 1)
  })

  it('Anonymous Tip: Rift +1', () => {
    const before = richBoard(7)
    const after = play(before, 'anonymous-tip')
    expect(after.rift).toBe(before.rift + 1)
  })

  it('Records Request: Rift +2', () => {
    const before = richBoard(7)
    const after = play(before, 'public-records-request')
    expect(after.rift).toBe(before.rift + 2)
  })

  it('Firm No: the chosen own-Stall region skips Squeeze this round', () => {
    const after = play(richBoard(7), 'firm-no', 'brindleHills')
    expect(after.squeezeSkip).toContain('brindleHills')
  })

  it('Redirect: the chosen own-Stall region skips Expand this round', () => {
    const after = play(richBoard(7), 'redirect', 'brindleHills')
    expect(after.expandSkip).toContain('brindleHills')
  })

  it("Steak-out: moves the peeked top Pressure card to the bottom of its own stage", () => {
    const before = richBoard(7)
    const top = before.pressureDeck[0]!
    const after = play(before, 'steak-out')
    // The peeked card is gone from the front and reappears at the end of its own stage's run, with every
    // other card's relative order preserved (a real reorder, not just "no crash").
    expect(after.pressureDeck[0]).not.toBe(top)
    const stageRun = after.pressureDeck.filter((c) => c.stage === top.stage)
    expect(stageRun[stageRun.length - 1]!.id).toBe(top.id)
    expect(after.pressureDeck.map((c) => c.id).sort()).toEqual(before.pressureDeck.map((c) => c.id).sort())
  })

  it('Reconnaissance and Paper Trail: a pure peek, the deck order never changes', () => {
    const before = richBoard(7)
    const afterPressure = play(before, 'reconnaissance')
    expect(afterPressure.pressureDeck).toEqual(before.pressureDeck)
    const afterAgenda = play(before, 'paper-trail')
    expect(afterAgenda.agendaDeck).toEqual(before.agendaDeck)
  })

  it('Weather Eye: a pure peek, the Pressure deck order never changes', () => {
    const before = richBoard(7)
    const after = play(before, 'weather-eye')
    expect(after.pressureDeck).toEqual(before.pressureDeck)
  })
})

describe('Two For One (OR-gated legality, SPEC 5)', () => {
  it('removes only the Doubt on a region with Doubt but no Outlet', () => {
    let state = richBoard(7)
    state = removeOutlets(state, 'brindleHills', state.regions.brindleHills.outlets)
    expect(state.regions.brindleHills.outlets).toBe(0)
    expect(state.regions.brindleHills.doubt).toBeGreaterThan(0)
    state = forceScheme(state, 'two-for-one')
    const action = legalActions(state).find((a) => a.kind === 'scheme' && a.schemeId === 'two-for-one')
    expect(action, 'Two For One should still be legally targetable with only Doubt present').toBeDefined()
    const doubtBefore = state.regions.brindleHills.doubt
    const after = applyAction(state, action!)
    expect(after.regions.brindleHills.outlets).toBe(0)
    expect(after.regions.brindleHills.doubt).toBe(doubtBefore - 1)
    expect(validate(after)).toEqual([])
  })
})
