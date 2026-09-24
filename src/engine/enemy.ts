import { REGIONS } from '../content/map'
import { AGENDA_CARDS } from '../content/agenda'
import { addBuyout, addDoubt, addLostLand, addOutlets, countLiberated } from './pieces'
import { isLiberated, regionStallTotal } from './region'
import { addProduction } from './producer'
import { checkRiftSplit } from './rift'
import type { GameState, PressureCard, ProducerId, RegionId, RegionState } from './types'

const AGENDA_BY_ID = new Map(AGENDA_CARDS.map((c) => [c.id, c]))

// SPEC 4.5.3.1 Agenda: reveal the top card and resolve it. SPEC 4.7 Rift 3 "Cracks" skips bonus effects.
function resolveAgenda(state: GameState): GameState {
  if (state.agendaDeck.length === 0) return state
  const [id, ...rest] = state.agendaDeck as [string, ...string[]]
  const discardPrevious = state.currentAgenda ? [...state.agendaDiscard, state.currentAgenda] : state.agendaDiscard
  const card = AGENDA_BY_ID.get(id)
  if (!card) return { ...state, agendaDeck: rest, agendaDiscard: discardPrevious, currentAgenda: id }
  let next = card.effect({ ...state, agendaDeck: rest, agendaDiscard: discardPrevious, currentAgenda: id })
  const bonusSkipped = next.rift >= 3
  if (!bonusSkipped) next = card.bonusEffect(next)
  next = { ...next, log: [...next.log, { type: 'agenda', cardId: id, bonusSkipped }] }
  next = refreshAllLiberation(next)
  return refreshAllLiberation(checkRiftSplit(next))
}

function matches(card: PressureCard, region: RegionId): boolean {
  return card.regionTypes.includes(REGIONS[region].type)
}

function activeRegions(state: GameState): RegionId[] {
  return state.config.activeRegions
}

// SPEC 4.8: the first time a region is liberated, Public Trust +1 and the liberating producer gains +1
// production: Pasture -> Produce, Crop -> Marks, Coast -> Goodwill, Kingsmarket -> their choice (default
// Marks here; the UI/AI may steer this via a future `currentDecision`, same pattern as the Squeeze
// home-production-loss choice).
function firstLiberationProductionBonus(regionId: RegionId): 'produce' | 'marks' | 'goodwill' {
  const type = REGIONS[regionId].type
  if (type === 'pasture') return 'produce'
  if (type === 'crop') return 'marks'
  if (type === 'coast') return 'goodwill'
  return 'marks'
}

function refreshLiberation(state: GameState, region: RegionId): GameState {
  const r = state.regions[region]
  const nowLiberated = isLiberated(r)
  if (nowLiberated === r.liberated) return state
  if (nowLiberated) {
    const isFirstTime = !r.everLiberated
    const producer = state.activeProducer
    let next: GameState = {
      ...state,
      regions: { ...state.regions, [region]: { ...r, liberated: true, everLiberated: true } },
      log: [...state.log, { type: 'liberated', region, producer }],
    }
    if (isFirstTime) {
      next = { ...next, publicTrust: Math.min(15, next.publicTrust + 1) }
      next = addProduction(next, producer, { [firstLiberationProductionBonus(region)]: 1 })
    }
    return next
  }
  return { ...state, regions: { ...state.regions, [region]: { ...r, liberated: false } } }
}

export function refreshAllLiberation(state: GameState): GameState {
  let next = state
  for (const id of activeRegions(state)) {
    next = refreshLiberation(next, id)
  }
  return next
}

// SPEC 4.7 Scout: each matching, non-liberated region gets 1 Outlet; Stage III cards also add 1 Doubt.
export function resolveScout(state: GameState): GameState {
  const card = state.scout
  if (!card) return state
  let next = state
  for (const id of activeRegions(state)) {
    if (next.regions[id].liberated) continue
    if (!matches(card, id)) continue
    next = addOutlets(next, id, 1)
    if (card.stage === 3) next = addDoubt(next, id, 1)
    next = { ...next, log: [...next.log, { type: 'scout', region: id, doubtAdded: card.stage === 3 }] }
  }
  return refreshAllLiberation(next)
}

// SPEC 4.7 Expand: each matching, non-liberated region with at least 1 enemy piece gets a Buyout if it
// already has 2+ Outlets and no Buyout, otherwise 1 Outlet. Candor also adds 1 Doubt if the region has a Stall.
export function resolveExpand(state: GameState): GameState {
  const card = state.expand
  if (!card) return state
  let next = state
  for (const id of activeRegions(state)) {
    const r = next.regions[id]
    if (r.liberated) continue
    if (!matches(card, id)) continue
    if (state.expandSkip.includes(id)) continue
    const hasEnemyPiece = r.outlets > 0 || r.buyouts > 0 || r.doubt > 0
    if (!hasEnemyPiece) continue
    if (r.outlets >= 2 && r.buyouts === 0) {
      next = addBuyout(next, id, 1)
      next = { ...next, log: [...next.log, { type: 'expand', region: id, piece: 'buyout' }] }
    } else {
      next = addOutlets(next, id, 1)
      next = { ...next, log: [...next.log, { type: 'expand', region: id, piece: 'outlet' }] }
    }
    if (regionStallTotal(next.regions[id]) > 0) {
      next = addDoubt(next, id, 1)
      next = { ...next, log: [...next.log, { type: 'expand', region: id, piece: 'doubt' }] }
    }
  }
  return refreshAllLiberation(next)
}

