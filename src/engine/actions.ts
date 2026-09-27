import { REGIONS } from '../content/map'
import { removeBuyout, removeDoubt, removeOutlets } from './pieces'
import { refreshAllLiberation } from './enemy'
import { checkRiftSplit, resolveRiftSplitFaction, resolveRiftSplitRemoval } from './rift'
import { advanceTurnIfNeeded, checkWin } from './round'
import { hasImprovement, improvementCount } from './producer'
import { canMarketDayOpenIn, canOpenStallIn, regionStallTotal } from './region'
import { resolveRules } from './rules'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID, legalSchemeTargets } from '../content/schemes'
import type { Action, Faction, GameState, ProducerId, RegionId, ResourceKind } from './types'

function ownStalls(state: GameState, producer: ProducerId, region: RegionId): number {
  return state.regions[region].stalls[producer] ?? 0
}

function removeFirst<T>(slots: (T | null)[], value: T): (T | null)[] {
  const i = slots.indexOf(value)
  if (i === -1) return slots
  return slots.map((v, idx) => (idx === i ? null : v))
}

// M4 balance-loop iteration 3 (see DECISIONS.md): clearing a Buyout is one of the two costs
// (with Supply Outlets) directly on the critical path to liberating a region. Iteration 4 tried
// cutting this further to 2 alongside a lostLandPool cut, but the combined 1,000-game confirmation
// regressed publicTrust's loss share under SPEC 9.4's 15% floor with a flat win rate — reverted to 3.
const SUPPLY_BUYOUT_COST_BASE = 3

// SPEC 7 effect-mix follow-up (2026-09-27, see DECISIONS.md): "Community Larder" gives an ongoing
// Buyout discount, same minimum-floor shape as the per-region Supply discounts below, rather than
// touching the shared base constant itself (that's the balance-loop-tuned number, left alone).
function supplyBuyoutCost(state: GameState, producer: ProducerId): number {
  const discount = hasImprovement(state, producer, 'community-larder') ? 1 : 0
  return Math.max(2, SUPPLY_BUYOUT_COST_BASE - discount)
}

// M4 balance-loop iteration 6 (see DECISIONS.md): tried cutting this 2 -> 1 (every region with an
// Outlet, not just the Buyout-having ones) to attack the still-dominant pressureDeckEmpty loss reason.
// A 200-game confirmation showed it was far too strong a single lever: win rate jumped to 48.5% (inside
// the 45-60% target) but publicTrust/lostLand loss shares collapsed to 5.8%/2.9% (both well under the
// 15% floor iterations 1-5 had already cleared), games settled far too early (avg settled round 4.46,
// 88.8% settled before round 7, versus SPEC 9.4's "at least 60% not settled before round 7"), and the
// producer-pair spread blew past the 12-point band (33.3%-70.6%). Reverted to 2. Revisit with a gentler
// version (e.g. a per-Improvement discount rather than a universal base cut) in a later iteration.
const SUPPLY_OUTLET_BASE_COST = 2

// SPEC 7 campaign carry-over rule: "the owner spends an action and 3 Marks on 'Tear Up the Contract.'"
const TEAR_UP_CONTRACT_COST = 3

// SPEC 7 "Mobile Butcher"/"Wholesale Crate Deal": Supply in Pasture/Crop regions costs 1 less Produce
// per Outlet (minimum 1). M4 balance-loop iteration 7 (see DECISIONS.md) added "Harbour Stall Licence"'s
// matching Coast discount to close the coverage gap (Pasture and Crop already had one, Coast didn't) —
// a gentler, investment-gated version of iteration 6's reverted universal base-cost cut.
function supplyOutletCostPerOutlet(state: GameState, producer: ProducerId, region: RegionId): number {
  const base = SUPPLY_OUTLET_BASE_COST
  const type = REGIONS[region].type
  if (
    (hasImprovement(state, producer, 'mobile-butcher') && type === 'pasture') ||
    (hasImprovement(state, producer, 'wholesale-crate-deal') && type === 'crop') ||
    (hasImprovement(state, producer, 'harbour-stall-licence') && type === 'coast')
  ) {
    return Math.max(1, base - 1)
  }
  return base
}

