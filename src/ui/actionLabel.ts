import { REGIONS } from '../content/map'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'
import { PRODUCERS } from '../content/producers'
import {
  investCost,
  rebutCost,
  schemeCost,
  supplyBuyoutCost,
  supplyOutletCostPerOutlet,
  TEAR_UP_CONTRACT_COST,
} from '../engine/actions'
import type { Action, Faction, GameState, RegionId, ResourceKind } from '../engine/types'

const RESOURCE_NAME = { produce: 'Produce', marks: 'Marks', goodwill: 'Goodwill' } as const
const FACTION_NAME = { hollowell: 'Hollowell', candor: 'Candor' } as const

// A `decide` choice is a `ResourceKind` (squeeze/Kingsmarket), a `Faction` (Rift 6's faction pick) or a
// `RegionId` (Rift 6's per-piece removal target) — pick whichever name matches SPEC 4.7/9.1's `decide`.
function decisionChoiceName(choice: ResourceKind | Faction | RegionId): string {
  if (choice in RESOURCE_NAME) return RESOURCE_NAME[choice as ResourceKind]
  if (choice in FACTION_NAME) return FACTION_NAME[choice as Faction]
  return REGIONS[choice as RegionId].name
}

// A plain-English label for a fully-specified legal Action, used until the real map/card UI (SPEC 10)
// exists. `legalActions` already expands every choice (region, card, track) into its own Action, so one
// button per array entry is enough to drive a whole game.
export function actionLabel(action: Action, state: GameState): string {
  switch (action.kind) {
    case 'openStall':
      return `Open Stall in ${REGIONS[action.region].name}`
    case 'supplyOutlets':
      return `Supply: remove ${action.count} Outlet${action.count > 1 ? 's' : ''} in ${REGIONS[action.region].name}`
    case 'supplyBuyout':
      return `Supply: remove Buyout in ${REGIONS[action.region].name}`
    case 'rebut':
      return `Rebut: remove ${action.count} Doubt in ${REGIONS[action.region].name}`
    case 'invest': {
      const card = IMPROVEMENTS_BY_ID.get(action.improvementId)
      return `Invest: buy ${card?.name ?? action.improvementId} (${card?.cost ?? '?'} Marks)`
    }
    case 'sell':
      return `Sell ${action.count} Produce for ${action.count} ${action.count === 1 ? 'Mark' : 'Marks'}`
    case 'scheme': {
      const card = SCHEMES_BY_ID.get(action.schemeId)
      const target = action.targetRegion ? ` in ${REGIONS[action.targetRegion].name}` : ''
      return `Scheme: ${card?.name ?? action.schemeId}${target}`
    }
    case 'graft':
      return 'Graft: +1 Produce, +1 Marks'
    case 'role': {
      const roleName = PRODUCERS[state.activeProducer].roleName
      const target = action.targetRegion ? ` on ${REGIONS[action.targetRegion].name}` : ''
      const choice = action.choice === 'trust' ? ': Public Trust +1' : action.choice === 'goodwill' ? ': +2 Goodwill' : ''
      return `Role (${roleName})${target}${choice}`
    }
    case 'decide':
      return `Choose ${decisionChoiceName(action.choice)}`
    case 'tearUpContract':
      return 'Tear Up the Contract (3 Marks)'
  }
}

