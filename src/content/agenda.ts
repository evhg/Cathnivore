import type { GameState, RegionId } from '../engine/types'
import { addBuyout, addDoubt, addOutlets, removeOutlets } from '../engine/pieces'
import { regionStallTotal } from '../engine/region'
import { REGIONS } from './map'

export interface AgendaCard {
  id: string
  faction: 'hollowell' | 'candor'
  headline: string // satirical news headline, SPEC 4.7: 90 characters maximum
  effect: (state: GameState) => GameState
  bonusEffect: (state: GameState) => GameState // skipped when Rift is 3 or higher (SPEC 4.7)
}

function nonLiberated(state: GameState): RegionId[] {
  return state.config.activeRegions.filter((id) => !state.regions[id].liberated)
}

function regionsWithStall(state: GameState, ids: RegionId[]): RegionId[] {
  return ids.filter((id) => regionStallTotal(state.regions[id]) > 0)
}

function extremeByStallCount(state: GameState, ids: RegionId[], pick: 'most' | 'fewest'): RegionId | null {
  if (ids.length === 0) return null
  return ids.reduce((best, id) => {
    const a = regionStallTotal(state.regions[id])
    const b = regionStallTotal(state.regions[best])
    return pick === 'most' ? (a > b ? id : best) : a < b ? id : best
  })
}

function eachProducerLoses(state: GameState, resource: 'produce' | 'marks' | 'goodwill'): GameState {
  let next = state
  for (const pid of next.config.producers) {
    const p = next.producers[pid]
    next = {
      ...next,
      producers: {
        ...next.producers,
        [pid]: { ...p, resources: { ...p.resources, [resource]: Math.max(0, p.resources[resource] - 1) } },
      },
    }
  }
  return next
}

function loseTrust(state: GameState, amount: number): GameState {
  return { ...state, publicTrust: Math.max(0, state.publicTrust - amount) }
}

