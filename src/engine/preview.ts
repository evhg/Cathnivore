// Plan item 25: what each of Tomorrow's papers will actually do, in words, for the plan cards. It runs the
// real resolvers on the current state and reads the log entries they add, so the preview can never drift
// from the rules (Squeeze, then Expand on the state Squeeze leaves; the Scout card Expands next round).
import { REGIONS, regionType } from '../content/map'
import { resolveRules } from './rules'
import { resolveExpand, resolveSqueeze } from './enemy'
import type { GameState, GameEvent, PressureCard, RegionId } from './types'

export type PlanSlot = 'squeeze' | 'expand' | 'scout'

export interface PlanPreview {
  slot: PlanSlot
  /** The regions this card hits (empty when it hits nothing or the slot is empty). */
  regions: RegionId[]
  /** One short line for the card, never a bare dash. */
  summary: string
}

function name(id: RegionId): string {
  return REGIONS[id]?.name ?? id
}

function newEntries(before: GameState, after: GameState): GameEvent[] {
  return after.log.slice(before.log.length)
}

/** Regions the card matches, as the resolvers do (scripted cards name regions, others name types). */
function matching(state: GameState, card: PressureCard): RegionId[] {
  return state.config.activeRegions.filter((id) => {
    if (state.regions[id].liberated) return false
    if (card.regions) return card.regions.includes(id)
    return card.regionTypes.includes(regionType(state, id))
  })
}

export function planPreview(state: GameState, slot: PlanSlot): PlanPreview {
  // A chapter with Squeeze or Expand switched off (chapters 1 and 2) still moves cards through those
  // slots, but the enemy turn skips them: say so, and mark nothing.
  if (slot !== 'scout' && !resolveRules(state)[slot]) return { slot, regions: [], summary: 'Not in this chapter' }
  if (slot === 'squeeze') {
    if (!state.squeeze) {
      return { slot, regions: [], summary: state.expand ? 'Arms next round' : 'Nothing to squeeze yet' }
    }
    const after = resolveSqueeze(state)
    const hits = newEntries(state, after).filter((e): e is Extract<GameEvent, { type: 'squeeze' }> => e.type === 'squeeze')
    if (hits.length === 0) return { slot, regions: [], summary: 'No target in play' }
    const parts = hits.map((h) => {
      const bits = [h.lostLand ? '1 Lost Land' : '', h.stallRemoved ? 'a Stall' : '', h.trustLoss > 0 ? `−${h.trustLoss} Trust` : '']
        .filter(Boolean)
        .join(', ')
      return `${name(h.region)} ${bits ? `→ ${bits}` : 'holds'}`
    })
    return { slot, regions: hits.map((h) => h.region), summary: parts.join(' · ') }
  }
  if (slot === 'expand') {
    if (!state.expand) return { slot, regions: [], summary: state.scout ? 'Arms next round' : 'Nothing planned yet' }
    const squeezed = state.squeeze ? resolveSqueeze(state) : state
    const base = squeezed.result ? state : squeezed
    const after = resolveExpand(base)
    const entries = newEntries(base, after).filter((e): e is Extract<GameEvent, { type: 'expand' }> => e.type === 'expand')
    const byRegion = new Map<RegionId, string[]>()
    for (const e of entries) {
      const list = byRegion.get(e.region) ?? []
      list.push(e.piece === 'buyout' ? '+Buyout' : e.piece === 'outlet' ? '+Outlet' : '+Doubt')
      byRegion.set(e.region, list)
    }
    if (byRegion.size === 0) {
      return { slot, regions: [], summary: matching(state, state.expand).length > 0 ? 'Nothing there to build on' : 'No target in play' }
    }
    return {
      slot,
      regions: [...byRegion.keys()],
      summary: [...byRegion].map(([id, list]) => `${name(id)} ${list.join(' ')}`).join(' · '),
    }
  }
  if (!state.scout) return { slot, regions: [], summary: 'Turns up at round end' }
  const next = matching(state, state.scout)
  if (next.length === 0) return { slot, regions: [], summary: 'Expands next round: no target' }
  return { slot, regions: next, summary: `Expands next round: ${next.map(name).join(', ')}` }
}
