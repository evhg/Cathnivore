// Plan item 25: what each of Tomorrow's papers will actually do, in words, for the plan cards. It runs the
// real resolvers on the current state and reads the log entries they add, so the preview can never drift
// from the rules (Squeeze, then Expand on the state Squeeze leaves; the Scout card Expands next round).
import { REGIONS, regionType } from '../content/map'
import { resolveRules } from './rules'
import { resolveExpand, resolveSqueeze } from './enemy'
import { applyActionEffect } from './actions'
import type { Action, GameState, GameEvent, PressureCard, RegionId } from './types'

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

/** Plan item 451: what dropping a card on a region will do, read off the real resolver before the turn passes
 *  (`applyActionEffect`), so the chips over the hex are the move's result and nothing else. */
export interface RegionDelta {
  /** The active producer's own stalls on the region. */
  stalls: number
  outlets: number
  buyouts: number
  doubt: number
  liberated: boolean
}

export interface ActionPreview {
  region: RegionId
  regionDelta: RegionDelta
  produce: number
  marks: number
  goodwill: number
  trust: number
  /** Short signed chips for the hex, in reading order ('+1 Stall', '−1 Outlet', '−1 Produce'). */
  chips: { text: string; sign: '+' | '-' | '!' }[]
}

/** The region an action plays into, if it has one. */
export function actionRegion(action: Action): RegionId | undefined {
  if ('region' in action && action.region) return action.region
  if ((action.kind === 'scheme' || action.kind === 'role') && action.targetRegion) return action.targetRegion
  return undefined
}

function chip(n: number, one: string, many = `${one}s`): { text: string; sign: '+' | '-' } | undefined {
  if (n === 0) return undefined
  return { text: `${n > 0 ? '+' : '−'}${Math.abs(n)} ${Math.abs(n) === 1 ? one : many}`, sign: n > 0 ? '+' : '-' }
}

export function actionPreview(state: GameState, action: Action): ActionPreview | undefined {
  const region = actionRegion(action)
  if (!region) return undefined
  let after: GameState
  try {
    after = applyActionEffect(structuredClone(state), action)
  } catch {
    return undefined
  }
  const me = state.activeProducer
  const b = state.regions[region]
  const a = after.regions[region]
  const regionDelta: RegionDelta = {
    stalls: (a.stalls[me] ?? 0) - (b.stalls[me] ?? 0),
    outlets: a.outlets - b.outlets,
    buyouts: a.buyouts - b.buyouts,
    doubt: a.doubt - b.doubt,
    liberated: a.liberated && !b.liberated,
  }
  const res = (g: GameState) => g.producers[me].resources
  const produce = res(after).produce - res(state).produce
  const marks = res(after).marks - res(state).marks
  const goodwill = res(after).goodwill - res(state).goodwill
  const trust = after.publicTrust - state.publicTrust
  const chips = [
    regionDelta.liberated ? { text: 'Liberated', sign: '!' as const } : undefined,
    chip(regionDelta.stalls, 'Stall'),
    chip(regionDelta.outlets, 'Outlet'),
    chip(regionDelta.buyouts, 'Buyout'),
    chip(regionDelta.doubt, 'Doubt', 'Doubt'),
    chip(trust, 'Trust', 'Trust'),
    chip(produce, 'Produce', 'Produce'),
    chip(marks, 'Mark'),
    chip(goodwill, 'Goodwill', 'Goodwill'),
  ].filter((c): c is { text: string; sign: '+' | '-' | '!' } => !!c)
  return { region, regionDelta, produce, marks, goodwill, trust, chips }
}
