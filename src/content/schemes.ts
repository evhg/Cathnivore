import { removeDoubt, removeOutlets } from '../engine/pieces'
import { canOpenStallIn, regionsBorderingLiberated } from '../engine/region'
import { addProduction, addResources } from '../engine/producer'
import type { GameState, ProducerId, RegionId } from '../engine/types'

export type SchemeTag = 'rift' | 'media' | 'market'

export type SchemeTargeting = 'none' | 'required' | 'optional'

export interface SchemeCard {
  id: string
  name: string // SPEC 5: 3 words maximum
  cost: number // Goodwill, 1 to 4
  tags?: SchemeTag[]
  line: string // Cath's voice, SPEC 5: 110 characters maximum
  // Plain-English rules text (SPEC 10.5), shown in Cath's Plan sheet and the rules reference.
  // tests/rules-text.test.ts checks it against `effect`'s actual behaviour.
  text: string
  targeting: SchemeTargeting
  legalTargets?: (state: GameState, producer: ProducerId) => RegionId[]
  effect: (state: GameState, producer: ProducerId, target: RegionId | null) => GameState
}

function ownStallRegions(state: GameState, producer: ProducerId): RegionId[] {
  return state.config.activeRegions.filter((id) => (state.regions[id].stalls[producer] ?? 0) > 0)
}

function regionsWithDoubt(state: GameState): RegionId[] {
  return state.config.activeRegions.filter((id) => state.regions[id].doubt > 0)
}