// Ongoing-ability Improvements (SPEC 7's "~30% ongoing discounts or abilities" mix target — see
// DECISIONS.md for the effect-mix audit that added these): "Wholesale Account" discounts Invest,
// "Press Contact" and "Letterpress Flyers" both discount Scheme plays (the same flat 1, not stacking —
// two Media-flavoured cards sharing one PR-cost-cutting ability, matching how the 3 per-region Supply
// discounts already share one shape), both minimum 1. Checked by id against the producer's improvements
// *before* this purchase is added to the tableau, so a card never discounts its own purchase.
function investCost(state: GameState, producer: ProducerId, card: { cost: number }): number {
  const discount = hasImprovement(state, producer, 'wholesale-account') ? 1 : 0
  return Math.max(1, card.cost - discount)
}

function schemeCost(state: GameState, producer: ProducerId, card: { cost: number }): number {
  const discount =
    hasImprovement(state, producer, 'press-contact') || hasImprovement(state, producer, 'letterpress-flyers') ? 1 : 0
  return Math.max(1, card.cost - discount)
}

// "Tide Tables" (2026-09-27 effect-mix follow-up): Rebut costs 1 less Goodwill overall (not per Doubt
// removed — that would make removing a single Doubt free), same minimum-1 floor as the discounts above.
function rebutCost(state: GameState, producer: ProducerId, count: number): number {
  const discount = hasImprovement(state, producer, 'tide-tables') ? 1 : 0
  return Math.max(1, count - discount)
}

// SPEC 9.1 `currentDecision`: while a forced choice is pending, it's the only thing the engine will
// accept — resolving it (`decide`) is a prerequisite for any other action, same path for human and AI.
function decisionActions(decision: GameState['pendingDecisions'][number]): Action[] {
  return decision.options.map((choice) => ({ kind: 'decide', decisionId: decision.id, choice }))
}

export function legalActions(state: GameState): Action[] {
  if (state.result) return []
  if (state.pendingDecisions.length > 0) return decisionActions(state.pendingDecisions[0]!)
  const producer = state.activeProducer
  const p = state.producers[producer]
  const actions: Action[] = []
  const rules = resolveRules(state)

  if (p.resources.produce >= 1) {
    for (const id of state.config.activeRegions) {
      if (canOpenStallIn(state, producer, id)) actions.push({ kind: 'openStall', region: id })
    }
  }

  for (const id of state.config.activeRegions) {
    if (ownStalls(state, producer, id) === 0) continue
    const r = state.regions[id]
    const outletCost = supplyOutletCostPerOutlet(state, producer, id)
    if (r.outlets >= 1 && p.resources.produce >= outletCost) actions.push({ kind: 'supplyOutlets', region: id, count: 1 })
    if (r.outlets >= 2 && p.resources.produce >= outletCost * 2) actions.push({ kind: 'supplyOutlets', region: id, count: 2 })
    if (r.buyouts >= 1 && p.resources.produce >= supplyBuyoutCost(state, producer) && regionStallTotal(r) >= 2) {
      actions.push({ kind: 'supplyBuyout', region: id })
    }
    if (rules.rebut && r.doubt >= 1 && p.resources.goodwill >= rebutCost(state, producer, 1)) {
      actions.push({ kind: 'rebut', region: id, count: 1 })
    }
    if (rules.rebut && r.doubt >= 2 && p.resources.goodwill >= rebutCost(state, producer, 2)) {
      actions.push({ kind: 'rebut', region: id, count: 2 })
    }
  }

  if (rules.sell) {
    for (let n = 1; n <= Math.min(3, p.resources.produce); n++) {
      actions.push({ kind: 'sell', count: n as 1 | 2 | 3 })
    }
  }

  if (rules.improvements) {
    for (const id of state.market) {
      if (!id) continue
      const card = IMPROVEMENTS_BY_ID.get(id)
      if (card && p.resources.marks >= investCost(state, producer, card)) actions.push({ kind: 'invest', improvementId: id })
    }
  }

  if (rules.schemes && !state.cathsPlanLocked) {
    for (const id of state.cathsPlan) {
      if (!id) continue
      const card = SCHEMES_BY_ID.get(id)
      if (!card || (p.resources.goodwill < schemeCost(state, producer, card) && state.freeSchemePlays <= 0)) continue
      for (const target of legalSchemeTargets(state, producer, id)) {
        actions.push(target ? { kind: 'scheme', schemeId: id, targetRegion: target } : { kind: 'scheme', schemeId: id })
      }
    }
  }

  // SPEC 7 campaign carry-over rule (chapter 3's twist): once revealed, tearing up one owned contract at
  // a time is available like any other action, for as long as the producer still owns one.
  if (state.wholesomeHollowRevealed && improvementCount(state, producer, 'wholesome-hollow-contract') > 0 && p.resources.marks >= TEAR_UP_CONTRACT_COST) {
    actions.push({ kind: 'tearUpContract' })
  }

  actions.push({ kind: 'graft' })
  if (rules.roles && !p.roleUsedThisRound) {
    if (producer === 'sol') {
      // SPEC 6: Sol's "On Air" is a real choice (Public Trust +1, or gain 2 Goodwill), not a fixed default.
      actions.push({ kind: 'role', choice: 'trust' }, { kind: 'role', choice: 'goodwill' })
    } else {
      for (const target of legalRoleTargets(state, producer)) {
        actions.push(target ? { kind: 'role', targetRegion: target } : { kind: 'role' })
      }
    }
  }

  return actions
}