// ROADMAP 9's "cost chips shown with resource tokens": the resource and amount an action actually
// spends, for a UI-layer chip to render as an icon (reusing the topbar/active-producer panel's existing
// `ProduceIcon`/`MarksIcon`/`GoodwillIcon`, no new art needed) rather than the plain-text costs
// `actionLabel` above already spells out. Calls the exact same cost functions `applyAction` (engine/
// actions.ts) uses to actually spend the resource — one source of truth, so a chip can never drift from
// what the button actually costs when tapped. `undefined` for actions with no resource cost (Graft is a
// pure gain; Role abilities are free, SPEC 6; `decide` isn't a player-initiated spend).
export function actionCost(action: Action, state: GameState): { resource: ResourceKind; amount: number } | undefined {
  const producer = state.activeProducer
  switch (action.kind) {
    case 'openStall':
      return { resource: 'produce', amount: 1 }
    case 'supplyOutlets':
      return { resource: 'produce', amount: supplyOutletCostPerOutlet(state, producer, action.region) * action.count }
    case 'supplyBuyout':
      return { resource: 'produce', amount: supplyBuyoutCost(state, producer) }
    case 'rebut':
      return { resource: 'goodwill', amount: rebutCost(state, producer, action.count) }
    case 'invest': {
      const card = IMPROVEMENTS_BY_ID.get(action.improvementId)
      return card ? { resource: 'marks', amount: investCost(state, producer, card) } : undefined
    }
    case 'sell':
      return { resource: 'produce', amount: action.count }
    case 'scheme': {
      const card = SCHEMES_BY_ID.get(action.schemeId)
      return card ? { resource: 'goodwill', amount: schemeCost(state, producer, card) } : undefined
    }
    case 'tearUpContract':
      return { resource: 'marks', amount: TEAR_UP_CONTRACT_COST }
    case 'graft':
    case 'role':
    case 'decide':
      return undefined
  }
}

// The `ACTION_TERMS` glossary entry (src/content/terms.ts) an action kind should offer a SPEC 10.5
// tooltip for, or undefined for kinds with no matching entry (role abilities are producer-specific, not
// one of the 7 spec-4.6 actions the glossary covers, and `decide`/`tearUpContract` aren't base actions).
// Shared by `actionTermFor` (a full `Action`, for in-game tooltips) and `Game.tsx`'s tutorial "?" link
// (only ever has the bare `Action['kind']` string a `TutorialStep.highlight` names), so both agree on
// which glossary entry a given action kind maps to.
export function actionTermForKind(kind: Action['kind'] | string): string | undefined {
  switch (kind) {
    case 'openStall':
      return 'Open Stall'
    case 'supplyOutlets':
    case 'supplyBuyout':
      return 'Supply'
    case 'rebut':
      return 'Rebut'
    case 'invest':
      return 'Invest'
    case 'sell':
      return 'Sell'
    case 'scheme':
      return 'Scheme'
    case 'graft':
      return 'Graft'
    default:
      return undefined
  }
}

export function actionTermFor(action: Action): string | undefined {
  return actionTermForKind(action.kind)
}

// The region an action targets, for SPEC 10.2's targeting mode (tap a glowing region on the map instead
// of picking a per-region button). Actions with no region choice (Sell, Graft, Invest, decide, an
// untargeted Scheme/Role) return undefined and stay a single ordinary button.
export function regionOf(action: Action): RegionId | undefined {
  switch (action.kind) {
    case 'openStall':
    case 'supplyOutlets':
    case 'supplyBuyout':
    case 'rebut':
      return action.region
    case 'scheme':
    case 'role':
      return action.targetRegion
    default:
      return undefined
  }
}

// A key grouping every region-variant of "the same" action together (e.g. "Open Stall" regardless of
// which region), so the UI can offer one button that then highlights the legal regions on the map.
export function actionGroupKey(action: Action): string {
  switch (action.kind) {
    case 'openStall':
      return 'openStall'
    case 'supplyOutlets':
      return `supplyOutlets:${action.count}`
    case 'supplyBuyout':
      return 'supplyBuyout'
    case 'rebut':
      return `rebut:${action.count}`
    case 'scheme':
      return `scheme:${action.schemeId}`
    case 'role':
      return 'role'
    default:
      return `${action.kind}:${JSON.stringify(action)}`
  }
}

// The label for a group button, with no region mentioned (the map highlight supplies that once tapped).
export function actionGroupLabel(action: Action, state: GameState): string {
  switch (action.kind) {
    case 'openStall':
      return 'Open Stall'
    case 'supplyOutlets':
      return `Supply: remove ${action.count} Outlet${action.count > 1 ? 's' : ''}`
    case 'supplyBuyout':
      return 'Supply: remove Buyout'
    case 'rebut':
      return `Rebut: remove ${action.count} Doubt`
    case 'scheme': {
      const card = SCHEMES_BY_ID.get(action.schemeId)
      return `Scheme: ${card?.name ?? action.schemeId}`
    }
    case 'role':
      return `Role (${PRODUCERS[state.activeProducer].roleName})`
    default:
      return actionLabel(action, state)
  }
}
