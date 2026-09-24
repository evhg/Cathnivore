import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { checkRiftSplit } from '../src/engine/rift'
import { validate } from '../src/engine/api'
import { AGENDA_CARDS } from '../src/content/agenda'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, GameState } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
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

describe('Rift 6 "The Split" (SPEC 4.7)', () => {
  it('removes half the chosen faction\'s pieces and all its remaining Agenda cards, once', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = { ...state, rift: 6 }
    const before = state

    const afterSplit = checkRiftSplit(state)
    expect(afterSplit.riftSplitDone).toBe(true)
    expect(afterSplit.log.some((e) => e.type === 'riftSplit')).toBe(true)

    const faction = (afterSplit.log.find((e) => e.type === 'riftSplit') as { faction: 'hollowell' | 'candor' }).faction
    const AGENDA_FACTION = new Map(AGENDA_CARDS.map((c) => [c.id, c.faction]))
    for (const id of afterSplit.agendaDeck) {
      expect(AGENDA_FACTION.get(id)).not.toBe(faction)
    }
    expect(afterSplit.agendaRemoved.length).toBeGreaterThan(0)
    expect(validate(afterSplit)).toEqual([])

    // Happens only once: running it again on the already-split state is a no-op.
    const again = checkRiftSplit(afterSplit)
    expect(again).toEqual(afterSplit)
    expect(before.riftSplitDone).toBe(false)
  })

  it('does nothing below Rift 6', () => {
    const state = createGame(FULL_CONFIG, 5)
    expect(checkRiftSplit(state)).toBe(state)
  })

  it('triggers automatically when a Scheme pushes Rift to 6', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = forceScheme({ ...state, rift: 5 }, 'leaked-memo')
    state = {
      ...state,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, goodwill: 10 } } },
    }
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.rift).toBe(6)
    expect(state.riftSplitDone).toBe(true)
    expect(validate(state)).toEqual([])
  })
})