// SPEC 6: role abilities that need a target region (Mara's Injunction, Tomas's Market Day, Ines's Second
// Opinion) are only offered per legal target; Sol's ability needs no target so `role` is offered once,
// unconditionally (its effect fizzles harmlessly with no valid target — same as an Agenda card with none,
// SPEC 4.7).
function legalRoleTargets(state: GameState, producer: ProducerId): (RegionId | null)[] {
  if (producer === 'mara') {
    const targets = state.config.activeRegions.filter((id) => ownStalls(state, producer, id) > 0 && !state.regions[id].liberated)
    return targets.length > 0 ? targets : [null]
  }
  if (producer === 'tomas') {
    const targets = state.config.activeRegions.filter((id) => canMarketDayOpenIn(state, id))
    return targets.length > 0 ? targets : [null]
  }
  if (producer === 'ines') {
    // SPEC 6 "Second Opinion": "remove 1 Doubt from a region with your Stall, at no cost" — a choice among
    // every eligible region, parallel to Mara's "choose a region with your Stall" (previously auto-picked
    // the first eligible region in a fixed order, denying the player a choice when more than one qualified).
    const targets = state.config.activeRegions.filter((id) => ownStalls(state, producer, id) > 0 && state.regions[id].doubt > 0)
    return targets.length > 0 ? targets : [null]
  }
  return [null]
}

function assertLegal(state: GameState, action: Action): void {
  const legal = legalActions(state)
  const isLegal = legal.some((a) => JSON.stringify(a) === JSON.stringify(action))
  if (!isLegal) throw new Error(`Illegal action: ${JSON.stringify(action)}`)
}

// SPEC 6: the four producers' free, once-per-round role abilities.
function applyRole(state: GameState, producer: ProducerId, target: RegionId | null, choice?: 'trust' | 'goodwill'): GameState {
  switch (producer) {
    case 'ines': {
      if (!target) return state
      return removeDoubt(state, target, 1)
    }
    case 'sol': {
      // SPEC 6 "On Air": Public Trust +1, or gain 2 Goodwill — a real choice (M4 balance-loop iteration 8,
      // see DECISIONS.md: the fixed +1 Trust default left MCTSBot unable to pick Goodwill when it needed it
      // to Rebut or play Schemes, plausibly contributing to Sol's pairs being the weakest in the spread).
      if (choice === 'goodwill') return gain(state, producer, { produce: 0, marks: 0, goodwill: 2 })
      return { ...state, publicTrust: Math.min(15, state.publicTrust + 1) }
    }
    case 'mara': {
      // Injunction: Expand skips the chosen region this round.
      if (!target) return state
      return { ...state, expandSkip: [...state.expandSkip, target] }
    }
    case 'tomas': {
      // Market Day: open a Stall for free in a region bordering any producer's Stall.
      if (!target) return state
      const r = state.regions[target]
      return { ...state, regions: { ...state.regions, [target]: { ...r, stalls: { ...r.stalls, [producer]: (r.stalls[producer] ?? 0) + 1 } } } }
    }
  }
}

