import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { checkRiftSplit } from '../src/engine/rift'
import { currentDecision, validate } from '../src/engine/api'
import { AGENDA_CARDS } from '../src/content/agenda'
import { addBuyout, addDoubt, addOutlets, removeBuyout, removeDoubt, removeOutlets } from '../src/engine/pieces'
import { ALL_REGION_IDS } from '../src/content/map'
import type { Faction, GameConfig, GameState, RegionId } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

const AGENDA_FACTION = new Map(AGENDA_CARDS.map((c) => [c.id, c.faction]))

function pieceCount(state: GameState, faction: Faction): number {
  return state.config.activeRegions.reduce((sum, id) => {
    const r = state.regions[id]
    return sum + (faction === 'hollowell' ? r.outlets + r.buyouts : r.doubt)
  }, 0)
}

// SPEC 4.3.2's normal setup (2 Outlets/1 Buyout/2 Doubt in Kingsmarket, 1 Outlet elsewhere, +1 Doubt on
// Coast) already puts pieces on the board before a test adds its own — clearing them first makes every
// count in these tests exact and setup-independent, while still going through the real pool-adjusting
// helpers so `validate()`'s pool-total invariants keep passing.
function clearAllPieces(state: GameState): GameState {
  let next = state
  for (const id of next.config.activeRegions) {
    const r = next.regions[id]
    if (r.outlets > 0) next = removeOutlets(next, id, r.outlets)
    if (r.buyouts > 0) next = removeBuyout(next, id, r.buyouts)
    if (r.doubt > 0) next = removeDoubt(next, id, r.doubt)
  }
  return next
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

// Resolves every pending decision by always taking its already-applied default, driving a game past the
// whole Rift 6 chain (a faction pick, then one removal decision per piece) the same way an AI or a human
// clicking through the pre-filled default would.
function resolveAllDecisionsWithDefault(state: GameState): GameState {
  let next = state
  let decision = currentDecision(next)
  while (decision) {
    next = applyAction(next, { kind: 'decide', decisionId: decision.id, choice: decision.applied })
    decision = currentDecision(next)
  }
  return next
}

describe('Rift 6 "The Split" (SPEC 4.7 / 9.1 currentDecision)', () => {
  it('does nothing below Rift 6', () => {
    const state = createGame(FULL_CONFIG, 5)
    expect(checkRiftSplit(state)).toBe(state)
  })

  it('queues a real currentDecision (faction) rather than deciding on its own', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = { ...state, rift: 6 }

    const afterCheck = checkRiftSplit(state)
    expect(afterCheck.riftSplitDone).toBe(false)
    const decision = currentDecision(afterCheck)
    expect(decision?.kind).toBe('riftSplitFaction')
    expect(decision?.options).toEqual(['hollowell', 'candor'])

    // While it's pending, it's the only legal action — same as every other SPEC 9.1 forced choice.
    const actions = legalActions(afterCheck)
    expect(actions.every((a) => a.kind === 'decide')).toBe(true)
    expect(actions.length).toBe(2)

    // Re-running checkRiftSplit while a decision is already in flight doesn't queue a second one.
    expect(checkRiftSplit(afterCheck)).toBe(afterCheck)
  })

  it('removes half (rounded down) the chosen faction\'s pieces and all its remaining Agenda cards, once, via decisions', () => {
    let state = clearAllPieces(createGame(FULL_CONFIG, 5))
    // Hollowell (Outlets+Buyouts): 4 + 2 = 6 pieces. Candor (Doubt): 3 pieces.
    state = addOutlets(state, 'saltmarsh', 4)
    state = addBuyout(state, 'oakvale', 2)
    state = addDoubt(state, 'rivermead', 3)
    state = { ...state, rift: 6 }

    state = checkRiftSplit(state)
    const decision = currentDecision(state)!
    expect(decision.kind).toBe('riftSplitFaction')
    expect(decision.applied).toBe('hollowell') // more pieces on the map right now

    state = resolveAllDecisionsWithDefault(state)

    expect(state.riftSplitDone).toBe(true)
    expect(state.log.some((e) => e.type === 'riftSplit' && e.faction === 'hollowell')).toBe(true)
    for (const id of state.agendaDeck) expect(AGENDA_FACTION.get(id)).not.toBe('hollowell')
    expect(state.agendaRemoved.length).toBeGreaterThan(0)
    expect(state.agendaRemoved.every((id) => AGENDA_FACTION.get(id) === 'hollowell')).toBe(true)

    // floor(6 / 2) = 3 Hollowell pieces removed; Candor untouched.
    expect(pieceCount(state, 'hollowell')).toBe(3)
    expect(pieceCount(state, 'candor')).toBe(3)
    expect(validate(state)).toEqual([])

    // Happens only once: running it again on the already-split state is a no-op.
    expect(checkRiftSplit(state)).toBe(state)
  })

  it('a human/AI can override the default faction, and the outcome matches the chosen faction, not the default', () => {
    let state = clearAllPieces(createGame(FULL_CONFIG, 5))
    state = addOutlets(state, 'saltmarsh', 4) // Hollowell: 4 pieces, the default (more than Candor's 2)
    state = addDoubt(state, 'rivermead', 2) // Candor: 2 pieces
    state = { ...state, rift: 6 }
    state = checkRiftSplit(state)
    const decision = currentDecision(state)!
    expect(decision.applied).toBe('hollowell')

    state = applyAction(state, { kind: 'decide', decisionId: decision.id, choice: 'candor' })
    state = resolveAllDecisionsWithDefault(state)

    expect(state.riftSplitDone).toBe(true)
    // Candor was chosen instead of the default: floor(2/2) = 1 of its pieces removed; Hollowell untouched.
    expect(pieceCount(state, 'candor')).toBe(1)
    expect(pieceCount(state, 'hollowell')).toBe(4)
    for (const id of state.agendaDeck) expect(AGENDA_FACTION.get(id)).not.toBe('candor')
    expect(state.agendaRemoved.every((id) => AGENDA_FACTION.get(id) === 'candor')).toBe(true)
    expect(validate(state)).toEqual([])
  })

  it('a human/AI can override where a piece is removed from, region by region', () => {
    let state = clearAllPieces(createGame(FULL_CONFIG, 5))
    // 4 Outlets in Saltmarsh (the greedy default target) and 2 in Oakvale — 6 total, 3 to remove.
    state = addOutlets(state, 'saltmarsh', 4)
    state = addOutlets(state, 'oakvale', 2)
    state = { ...state, rift: 6 }
    state = checkRiftSplit(state)
    state = applyAction(state, { kind: 'decide', decisionId: currentDecision(state)!.id, choice: 'hollowell' })

    const removal1 = currentDecision(state)!
    expect(removal1.kind).toBe('riftSplitRemoval')
    if (removal1.kind !== 'riftSplitRemoval') throw new Error('unreachable')
    expect(removal1.applied).toBe('saltmarsh') // greedy default: most pieces first
    expect(removal1.remaining).toBe(2)
    expect(state.regions.saltmarsh.outlets).toBe(3) // default already applied

    // Override: remove from Oakvale instead of the defaulted Saltmarsh. The engine undoes the default
    // (Saltmarsh back to 4) and removes from Oakvale instead (2 -> 1) — then immediately queues the next
    // removal decision, re-applying *its own* default (Saltmarsh is still the most-pieces region, so it's
    // taken down to 3 again for that next step, still pending), which is why Saltmarsh isn't found at 4
    // afterward: this override only ever controlled its own one-piece step, exactly as intended.
    state = applyAction(state, { kind: 'decide', decisionId: removal1.id, choice: 'oakvale' })
    expect(state.regions.oakvale.outlets).toBe(1) // the overridden step's target was hit
    expect(currentDecision(state)?.kind).toBe('riftSplitRemoval') // one more step still pending (3 total)

    state = resolveAllDecisionsWithDefault(state)
    expect(state.riftSplitDone).toBe(true)
    expect(pieceCount(state, 'hollowell')).toBe(3) // 6 - 3 removed
    // Oakvale ended up losing a piece it would have kept under an all-defaults run (the "removes half..."
    // test above, with the same starting counts on Saltmarsh/Oakvale, leaves Oakvale's 2 buyouts
    // untouched) — proof the override changed *where* the pieces came from, not just that it was accepted.
    expect(state.regions.oakvale.outlets).toBe(1)
    expect(state.regions.saltmarsh.outlets).toBe(2)
    expect(validate(state)).toEqual([])
  })

  it('removes from Buyouts once a region has no Outlets left (SPEC 4.6/4.7 piece kinds)', () => {
    let state = clearAllPieces(createGame(FULL_CONFIG, 5))
    state = addBuyout(state, 'saltmarsh', 2) // Hollowell: 2 pieces (Buyouts only, no Outlets), 1 to remove
    state = { ...state, rift: 6 }
    state = checkRiftSplit(state)
    state = applyAction(state, { kind: 'decide', decisionId: currentDecision(state)!.id, choice: 'hollowell' })

    const removal = currentDecision(state)!
    expect(removal.kind).toBe('riftSplitRemoval')
    if (removal.kind !== 'riftSplitRemoval') throw new Error('unreachable')
    expect(removal.pieceKind).toBe('buyout')
    expect(state.regions.saltmarsh.buyouts).toBe(1)

    state = resolveAllDecisionsWithDefault(state)
    expect(state.regions.saltmarsh.buyouts).toBe(1)
    expect(validate(state)).toEqual([])
  })

  it('removing a piece can liberate a region or win the game mid-chain, and that is caught immediately', () => {
    let state = clearAllPieces(createGame(FULL_CONFIG, 5))
    // Liberate 4 regions (including Kingsmarket, required for SPEC 4.8's win), leaving Saltmarsh one
    // Outlet away from liberating — removing it via the Split should win the game outright.
    for (const id of ['kingsmarket', 'brindleHills', 'oakvale', 'rivermead'] as RegionId[]) {
      state = { ...state, regions: { ...state.regions, [id]: { ...state.regions[id], liberated: true, everLiberated: true, stalls: { mara: 1 } } } }
    }
    state = addOutlets(state, 'saltmarsh', 1)
    state = { ...state, regions: { ...state.regions, saltmarsh: { ...state.regions.saltmarsh, stalls: { mara: 1 } } } }
    state = addOutlets(state, 'highmoor', 1) // a second Hollowell piece so half-rounded-down is 1, not 0
    state = { ...state, rift: 6 }

    state = checkRiftSplit(state)
    state = applyAction(state, { kind: 'decide', decisionId: currentDecision(state)!.id, choice: 'hollowell' })
    state = applyAction(state, { kind: 'decide', decisionId: currentDecision(state)!.id, choice: 'saltmarsh' })

    expect(state.regions.saltmarsh.outlets).toBe(0)
    expect(state.regions.saltmarsh.liberated).toBe(true)
    expect(state.result?.won).toBe(true)
  })

  it('triggers automatically when a Scheme pushes Rift to 6, and blocks play until the decisions resolve', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = forceScheme({ ...state, rift: 5 }, 'leaked-memo')
    state = {
      ...state,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, goodwill: 10 } } },
    }
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.rift).toBe(6)
    expect(state.riftSplitDone).toBe(false)
    expect(currentDecision(state)?.kind).toBe('riftSplitFaction')

    state = resolveAllDecisionsWithDefault(state)
    expect(state.riftSplitDone).toBe(true)
    expect(validate(state)).toEqual([])
  })
})