function pickProducerToLoseStall(state: GameState, region: RegionState): ProducerId {
  let best: ProducerId | null = null
  let bestCount = -1
  for (const [pid, count] of Object.entries(region.stalls) as [ProducerId, number][]) {
    if ((count ?? 0) > bestCount) {
      bestCount = count ?? 0
      best = pid
    }
  }
  return best ?? state.firstPlayer
}

// SPEC 4.7 Squeeze: Damage = Outlets + 2*Buyouts, Defence = Stalls. Damage > Defence places a Lost Land
// token (and, if home region, that producer lowers a production track by 1). Damage >= Defence+3 also
// removes 1 Stall from the producer with the most there. Public Trust drops by min(Doubt, 2).
export function resolveSqueeze(state: GameState, chooseProduction?: (producer: string) => 'produce' | 'marks' | 'goodwill'): GameState {
  const card = state.squeeze
  if (!card) return state
  let next = state
  for (const id of activeRegions(state)) {
    const r = next.regions[id]
    if (r.liberated) continue
    if (!matches(card, id)) continue
    if (state.squeezeSkip.includes(id)) continue
    const damage = r.outlets + 2 * r.buyouts
    const defence = regionStallTotal(r)
    let lostLand = false
    let stallRemoved = false
    if (damage > defence) {
      lostLand = true
      next = addLostLand(next, id)
      if (next.result) return next // pool empty: game lost immediately
      const homeOf = (Object.entries(next.producers).find(([, p]) => REGIONS_HOME[p.id] === id)?.[0] as
        | ProducerId
        | undefined)
      // Home-region production penalty is applied by the caller via currentDecision for a human/AI choice;
      // here we apply a default (first resource with production > 0) when no chooser is supplied.
      if (homeOf) {
        const producer = next.producers[homeOf]
        const track = chooseProduction ? chooseProduction(homeOf) : defaultTrackToLower(producer.production)
        if (track) {
          next = {
            ...next,
            producers: {
              ...next.producers,
              [homeOf]: {
                ...producer,
                production: { ...producer.production, [track]: Math.max(0, producer.production[track] - 1) },
              },
            },
          }
        }
      }
    }
    if (damage >= defence + 3) {
      const loser = pickProducerToLoseStall(next, next.regions[id])
      const current = next.regions[id].stalls[loser] ?? 0
      if (current > 0) {
        stallRemoved = true
        next = {
          ...next,
          regions: {
            ...next.regions,
            [id]: { ...next.regions[id], stalls: { ...next.regions[id].stalls, [loser]: current - 1 } },
          },
        }
      }
    }
    const trustLoss = Math.min(next.regions[id].doubt, 2)
    if (trustLoss > 0) {
      next = { ...next, publicTrust: Math.max(0, next.publicTrust - trustLoss) }
    }
    next = { ...next, log: [...next.log, { type: 'squeeze', region: id, lostLand, stallRemoved, trustLoss }] }
    if (next.publicTrust <= 0) {
      return { ...next, result: { won: false, lossReason: 'publicTrust', regionsLiberated: countLiberated(next), round: next.round } }
    }
  }
  return refreshAllLiberation(next)
}

function defaultTrackToLower(production: { produce: number; marks: number; goodwill: number }): 'produce' | 'marks' | 'goodwill' | null {
  if (production.produce > 0) return 'produce'
  if (production.marks > 0) return 'marks'
  if (production.goodwill > 0) return 'goodwill'
  return null
}

// Filled in lazily to avoid a circular import with content/producers.
const REGIONS_HOME: Record<ProducerId, RegionId> = {
  mara: 'brindleHills',
  tomas: 'oakvale',
  ines: 'rivermead',
  sol: 'saltmarsh',
}

// SPEC 4.5.3.4: reveal the top Pressure card into Scout and resolve it there. Losing if the deck is empty.
function revealAndResolveScout(state: GameState): GameState {
  if (state.pressureDeck.length === 0) {
    return {
      ...state,
      result: { won: false, lossReason: 'pressureDeckEmpty', regionsLiberated: countLiberated(state), round: state.round },
    }
  }
  const [card, ...rest] = state.pressureDeck
  const next = { ...state, pressureDeck: rest, scout: card ?? null }
  return resolveScout(next)
}

// SPEC 4.5.3.5 Advance: discard Squeeze, Expand -> Squeeze, Scout -> Expand.
function advancePipeline(state: GameState): GameState {
  return {
    ...state,
    pressureDiscard: state.squeeze ? [...state.pressureDiscard, state.squeeze] : state.pressureDiscard,
    squeeze: state.expand,
    expand: state.scout,
    scout: null,
  }
}

// SPEC 4.5.3: the full enemy turn — Agenda, Squeeze, Expand, Scout, Advance.
export function runEnemyTurn(state: GameState, chooseProduction?: (producer: string) => 'produce' | 'marks' | 'goodwill'): GameState {
  let next = resolveAgenda(state)
  if (next.result) return next
  next = resolveSqueeze(next, chooseProduction)
  if (next.result) return next
  next = resolveExpand(next)
  next = revealAndResolveScout(next)
  if (next.result) return next
  next = advancePipeline(next)
  return next
}