export const SCHEMES: SchemeCard[] = [
  // --- The 6 exact cards from SPEC 5 ---
  {
    id: 'loss-leader',
    name: 'Loss Leader',
    cost: 2,
    tags: ['market'],
    line: 'They sell at a loss to win. I sell at a profit and win anyway.',
    text: 'Remove 2 Outlets from a region with your Stall.',
    targeting: 'required',
    legalTargets: (state, producer) => ownStallRegions(state, producer).filter((id) => state.regions[id].outlets > 0),
    effect: (state, _producer, target) => (target ? removeOutlets(state, target, 2) : state),
  },
  {
    id: 'leaked-memo',
    name: 'Leaked Memo',
    cost: 3,
    tags: ['rift'],
    line: 'Nothing in an office is more dangerous than the printer.',
    text: 'Rift +2. Remove 1 Doubt anywhere.',
    targeting: 'optional',
    legalTargets: (state) => regionsWithDoubt(state),
    effect: (state, _producer, target) => {
      let next = { ...state, rift: Math.min(6, state.rift + 2) }
      if (target) next = removeDoubt(next, target, 1)
      return next
    },
  },
  {
    id: 'grass-roots',
    name: 'Grass Roots',
    cost: 1,
    tags: ['market'],
    line: 'Roots first. Then shoots. Then lawyers.',
    text: 'Open a Stall for free in any region bordering a liberated region.',
    targeting: 'required',
    legalTargets: (state, producer) =>
      regionsBorderingLiberated(state).filter((id) => canOpenStallIn(state, producer, id)),
    effect: (state, producer, target) => {
      if (!target) return state
      const r = state.regions[target]
      return { ...state, regions: { ...state.regions, [target]: { ...r, stalls: { ...r.stalls, [producer]: (r.stalls[producer] ?? 0) + 1 } } } }
    },
  },
  {
    id: 'steak-out',
    name: 'Steak-out',
    cost: 2,
    line: "I don't guess where they'll go. I wait where they're going.",
    text: 'Look at the top Pressure card. You may put it at the bottom of its stage. (Irreversible.)',
    targeting: 'none',
    // Irreversible (SPEC 4.6): peeks the Pressure deck. Simplified to always move the peeked card to the
    // bottom of its stage, which is the only choice that's ever worth making after a free look.
    effect: (state) => {
      const [top, ...rest] = state.pressureDeck
      if (!top) return state
      const stageEnd = rest.reduce((idx, c, i) => (c.stage === top.stage ? i + 1 : idx), 0)
      const reordered = [...rest.slice(0, stageEnd), top, ...rest.slice(stageEnd)]
      return { ...state, pressureDeck: reordered }
    },
  },
  {
    id: 'blind-taste-test',
    name: 'Blind Taste Test',
    cost: 2,
    line: 'Blindfolds on. Now tell me which one is food.',
    text: 'Choose a region with your Stall. If it has no Doubt, Public Trust +2; otherwise remove all Doubt there.',
    targeting: 'required',
    legalTargets: (state, producer) => ownStallRegions(state, producer),
    effect: (state, _producer, target) => {
      if (!target) return state
      if (state.regions[target].doubt === 0) return { ...state, publicTrust: Math.min(15, state.publicTrust + 2) }
      return removeDoubt(state, target, state.regions[target].doubt)
    },
  },
  {
    id: 'sunlight',
    name: 'Sunlight',
    cost: 3,
    line: 'They hate two things: daylight and minutes being taken.',
    text: 'Choose a region. Squeeze skips it this round.',
    targeting: 'required',
    legalTargets: (state) => state.config.activeRegions.filter((id) => !state.regions[id].liberated),
    effect: (state, _producer, target) => (target ? { ...state, squeezeSkip: [...state.squeezeSkip, target] } : state),
  },

  // --- 12 more, filling out the mix from SPEC 5 (~10 removal/tempo, 6 economy, 5 info, 5 rift, 4 defensive) ---
  {
    id: 'price-war',
    name: 'Price War',
    cost: 1,
    tags: ['market'],
    line: "I don't cut corners. I cut prices, then corners find themselves.",
    text: 'Remove 1 Outlet from a region with your Stall.',
    targeting: 'required',
    legalTargets: (state, producer) => ownStallRegions(state, producer).filter((id) => state.regions[id].outlets > 0),
    effect: (state, _producer, target) => (target ? removeOutlets(state, target, 1) : state),
  },
  {
    id: 'buyout-the-buyout',
    name: 'Buy It Back',
    cost: 4,
    tags: ['market'],
    line: "They bought the fence. I'm buying it back, spite included.",
    text: 'Remove 1 Buyout from a region with your Stall.',
    targeting: 'required',
    legalTargets: (state, producer) => ownStallRegions(state, producer).filter((id) => state.regions[id].buyouts > 0),
    effect: (state, _producer, target) => {
      if (!target) return state
      const r = state.regions[target]
      return { ...state, buyoutPool: state.buyoutPool + 1, regions: { ...state.regions, [target]: { ...r, buyouts: r.buyouts - 1 } } }
    },
  },
  {
    id: 'friendly-inspector',
    name: 'Friendly Inspector',
    cost: 1,
    line: "Pip signs off on the paperwork. He likes us. For now.",
    text: 'Remove 1 Doubt from a region with your Stall.',
    targeting: 'required',
    legalTargets: (state, producer) => ownStallRegions(state, producer).filter((id) => state.regions[id].doubt > 0),
    effect: (state, _producer, target) => (target ? removeDoubt(state, target, 1) : state),
  },
  {
    id: 'good-harvest',
    name: 'Good Harvest',
    cost: 2,
    tags: ['market'],
    line: "Rain when we needed it. For once, not them.",
    text: 'Gain 3 Produce.',
    targeting: 'none',
    effect: (state, producer) => addResources(state, producer, { produce: 3 }),
  },
  {
    id: 'small-loan',
    name: 'Small Loan',
    cost: 1,
    tags: ['market'],
    line: 'From a friend, not a bank. The interest is a favour owed.',
    text: 'Gain 3 Marks.',
    targeting: 'none',
    effect: (state, producer) => addResources(state, producer, { marks: 3 }),
  },
  {
    id: 'goodwill-tour',
    name: 'Goodwill Tour',
    cost: 2,
    line: "I shook every hand in Highmoor. My arm still hurts.",
    text: '+1 Goodwill production.',
    targeting: 'none',
    effect: (state, producer) => addProduction(state, producer, { goodwill: 1 }),
  },
  {
    id: 'seasonal-bonus',
    name: 'Seasonal Bonus',
    cost: 3,
    tags: ['market'],
    line: "Every season is our season, technically.",
    text: '+1 Produce production and +1 Marks production.',
    targeting: 'none',
    effect: (state, producer) => addProduction(state, producer, { produce: 1, marks: 1 }),
  },
  {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    cost: 1,
    line: "I don't spy. I just ask questions nobody else thinks to.",
    text: 'Look at the top Pressure card.',
    targeting: 'none',
    // Information: lets the player look at the top Pressure card (a UI-only reveal; the engine's state is
    // already fully known to the caller, so there is nothing to change here beyond the peek itself).
    effect: (state) => state,
  },
  {
    id: 'inside-source',
    name: 'Inside Source',
    cost: 2,
    line: "Everyone in Kingsmarket owes somebody a favour. Today it's me.",
    text: 'Swap the top two cards of the Agenda deck.',
    targeting: 'none',
    effect: (state) => {
      if (state.agendaDeck.length < 2) return state
      const [a, b, ...rest] = state.agendaDeck as [string, string, ...string[]]
      return { ...state, agendaDeck: [b, a, ...rest] }
    },
  },
  {
    id: 'whistleblower',
    name: 'Whistleblower',
    cost: 3,
    tags: ['rift', 'media'],
    line: "Somebody always talks. Today it's someone on their side.",
    text: 'Rift +1.',
    targeting: 'none',
    effect: (state) => ({ ...state, rift: Math.min(6, state.rift + 1) }),
  },
  {
    id: 'competing-lawsuits',
    name: 'Competing Lawsuits',
    cost: 4,
    tags: ['rift'],
    line: "Let them sue each other. I'll bring popcorn and a subpoena.",
    text: 'Rift +2.',
    targeting: 'none',
    effect: (state) => ({ ...state, rift: Math.min(6, state.rift + 2) }),
  },
  {
    id: 'closed-for-stocktake',
    name: 'Closed For Stocktake',
    cost: 3,
    line: "Gone to count the till. Back never, ideally.",
    text: 'Choose a region. Expand skips it this round.',
    targeting: 'required',
    legalTargets: (state) => state.config.activeRegions.filter((id) => !state.regions[id].liberated),
    effect: (state, _producer, target) => (target ? { ...state, expandSkip: [...state.expandSkip, target] } : state),
  },
]

export const SCHEMES_BY_ID: Map<string, SchemeCard> = new Map(SCHEMES.map((c) => [c.id, c]))

export function legalSchemeTargets(state: GameState, producer: ProducerId, schemeId: string): (RegionId | null)[] {
  const card = SCHEMES_BY_ID.get(schemeId)
  if (!card) return []
  if (card.targeting === 'none') return [null]
  const targets = card.legalTargets ? card.legalTargets(state, producer) : []
  if (card.targeting === 'optional') return targets.length > 0 ? targets : [null]
  return targets
}
