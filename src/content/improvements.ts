import type { GameState, ProducerId } from '../engine/types'
import { addProduction } from '../engine/producer'

export type ImprovementTag = 'pasture' | 'crop' | 'coast' | 'community' | 'media' | 'science'

export interface ImprovementCard {
  id: string
  name: string
  cost: number // Marks
  tags: ImprovementTag[] // 1 or 2
  flavor?: string // SPEC 7: 80 characters maximum
  // Plain-English rules text (SPEC 10.5: generated from or checked against the rules data), shown in the
  // Market sheet and the rules reference. tests/rules-text.test.ts checks it against `onBuy`'s actual effect.
  text: string
  // Applied once, immediately, when bought. Ongoing abilities that aren't a flat production bump (Supply
  // discounts, extra free Rebut, Harvest triggers) are instead checked by id at the point they apply
  // (src/engine/actions.ts, src/engine/round.ts) via `hasImprovement`.
  onBuy: (state: GameState, producer: ProducerId) => GameState
}

function communityTagCount(state: GameState, producer: ProducerId, includingId: string): number {
  const owned = [...state.producers[producer].improvements, includingId]
  return owned.filter((id) => IMPROVEMENTS_BY_ID.get(id)?.tags.includes('community')).length
}

export const IMPROVEMENTS: ImprovementCard[] = [
  // --- The 6 exact cards from SPEC 7 ---
  {
    id: 'farm-shop',
    name: 'Farm Shop',
    cost: 3,
    tags: ['community'],
    text: '+1 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { marks: 1 }),
  },
  {
    id: 'rotational-grazing',
    name: 'Rotational Grazing',
    cost: 6,
    tags: ['pasture'],
    text: '+2 Produce production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 2 }),
  },
  {
    id: 'mobile-butcher',
    name: 'Mobile Butcher',
    cost: 5,
    tags: ['pasture', 'community'],
    flavor: 'Supply in Pasture regions costs 1 less Produce per Outlet (minimum 1).',
    text: 'Supply in Pasture regions costs 1 less Produce per Outlet (minimum 1).',
    onBuy: (state) => state, // ongoing: checked in actions.ts Supply cost
  },
  {
    id: 'soil-lab-report',
    name: 'Soil Lab Report',
    cost: 4,
    tags: ['crop', 'science'],
    flavor: 'When you Rebut, you may remove 1 extra Doubt for free.',
    text: '+1 Goodwill production. When you Rebut, you may remove 1 extra Doubt for free.',
    onBuy: (state, producer) => addProduction(state, producer, { goodwill: 1 }), // ongoing bonus checked in actions.ts Rebut
  },
  {
    id: 'veg-box-round',
    name: 'Veg Box Round',
    cost: 5,
    tags: ['crop', 'community'],
    text: '+1 Marks production for every 2 Community tags you have, including this one.',
    onBuy: (state, producer) => {
      const bonus = Math.floor(communityTagCount(state, producer, 'veg-box-round') / 2)
      return addProduction(state, producer, { marks: bonus })
    },
  },
  {
    id: 'oyster-beds',
    name: 'Oyster Beds',
    cost: 4,
    tags: ['coast'],
    flavor: 'At Harvest, also gain 1 Goodwill if you have a Stall in Shingle Bay.',
    text: '+1 Produce production. At Harvest, also gain 1 Goodwill if you have a Stall in Shingle Bay.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1 }), // Harvest bonus checked in round.ts
  },

  // --- 18 more, filling out the mix from SPEC 7 (~50% production, ~30% ongoing, ~10% tag-scaling, ~10% one-off) ---
  {
    id: 'roadside-stand',
    name: 'Roadside Stand',
    cost: 3,
    tags: ['community'],
    flavor: 'Honesty box. Mostly honest.',
    text: '+1 Produce production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1 }),
  },
  {
    id: 'heritage-herd',
    name: 'Heritage Herd',
    cost: 6,
    tags: ['pasture'],
    flavor: 'Slower cattle, better opinions.',
    text: '+2 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { marks: 2 }),
  },
  {
    id: 'polytunnel',
    name: 'Polytunnel',
    cost: 5,
    tags: ['crop'],
    text: '+2 Produce production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 2 }),
  },
  {
    id: 'tide-tables',
    name: 'Tide Tables',
    cost: 3,
    tags: ['coast', 'science'],
    flavor: "Written down. Argued about anyway.",
    text: '+1 Goodwill production.',
    onBuy: (state, producer) => addProduction(state, producer, { goodwill: 1 }),
  },
  {
    id: 'letterpress-flyers',
    name: 'Letterpress Flyers',
    cost: 4,
    tags: ['media'],
    flavor: 'Smells like ink. Reads like honesty.',
    text: '+1 Goodwill production.',
    onBuy: (state, producer) => addProduction(state, producer, { goodwill: 1 }),
  },
  {
    id: 'grazing-co-op',
    name: 'Grazing Co-op',
    cost: 7,
    tags: ['pasture', 'community'],
    text: '+1 Produce production and +1 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1, marks: 1 }),
  },
  {
    id: 'seed-library',
    name: 'Seed Library',
    cost: 4,
    tags: ['crop', 'science'],
    flavor: 'Borrow a seed, return two.',
    text: '+1 Produce production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1 }),
  },
  {
    id: 'community-larder',
    name: 'Community Larder',
    cost: 4,
    tags: ['community'],
    flavor: 'Take what you need. Mostly works.',
    text: '+1 Goodwill production.',
    onBuy: (state, producer) => addProduction(state, producer, { goodwill: 1 }),
  },
  {
    id: 'harbour-stall-licence',
    name: 'Harbour Stall Licence',
    cost: 3,
    tags: ['coast', 'community'],
    text: '+1 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { marks: 1 }),
  },
  {
    id: 'market-day-banner',
    name: 'Market Day Banner',
    cost: 2,
    tags: ['media', 'community'],
    flavor: 'Bunting: the original algorithm.',
    text: '+1 Goodwill production for every 2 Community tags you have, including this one.',
    onBuy: (state, producer) => {
      const bonus = Math.floor(communityTagCount(state, producer, 'market-day-banner') / 2)
      return addProduction(state, producer, { goodwill: bonus })
    },
  },
  {
    id: 'press-contact',
    name: 'Press Contact',
    cost: 5,
    tags: ['media'],
    flavor: 'Returns your calls. Sometimes prints your quote.',
    text: '+2 Goodwill production.',
    onBuy: (state, producer) => addProduction(state, producer, { goodwill: 2 }),
  },
  {
    id: 'irrigation-line',
    name: 'Irrigation Line',
    cost: 6,
    tags: ['crop'],
    text: '+2 Produce production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 2 }),
  },
  {
    id: 'cold-store',
    name: 'Cold Store',
    cost: 5,
    tags: ['pasture', 'science'],
    flavor: 'Keeps the beef. Keeps its cool.',
    text: '+1 Produce production and +1 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1, marks: 1 }),
  },
  {
    id: 'satellite-forecast',
    name: 'Satellite Forecast',
    cost: 3,
    tags: ['science'],
    flavor: "It's going to rain. It's always going to rain.",
    text: '+1 Goodwill production.',
    onBuy: (state, producer) => addProduction(state, producer, { goodwill: 1 }),
  },
  {
    id: 'wholesale-account',
    name: 'Wholesale Account',
    cost: 4,
    tags: ['community'],
    text: '+2 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { marks: 2 }),
  },
  {
    id: 'kelp-beds',
    name: 'Kelp Beds',
    cost: 6,
    tags: ['coast', 'science'],
    text: '+1 Produce production and +1 Goodwill production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1, goodwill: 1 }),
  },
  {
    id: 'op-ed-column',
    name: 'Op-ed Column',
    cost: 8,
    tags: ['media'],
    flavor: 'Raises eyebrows. And Rift.',
    text: '+1 Goodwill production. Rift +1.',
    onBuy: (state, producer) => {
      let next = addProduction(state, producer, { goodwill: 1 })
      next = { ...next, rift: Math.min(6, next.rift + 1) }
      return next
    },
  },
  {
    id: 'listening-post',
    name: 'Listening Post',
    cost: 9,
    tags: ['media', 'science'],
    flavor: "Somebody's always listening. Might as well be you.",
    text: '+1 Marks production and +1 Goodwill production. Rift +1.',
    onBuy: (state, producer) => {
      let next = addProduction(state, producer, { marks: 1, goodwill: 1 })
      next = { ...next, rift: Math.min(6, next.rift + 1) }
      return next
    },
  },
]

export const IMPROVEMENTS_BY_ID: Map<string, ImprovementCard> = new Map(IMPROVEMENTS.map((c) => [c.id, c]))