export const AGENDA_CARDS: AgendaCard[] = [
  // --- Hollowell (8) ---
  {
    id: 'hollowell-farmhouse-range',
    faction: 'hollowell',
    headline: "Hollowell unveils 'Farmhouse' range, made in a very large house.",
    effect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (REGIONS[id].type === 'crop' && regionStallTotal(next.regions[id]) > 0) next = addOutlets(next, id, 1)
      }
      return next
    },
    bonusEffect: (state) => addBuyout(state, 'kingsmarket', 1),
  },
  {
    id: 'hollowell-support-local-farmers',
    faction: 'hollowell',
    headline: 'Hollowell pledges to support local farmers by buying them.',
    effect: (state) => {
      const target = extremeByStallCount(state, nonLiberated(state), 'fewest')
      if (!target || state.regions[target].outlets === 0) return state
      return addBuyout(removeOutlets(state, target, 1), target, 1)
    },
    bonusEffect: (state) => eachProducerLoses(state, 'marks'),
  },
  {
    id: 'hollowell-loyalty-card',
    faction: 'hollowell',
    headline: 'Hollowell rolls out a loyalty card. Points are redeemable for more Hollowell.',
    effect: (state) => {
      const candidates = nonLiberated(state).filter((id) => state.regions[id].outlets >= 2 && state.regions[id].buyouts === 0)
      const target = extremeByStallCount(state, candidates, 'most')
      return target ? addBuyout(state, target, 1) : state
    },
    bonusEffect: (state) => addOutlets(state, 'kingsmarket', 1),
  },
  {
    id: 'hollowell-record-harvests',
    faction: 'hollowell',
    headline: 'Hollowell announces record harvests, harvested mostly from paperwork.',
    effect: (state) => {
      let next = state
      for (const id of regionsWithStall(next, nonLiberated(next))) {
        if (REGIONS[id].type === 'pasture') next = addOutlets(next, id, 1)
      }
      return next
    },
    bonusEffect: (state) => eachProducerLoses(state, 'goodwill'),
  },
  {
    id: 'hollowell-listening-tour',
    faction: 'hollowell',
    headline: "Hollowell announces a 'community listening tour.' No forks were consulted.",
    effect: (state) => {
      const ids = nonLiberated(state)
      const target = ids.length
        ? ids.reduce((best, id) => (state.regions[id].doubt > state.regions[best].doubt ? id : best))
        : null
      return target ? addOutlets(state, target, 1) : state
    },
    bonusEffect: (state) => addDoubt(state, 'kingsmarket', 1),
  },
  {
    id: 'hollowell-billboard',
    faction: 'hollowell',
    headline: 'Hollowell buys the billboard opposite every market stall in the country.',
    effect: (state) => {
      let next = state
      for (const id of regionsWithStall(next, nonLiberated(next))) {
        if (REGIONS[id].type === 'coast') next = addDoubt(next, id, 1)
      }
      return next
    },
    bonusEffect: (state) => eachProducerLoses(state, 'produce'),
  },
  {
    id: 'hollowell-sunny-the-silo',
    faction: 'hollowell',
    headline: "Hollowell's new mascot, Sunny the Silo, tests very well with focus groups.",
    effect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) next = addOutlets(next, id, 1)
      return next
    },
    bonusEffect: (state) => {
      const ids = state.config.activeRegions
      const target = ids.reduce((best, id) => (state.regions[id].outlets > state.regions[best].outlets ? id : best))
      return addBuyout(state, target, 1)
    },
  },
  {
    id: 'hollowell-trademark-fresh',
    faction: 'hollowell',
    headline: "Hollowell files a trademark on the word 'fresh.'",
    effect: (state) => eachProducerLoses(state, 'marks'),
    bonusEffect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (REGIONS[id].type === 'crop') next = addOutlets(next, id, 1)
      }
      return next
    },
  },
  // --- Candor (8) ---
  {
    id: 'candor-natural-risk-factor',
    faction: 'candor',
    headline: "Candor-funded study finds 'natural' is a risk factor.",
    effect: (state) => {
      const count = state.config.activeRegions.filter((id) => state.regions[id].doubt >= 2).length
      return loseTrust(state, count)
    },
    bonusEffect: (state) => {
      const target = extremeByStallCount(state, state.config.activeRegions, 'most')
      return target ? addDoubt(state, target, 1) : state
    },
  },
  {
    id: 'candor-wellness-app',
    faction: 'candor',
    headline: 'Candor launches a free wellness app. It is very interested in you.',
    effect: (state) => eachProducerLoses(state, 'goodwill'),
    bonusEffect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (REGIONS[id].type === 'coast') next = addDoubt(next, id, 1)
      }
      return next
    },
  },
  {
    id: 'candor-more-research-needed',
    faction: 'candor',
    headline: "Candor's new white paper concludes more research is needed, funded by Candor.",
    effect: (state) => loseTrust(state, 1),
    bonusEffect: (state) => {
      const target = extremeByStallCount(state, nonLiberated(state), 'fewest')
      return target ? addDoubt(state, target, 1) : state
    },
  },
  {
    id: 'candor-balanced-debate',
    faction: 'candor',
    headline: "Candor sponsors a 'balanced debate' with itself on both sides.",
    effect: (state) => {
      let next = state
      for (const id of regionsWithStall(next, nonLiberated(next))) {
        if (REGIONS[id].type === 'pasture') next = addDoubt(next, id, 1)
      }
      return next
    },
    bonusEffect: (state) => eachProducerLoses(state, 'goodwill'),
  },
  {
    id: 'candor-clarifies-clarification',
    faction: 'candor',
    headline: "Candor's spokesperson clarifies the clarification of yesterday's clarification.",
    effect: (state) => addDoubt(state, 'kingsmarket', 1),
    bonusEffect: (state) => {
      const count = state.config.activeRegions.filter((id) => state.regions[id].buyouts > 0).length
      return loseTrust(state, count)
    },
  },
  {
    id: 'candor-wellness-index',
    faction: 'candor',
    headline: "Candor's wellness index rates Marrow's farms as 'concerning.'",
    effect: (state) => eachProducerLoses(state, 'produce'),
    bonusEffect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (next.regions[id].outlets >= 2) next = addDoubt(next, id, 1)
      }
      return next
    },
  },
  {
    id: 'candor-sponsored-segment',
    faction: 'candor',
    headline: 'Candor buys a sponsored segment on the evening news, right after the weather.',
    effect: (state) => {
      let next = state
      for (const id of regionsWithStall(next, nonLiberated(next))) next = addDoubt(next, id, 1)
      return next
    },
    bonusEffect: (state) => loseTrust(state, 1),
  },
  {
    id: 'candor-second-opinion-discouraged',
    faction: 'candor',
    headline: 'Candor advises that seeking a second opinion may cause unnecessary alarm.',
    effect: (state) => loseTrust(state, 1),
    bonusEffect: (state) => eachProducerLoses(state, 'marks'),
  },
]

export const AGENDA_CARDS_BY_ID: Map<string, AgendaCard> = new Map(AGENDA_CARDS.map((c) => [c.id, c]))
