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