// Resolves a pending `currentDecision`. A default choice is already applied to state (see enemy.ts/
// rift.ts); if the resolved choice differs, undo the default and apply the chosen option in its place.
// This isn't one of a producer's 3 actions, so it doesn't touch `actionsLeft` or turn order.
function applyDecision(state: GameState, action: Extract<Action, { kind: 'decide' }>): GameState {
  const decision = state.pendingDecisions.find((d) => d.id === action.decisionId)
  if (!decision) throw new Error(`Unknown decision: ${action.decisionId}`)

  // SPEC 4.7 Rift 6 "The Split": these two kinds don't swap a producer's production track like the ones
  // below — they pick a faction, then (possibly several times) where to remove one of its pieces from.
  if (decision.kind === 'riftSplitFaction' || decision.kind === 'riftSplitRemoval') {
    const next =
      decision.kind === 'riftSplitFaction'
        ? resolveRiftSplitFaction(state, decision.id, action.choice as Faction)
        : resolveRiftSplitRemoval(state, decision, action.choice as RegionId)
    return {
      ...next,
      log: [...next.log, { type: 'decision', decisionId: action.decisionId, choice: action.choice }],
      actionHistory: [...next.actionHistory, action],
    }
  }

  const choice = action.choice as ResourceKind
  const producer = state.producers[decision.producer]
  let production = producer.production
  if (decision.applied !== choice) {
    const delta = decision.kind === 'squeezeProductionLoss' ? 1 : -1
    production = {
      ...production,
      [decision.applied]: Math.max(0, production[decision.applied] + delta),
      [choice]: Math.max(0, production[choice] - delta),
    }
  }
  return {
    ...state,
    producers: { ...state.producers, [decision.producer]: { ...producer, production } },
    pendingDecisions: state.pendingDecisions.filter((d) => d.id !== action.decisionId),
    log: [...state.log, { type: 'decision', decisionId: action.decisionId, choice }],
    actionHistory: [...state.actionHistory, action],
  }
}

