import type { GameState, ProducerId } from '../engine/types'
import { addProduction, addResources } from '../engine/producer'

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
  return tagCount(state, producer, includingId, 'community')
}

function tagCount(state: GameState, producer: ProducerId, includingId: string, tag: ImprovementTag): number {
  const owned = [...state.producers[producer].improvements, includingId]
  return owned.filter((id) => IMPROVEMENTS_BY_ID.get(id)?.tags.includes(tag)).length
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
    cost: 2,
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
    cost: 4,
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
    cost: 3,
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
    cost: 3,
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
    cost: 2,
    tags: ['coast', 'community'],
    flavor: 'Supply in Coast regions costs 1 less Produce per Outlet (minimum 1).',
    text: '+1 Marks production. Supply in Coast regions costs 1 less Produce per Outlet (minimum 1).',
    onBuy: (state, producer) => addProduction(state, producer, { marks: 1 }), // ongoing: checked in actions.ts Supply cost
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
    text: 'Schemes cost 1 less Goodwill (minimum 1).',
    onBuy: (state) => state, // ongoing: checked in actions.ts's Scheme cost
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
    text: 'Improvements cost 1 less Marks (minimum 1).',
    onBuy: (state) => state, // ongoing: checked in actions.ts's Invest cost
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

  // --- 12 more for M4's full 36-card count, keeping the same mix (SPEC 7) ---
  {
    id: 'wagon-wheel-press',
    name: 'Wagon Wheel Press',
    cost: 3,
    tags: ['media'],
    flavor: 'Prints the truth, and the odd correction.',
    text: 'Whenever you Sell, gain 1 extra Marks.',
    onBuy: (state) => state, // ongoing: checked in actions.ts's Sell handler
  },
  {
    id: 'compost-exchange',
    name: 'Compost Exchange',
    cost: 4,
    tags: ['crop', 'community'],
    flavor: 'One farmer’s waste is another’s Tuesday.',
    text: 'Whenever you Graft, gain 1 extra Produce.',
    onBuy: (state) => state, // ongoing: checked in actions.ts's Graft handler
  },
  {
    id: 'windbreak-hedgerow',
    name: 'Windbreak Hedgerow',
    cost: 5,
    tags: ['pasture'],
    text: '+1 Produce production and +1 Goodwill production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1, goodwill: 1 }),
  },
  {
    id: 'tidal-smokehouse',
    name: 'Tidal Smokehouse',
    cost: 6,
    tags: ['coast'],
    flavor: 'Slow food, on a tight schedule.',
    text: '+2 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { marks: 2 }),
  },
  {
    id: 'field-notes-app',
    name: 'Field Notes App',
    cost: 4,
    tags: ['science'],
    text: '+1 Marks production for every 2 Science tags you have, including this one.',
    onBuy: (state, producer) => {
      const bonus = Math.floor(tagCount(state, producer, 'field-notes-app', 'science') / 2)
      return addProduction(state, producer, { marks: bonus })
    },
  },
  {
    id: 'late-harvest-fair',
    name: 'Late Harvest Fair',
    cost: 3,
    tags: ['community'],
    flavor: 'One good weekend pays for the stall twice over.',
    text: 'Immediately gain 2 Marks.',
    onBuy: (state, producer) => addResources(state, producer, { marks: 2 }),
  },
  {
    id: 'winter-larder',
    name: 'Winter Larder',
    cost: 5,
    tags: ['pasture', 'community'],
    flavor: 'Stocked before the first frost.',
    text: 'Immediately gain 2 Produce and 1 Goodwill.',
    onBuy: (state, producer) => addResources(state, producer, { produce: 2, goodwill: 1 }),
  },
  {
    id: 'wholesale-crate-deal',
    name: 'Wholesale Crate Deal',
    cost: 5,
    tags: ['crop', 'community'],
    flavor: 'Supply in Crop regions costs 1 less Produce per Outlet (minimum 1).',
    text: 'Supply in Crop regions costs 1 less Produce per Outlet (minimum 1).',
    onBuy: (state) => state, // ongoing: checked in actions.ts Supply cost
  },
  {
    id: 'harbour-watch',
    name: 'Harbour Watch',
    cost: 4,
    tags: ['coast', 'science'],
    flavor: 'Somebody always sees the van coming.',
    text: '+1 Produce production and +1 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1, marks: 1 }),
  },
  {
    id: 'signal-boost',
    name: 'Signal Boost',
    cost: 7,
    tags: ['media', 'science'],
    flavor: 'Loud, and mostly accurate.',
    text: '+2 Goodwill production. Rift +1.',
    onBuy: (state, producer) => {
      let next = addProduction(state, producer, { goodwill: 2 })
      next = { ...next, rift: Math.min(6, next.rift + 1) }
      return next
    },
  },
  {
    id: 'barn-conversion',
    name: 'Barn Conversion',
    cost: 6,
    tags: ['pasture', 'community'],
    text: '+1 Produce production and +1 Marks production.',
    onBuy: (state, producer) => addProduction(state, producer, { produce: 1, marks: 1 }),
  },
  {
    id: 'quayside-workshop',
    name: 'Quayside Workshop',
    cost: 3,
    tags: ['coast', 'community'],
    flavor: 'Nets mended, gossip repaired.',
    text: 'Immediately gain 3 Marks.',
    onBuy: (state, producer) => addResources(state, producer, { marks: 3 }),
  },
]

// SPEC 7: "Campaign-only cards: 3 copies of Wholesome Hollow Contract ... They appear only in chapter 3."
// Kept out of `IMPROVEMENTS` (and so out of the full game's shuffled deck/Market) — `chapterConfig`'s
// `scriptedMarket` places it directly (only 1 of the 3 prints, for balance reasons — see DECISIONS.md and
// `chapters.ts`'s `CHAPTER_3`). `IMPROVEMENTS_BY_ID` still needs to resolve the id, so it's built from both
// arrays below. The contract-Outlet side effect (SPEC 7: "each owned contract adds 1 Outlet to its owner's
// home region at the start of every round, until torn up") is chapter-scripted and gated on
// `state.wholesomeHollowRevealed`, so it's checked by id in `round.ts`/`actions.ts`, the same pattern as
// every other ongoing (non-flat-production) Improvement ability here.
export const WHOLESOME_HOLLOW_CONTRACT: ImprovementCard = {
  id: 'wholesome-hollow-contract',
  name: 'Wholesome Hollow Contract',
  cost: 2,
  tags: ['community'],
  flavor: 'Two Marks, extra income. Practically a gift.',
  text: '+2 Marks production.',
  onBuy: (state, producer) => addProduction(state, producer, { marks: 2 }),
}

export const CAMPAIGN_IMPROVEMENTS: ImprovementCard[] = [WHOLESOME_HOLLOW_CONTRACT]

export const IMPROVEMENTS_BY_ID: Map<string, ImprovementCard> = new Map(
  [...IMPROVEMENTS, ...CAMPAIGN_IMPROVEMENTS].map((c) => [c.id, c]),
)
