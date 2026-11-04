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
  /** Plan item 47: the line a phone's narrow plan card shows (the regions only once the full line runs past
   *  about two lines of a 120 px card); the full summary stays in the card's accessible name. */
  short: string
}

/** Longest summary a phone plan card shows whole. */
export const SHORT_MAX = 30
/** Longest summary a desktop plan card (about 200 px) shows whole in its two lines. Plan item 100: 32, was 40;
 *  the regions are chips now, which don't break inside a name, so 'Shingle Bay +Buyout · Saltmarsh +Buyout' (39)
 *  ran to a third line. */
export const LONG_MAX = 32

function shorten(summary: string, regions: RegionId[], prefix = ''): string {
  if (summary.length <= SHORT_MAX) return summary
  const names = regions.map(name)
  if (names.length === 1) return `${prefix}${names[0]}`.length <= SHORT_MAX ? `${prefix}${names[0]}` : names[0]!
  if (names.length === 2 && names.join(' · ').length <= SHORT_MAX) return names.join(' · ')
  return `${names[0]} +${names.length - 1} more`
}

/** A preview with its phone line filled in. */
function done(slot: PlanSlot, regions: RegionId[], summary: string, prefix = ''): PlanPreview {
  return { slot, regions, summary, short: shorten(summary, regions, prefix) }
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
  if (slot !== 'scout' && !resolveRules(state)[slot]) return done(slot, [], 'Not in this chapter')
  if (slot === 'squeeze') {
    if (!state.squeeze) {
      return done(slot, [], state.expand ? 'Arms next round' : 'Nothing to squeeze yet')
    }
    const after = resolveSqueeze(state)
    const hits = newEntries(state, after).filter((e): e is Extract<GameEvent, { type: 'squeeze' }> => e.type === 'squeeze')
    if (hits.length === 0) return done(slot, [], 'No target in play')
    const parts = hits.map((h) => {
      const bits = [h.lostLand ? '1 Lost Land' : '', h.stallRemoved ? 'a Stall' : '', h.trustLoss > 0 ? `−${h.trustLoss} Trust` : '']
        .filter(Boolean)
        .join(', ')
      return `${name(h.region)} ${bits ? `→ ${bits}` : 'holds'}`
    })
    return done(slot, hits.map((h) => h.region), parts.join(' · '))
  }
  if (slot === 'expand') {
    if (!state.expand) return done(slot, [], state.scout ? 'Arms next round' : 'Nothing planned yet')
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
      return done(slot, [], matching(state, state.expand).length > 0 ? 'Nothing there to build on' : 'No target in play')
    }
    return done(
      slot,
      [...byRegion.keys()],
      [...byRegion].map(([id, list]) => `${name(id)} ${list.join(' ')}`).join(' · '),
    )
  }
  if (!state.scout) return done(slot, [], 'Turns up at round end')
  const next = matching(state, state.scout)
  if (next.length === 0) return done(slot, [], 'Expands next round: no target')
  return done(slot, next, `Expands next round: ${next.map(name).join(', ')}`, 'Next round: ')
}