export function applyAction(state: GameState, action: Action): GameState {
  assertLegal(state, action)
  if (action.kind === 'decide') {
    // Most `decide` kinds (squeeze/Kingsmarket) only swap a production track and need no refresh below.
    // A `riftSplitRemoval` decision can remove an Outlet/Buyout/Doubt, though, which can liberate a region
    // or even complete the win condition mid-chain — same re-checks `applyAction`'s own action path below
    // runs after any piece change, so this can't apply an action's worth of removal without them.
    const resolved = refreshAllLiberation(applyDecision(state, action))
    return resolved.result ? resolved : checkWin(resolved)
  }
  const producer = state.activeProducer
  let next = state

  switch (action.kind) {
    case 'openStall': {
      next = spend(state, producer, { produce: 1, marks: 0, goodwill: 0 })
      const r = next.regions[action.region]
      next = {
        ...next,
        regions: {
          ...next.regions,
          [action.region]: { ...r, stalls: { ...r.stalls, [producer]: (r.stalls[producer] ?? 0) + 1 } },
        },
      }
      break
    }
    case 'supplyOutlets': {
      const cost = supplyOutletCostPerOutlet(state, producer, action.region) * action.count
      next = spend(state, producer, { produce: cost, marks: 0, goodwill: 0 })
      next = removeOutlets(next, action.region, action.count)
      break
    }
    case 'supplyBuyout': {
      next = spend(state, producer, { produce: supplyBuyoutCost(state, producer), marks: 0, goodwill: 0 })
      next = removeBuyout(next, action.region, 1)
      break
    }
    case 'rebut': {
      next = spend(state, producer, { produce: 0, marks: 0, goodwill: rebutCost(state, producer, action.count) })
      const bonus = hasImprovement(state, producer, 'soil-lab-report') ? 1 : 0
      next = removeDoubt(next, action.region, action.count + bonus)
      break
    }
    case 'sell': {
      // "Wagon Wheel Press" (SPEC 7 ongoing-ability mix, see DECISIONS.md): Sell yields 1 extra Marks.
      // "Polytunnel" (2026-09-27 follow-up): Sell also yields 1 extra Goodwill, same trigger.
      const sellBonus = hasImprovement(state, producer, 'wagon-wheel-press') ? 1 : 0
      const sellGoodwillBonus = hasImprovement(state, producer, 'polytunnel') ? 1 : 0
      next = spend(state, producer, { produce: action.count, marks: 0, goodwill: 0 })
      next = gain(next, producer, { produce: 0, marks: action.count + sellBonus, goodwill: sellGoodwillBonus })
      break
    }
    case 'graft': {
      // "Compost Exchange" (SPEC 7 ongoing-ability mix, see DECISIONS.md): Graft yields 1 extra Produce.
      // "Seed Library" (2026-09-27 follow-up): Graft also yields 1 extra Marks, same trigger.
      const graftBonus = hasImprovement(state, producer, 'compost-exchange') ? 1 : 0
      const graftMarksBonus = hasImprovement(state, producer, 'seed-library') ? 1 : 0
      next = gain(state, producer, { produce: 1 + graftBonus, marks: 1 + graftMarksBonus, goodwill: 0 })
      break
    }
    case 'role': {
      next = applyRole(state, producer, action.targetRegion ?? null, action.choice)
      next = {
        ...next,
        producers: { ...next.producers, [producer]: { ...next.producers[producer], roleUsedThisRound: true } },
      }
      break
    }
    case 'invest': {
      const card = IMPROVEMENTS_BY_ID.get(action.improvementId)
      if (!card) throw new Error(`Unknown improvement: ${action.improvementId}`)
      next = spend(state, producer, { produce: 0, marks: investCost(state, producer, card), goodwill: 0 })
      next = card.onBuy(next, producer)
      next = {
        ...next,
        producers: {
          ...next.producers,
          [producer]: { ...next.producers[producer], improvements: [...next.producers[producer].improvements, card.id] },
        },
        // `removeFirst` (not a blanket `.map`), because chapter 3's scripted Market can hold more than one
        // copy of the same card (3x "Wholesome Hollow Contract") in different slots — a blanket null-out
        // would empty every copy's slot when only one was bought.
        market: removeFirst(next.market, card.id),
        log: [...next.log, { type: 'invest', producer, improvementId: card.id }],
      }
      break
    }
    case 'tearUpContract': {
      next = spend(state, producer, { produce: 0, marks: TEAR_UP_CONTRACT_COST, goodwill: 0 })
      const owned = next.producers[producer]
      const i = owned.improvements.indexOf('wholesome-hollow-contract')
      const improvements = i === -1 ? owned.improvements : [...owned.improvements.slice(0, i), ...owned.improvements.slice(i + 1)]
      next = {
        ...next,
        producers: {
          ...next.producers,
          [producer]: {
            ...owned,
            improvements,
            // Undoes the +2 Marks production the contract's `onBuy` granted (SPEC 7).
            production: { ...owned.production, marks: Math.max(0, owned.production.marks - 2) },
          },
        },
        contractsTornUp: next.contractsTornUp + 1,
      }
      break
    }
    case 'scheme': {
      const card = SCHEMES_BY_ID.get(action.schemeId)
      if (!card) throw new Error(`Unknown scheme: ${action.schemeId}`)
      const target = action.targetRegion ?? null
      // SPEC 8.2 ch6: while a free play is available, cover any shortfall for free rather than always
      // spending one — a producer with enough Goodwill anyway still pays normally, so the grant isn't
      // wasted on a play that didn't need it.
      const cost = schemeCost(state, producer, card)
      const useFreePlay = state.freeSchemePlays > 0 && state.producers[producer].resources.goodwill < cost
      next = spend(state, producer, { produce: 0, marks: 0, goodwill: useFreePlay ? 0 : cost })
      next = card.effect(next, producer, target)
      next = {
        ...next,
        cathsPlan: next.cathsPlan.map((id) => (id === card.id ? null : id)),
        schemeDiscard: [...next.schemeDiscard, card.id],
        freeSchemePlays: useFreePlay ? next.freeSchemePlays - 1 : next.freeSchemePlays,
        log: [...next.log, { type: 'schemePlayed', producer, schemeId: card.id, target }],
      }
      break
    }
  }

  next = refreshAllLiberation(next)
  next = refreshAllLiberation(checkRiftSplit(next))
  next = {
    ...next,
    actionsLeft: next.actionsLeft - (action.kind === 'role' ? 0 : 1),
    log: [...next.log, { type: 'action', producer, action }],
    actionHistory: [...next.actionHistory, action],
  }
  // SPEC 4.8: "Win: the moment 5 regions are liberated..." — check right after this action, not only at
  // the next Cleanup, so a mid-round win can't be reversed by the rest of the round (e.g. the Enemy turn
  // un-liberating the winning region before Cleanup ever runs).
  next = checkWin(next)
  if (next.result) return next
  return advanceTurnIfNeeded(next)
}

function spend(state: GameState, producer: ProducerId, cost: { produce: number; marks: number; goodwill: number }): GameState {
  const p = state.producers[producer]
  return {
    ...state,
    producers: {
      ...state.producers,
      [producer]: {
        ...p,
        resources: {
          produce: p.resources.produce - cost.produce,
          marks: p.resources.marks - cost.marks,
          goodwill: p.resources.goodwill - cost.goodwill,
        },
      },
    },
  }
}

function gain(state: GameState, producer: ProducerId, amount: { produce: number; marks: number; goodwill: number }): GameState {
  const p = state.producers[producer]
  return {
    ...state,
    producers: {
      ...state.producers,
      [producer]: {
        ...p,
        resources: {
          produce: p.resources.produce + amount.produce,
          marks: p.resources.marks + amount.marks,
          goodwill: p.resources.goodwill + amount.goodwill,
        },
      },
    },
  }
}
