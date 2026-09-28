import type { GameState, RegionId } from '../engine/types'
import { addBuyout, addDoubt, addOutlets, removeOutlets } from '../engine/pieces'
import { regionStallTotal } from '../engine/region'
import { REGIONS } from './map'

export interface AgendaCard {
  id: string
  faction: 'hollowell' | 'candor'
  headline: string // satirical news headline, SPEC 4.7: 90 characters maximum
  text: string // plain-English mechanical description of effect + bonusEffect, SPEC 10.5
  effect: (state: GameState) => GameState
  bonusEffect: (state: GameState) => GameState // skipped when Rift is 3 or higher (SPEC 4.7)
}

function nonLiberated(state: GameState): RegionId[] {
  return state.config.activeRegions.filter((id) => !state.regions[id].liberated)
}

// SPEC 4.8: "Agenda cards cannot place pieces there unless the card says 'even liberated regions.'"
// None of this file's Kingsmarket-targeted cards say that, so each must no-op once Kingsmarket is liberated.
function addToKingsmarket(state: GameState, add: (state: GameState, id: RegionId, n: number) => GameState): GameState {
  return state.regions.kingsmarket.liberated ? state : add(state, 'kingsmarket', 1)
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
  // --- Hollowell (12) ---
  {
    id: 'hollowell-farmhouse-range',
    faction: 'hollowell',
    headline: "Hollowell unveils 'Farmhouse' range, made in a very large house.",
    text: 'Add 1 Outlet to each non-liberated Crop region with a Stall. Bonus: add 1 Buyout to Kingsmarket.',
    effect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (REGIONS[id].type === 'crop' && regionStallTotal(next.regions[id]) > 0) next = addOutlets(next, id, 1)
      }
      return next
    },
    bonusEffect: (state) => addToKingsmarket(state, addBuyout),
  },
  {
    id: 'hollowell-support-local-farmers',
    faction: 'hollowell',
    headline: 'Hollowell pledges to support local farmers by buying them.',
    text: 'In the non-liberated region with the fewest Stalls, replace 1 Outlet with a Buyout. Bonus: each producer loses 1 Marks.',
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
    text: 'In the non-liberated region with 2+ Outlets and no Buyout with the most Stalls, add 1 Buyout. Bonus: add 1 Outlet to Kingsmarket.',
    effect: (state) => {
      const candidates = nonLiberated(state).filter((id) => state.regions[id].outlets >= 2 && state.regions[id].buyouts === 0)
      const target = extremeByStallCount(state, candidates, 'most')
      return target ? addBuyout(state, target, 1) : state
    },
    bonusEffect: (state) => addToKingsmarket(state, addOutlets),
  },
  {
    id: 'hollowell-record-harvests',
    faction: 'hollowell',
    headline: 'Hollowell announces record harvests, harvested mostly from paperwork.',
    text: 'Add 1 Outlet to each non-liberated Pasture region with a Stall. Bonus: each producer loses 1 Goodwill.',
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
    text: 'Add 1 Outlet to the non-liberated region with the most Doubt. Bonus: add 1 Doubt to Kingsmarket.',
    effect: (state) => {
      const ids = nonLiberated(state)
      const target = ids.length
        ? ids.reduce((best, id) => (state.regions[id].doubt > state.regions[best].doubt ? id : best))
        : null
      return target ? addOutlets(state, target, 1) : state
    },
    bonusEffect: (state) => addToKingsmarket(state, addDoubt),
  },
  {
    id: 'hollowell-billboard',
    faction: 'hollowell',
    headline: 'Hollowell buys the billboard opposite every market stall in the country.',
    text: 'Add 1 Doubt to each non-liberated Coast region with a Stall. Bonus: each producer loses 1 Produce.',
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
    text: 'Add 1 Outlet to every non-liberated region. Bonus: add 1 Buyout to the non-liberated region with the most Outlets.',
    effect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) next = addOutlets(next, id, 1)
      return next
    },
    bonusEffect: (state) => {
      const ids = nonLiberated(state)
      if (ids.length === 0) return state
      const target = ids.reduce((best, id) => (state.regions[id].outlets > state.regions[best].outlets ? id : best))
      return addBuyout(state, target, 1)
    },
  },
  {
    id: 'hollowell-trademark-fresh',
    faction: 'hollowell',
    headline: "Hollowell files a trademark on the word 'fresh.'",
    text: 'Each producer loses 1 Marks. Bonus: add 1 Outlet to each non-liberated Crop region.',
    effect: (state) => eachProducerLoses(state, 'marks'),
    bonusEffect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (REGIONS[id].type === 'crop') next = addOutlets(next, id, 1)
      }
      return next
    },
  },
  {
    id: 'hollowell-value-meal',
    faction: 'hollowell',
    headline: "Hollowell's new 'value meal' is technically three meals stapled together.",
    text: 'Add 1 Outlet to the non-liberated region with the fewest Stalls. Bonus: each producer loses 1 Produce.',
    effect: (state) => {
      const ids = nonLiberated(state)
      const target = extremeByStallCount(state, ids, 'fewest')
      return target ? addOutlets(state, target, 1) : state
    },
    bonusEffect: (state) => eachProducerLoses(state, 'produce'),
  },
  {
    id: 'hollowell-store-opening',
    faction: 'hollowell',
    headline: 'Hollowell opens a store directly across from Kingsmarket. Coincidence, they say.',
    text: 'Add 1 Outlet to Kingsmarket, if not liberated. Bonus: add 1 Outlet to each non-liberated Coast region.',
    effect: (state) => addToKingsmarket(state, addOutlets),
    bonusEffect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (REGIONS[id].type === 'coast') next = addOutlets(next, id, 1)
      }
      return next
    },
  },
  {
    id: 'hollowell-supply-chain',
    faction: 'hollowell',
    headline: "Hollowell announces a 'resilient supply chain.' Resilient to what, unclear.",
    text: 'Add 1 Outlet to each non-liberated Crop region with a Stall. Bonus: each producer loses 1 Marks.',
    effect: (state) => {
      let next = state
      for (const id of regionsWithStall(next, nonLiberated(next))) {
        if (REGIONS[id].type === 'crop') next = addOutlets(next, id, 1)
      }
      return next
    },
    bonusEffect: (state) => eachProducerLoses(state, 'marks'),
  },
  {
    id: 'hollowell-friendly-buyout-offer',
    faction: 'hollowell',
    headline: "Hollowell makes a 'friendly' buyout offer, twice, in writing.",
    text: 'In the non-liberated region with 2+ Outlets and no Buyout with the fewest Stalls, add 1 Buyout. Bonus: add 1 Outlet to Kingsmarket.',
    effect: (state) => {
      const candidates = nonLiberated(state).filter((id) => state.regions[id].outlets >= 2 && state.regions[id].buyouts === 0)
      const target = extremeByStallCount(state, candidates, 'fewest')
      return target ? addBuyout(state, target, 1) : state
    },
    bonusEffect: (state) => addToKingsmarket(state, addOutlets),
  },
  // --- Candor (12) ---
  {
    id: 'candor-natural-risk-factor',
    faction: 'candor',
    headline: "Candor-funded study finds 'natural' is a risk factor.",
    text: 'Public Trust -1 for each region with 2 or more Doubt. Bonus: add 1 Doubt to the region with the most Stalls.',
    effect: (state) => {
      const count = state.config.activeRegions.filter((id) => state.regions[id].doubt >= 2).length
      return loseTrust(state, count)
    },
    bonusEffect: (state) => {
      const target = extremeByStallCount(state, nonLiberated(state), 'most')
      return target ? addDoubt(state, target, 1) : state
    },
  },
  {
    id: 'candor-wellness-app',
    faction: 'candor',
    headline: 'Candor launches free wellness app. It is very interested in you.',
    text: 'Each producer loses 1 Goodwill. Bonus: add 1 Doubt to each non-liberated Coast region.',
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
    text: 'Public Trust -1. Bonus: add 1 Doubt to the non-liberated region with the fewest Stalls.',
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
    text: 'Add 1 Doubt to each non-liberated Pasture region with a Stall. Bonus: each producer loses 1 Goodwill.',
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
    text: 'Add 1 Doubt to Kingsmarket, if not liberated. Bonus: Public Trust -1 for each region with a Buyout.',
    effect: (state) => addToKingsmarket(state, addDoubt),
    bonusEffect: (state) => {
      const count = state.config.activeRegions.filter((id) => state.regions[id].buyouts > 0).length
      return loseTrust(state, count)
    },
  },
  {
    id: 'candor-wellness-index',
    faction: 'candor',
    headline: "Candor's wellness index rates Marrow's farms as 'concerning.'",
    text: 'Each producer loses 1 Produce. Bonus: add 1 Doubt to each non-liberated region with 2 or more Outlets.',
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
    text: 'Add 1 Doubt to every non-liberated region with a Stall. Bonus: Public Trust -1.',
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
    text: 'Public Trust -1. Bonus: each producer loses 1 Marks.',
    effect: (state) => loseTrust(state, 1),
    bonusEffect: (state) => eachProducerLoses(state, 'marks'),
  },
  {
    id: 'candor-peer-reviewed-by-us',
    faction: 'candor',
    headline: "Candor's study was peer-reviewed. The peers also work at Candor.",
    text: 'Add 1 Doubt to the non-liberated region with the most Stalls. Bonus: Public Trust -1.',
    effect: (state) => {
      const target = extremeByStallCount(state, nonLiberated(state), 'most')
      return target ? addDoubt(state, target, 1) : state
    },
    bonusEffect: (state) => loseTrust(state, 1),
  },
  {
    id: 'candor-awareness-campaign',
    faction: 'candor',
    headline: 'Candor launches an awareness campaign. Nobody is sure what it wants them aware of.',
    text: 'Add 1 Doubt to each non-liberated Pasture region. Bonus: each producer loses 1 Produce.',
    effect: (state) => {
      let next = state
      for (const id of nonLiberated(next)) {
        if (REGIONS[id].type === 'pasture') next = addDoubt(next, id, 1)
      }
      return next
    },
    bonusEffect: (state) => eachProducerLoses(state, 'produce'),
  },
  {
    id: 'candor-independent-panel',
    faction: 'candor',
    headline: "Candor convenes an 'independent panel.' Candor picked the panel.",
    text: 'Add 1 Doubt to Kingsmarket, if not liberated. Bonus: add 1 Doubt to the non-liberated region with the most Stalls.',
    effect: (state) => addToKingsmarket(state, addDoubt),
    bonusEffect: (state) => {
      const ids = nonLiberated(state)
      const target = extremeByStallCount(state, ids, 'most')
      return target ? addDoubt(state, target, 1) : state
    },
  },
  {
    id: 'candor-satisfaction-survey',
    faction: 'candor',
    headline: "Candor's satisfaction survey finds 9 out of 10 Candor employees satisfied.",
    text: 'Each producer loses 1 Goodwill. Bonus: Public Trust -1, if any region has 1 or more Doubt.',
    effect: (state) => eachProducerLoses(state, 'goodwill'),
    bonusEffect: (state) => {
      const count = state.config.activeRegions.filter((id) => state.regions[id].doubt >= 1).length
      return loseTrust(state, Math.min(1, count))
    },
  },
]

export const AGENDA_CARDS_BY_ID: Map<string, AgendaCard> = new Map(AGENDA_CARDS.map((c) => [c.id, c]))
