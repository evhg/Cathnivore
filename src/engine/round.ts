import { refreshAllLiberation, runEnemyTurn } from './enemy'
import { addOutlets, countGameStats, countLiberated } from './pieces'
import { shuffle } from './rng'
import { hasImprovement, improvementCount } from './producer'
import { PRODUCERS } from '../content/producers'
import { ACTIONS_PER_ROUND } from './region'
import type { GameState, ProducerId } from './types'

function nextProducer(state: GameState, current: ProducerId): ProducerId | null {
  const order = state.config.producers
  const i = order.indexOf(current)
  const next = order[i + 1]
  return next ?? null
}

// SPEC 4.8: win the moment 5 regions are liberated, one of which is Kingsmarket. SPEC 8.2: a campaign
// chapter can set its own goal (a lower region count, and/or not requiring Kingsmarket).
export function checkWin(state: GameState): GameState {
  const goal = state.config.winCondition ?? { regionsRequired: 5, requireKingsmarket: true }
  const liberated = countLiberated(state)
  const kingsmarketOk = !goal.requireKingsmarket || state.regions.kingsmarket.liberated
  if (liberated >= goal.regionsRequired && kingsmarketOk) {
    return { ...state, result: { won: true, regionsLiberated: liberated, round: state.round, ...countGameStats(state) } }
  }
  return state
}

// SPEC 4.5.4 Cleanup: refill the Market to 4 and Cath's Plan to 3, check win/loss, advance the round and
// swap the first player.
function refillSlots(deck: string[], slots: (string | null)[], size: number): { deck: string[]; slots: (string | null)[] } {
  let remaining = deck
  const filled = slots.slice()
  for (let i = 0; i < size; i++) {
    if (filled[i] == null && remaining.length > 0) {
      filled[i] = remaining[0]!
      remaining = remaining.slice(1)
    }
  }
  return { deck: remaining, slots: filled }
}

function cleanup(state: GameState): GameState {
  // SPEC 4.5.4 order: refill the Market/Cath's Plan first, then check win/loss.
  // SPEC 5: "When the deck runs out, shuffle the discard pile to form a new deck."
  let schemeDeck = state.schemeDeck
  let schemeDiscard = state.schemeDiscard
  let rng = state.rng
  if (schemeDeck.length === 0 && schemeDiscard.length > 0) {
    const [reshuffled, nextRng] = shuffle(schemeDiscard, rng)
    schemeDeck = reshuffled
    schemeDiscard = []
    rng = nextRng
  }

  const { deck: improvementDeck, slots: market } = refillSlots(state.improvementDeck, state.market, 4)
  const { deck: schemeDeckAfterRefill, slots: cathsPlan } = refillSlots(schemeDeck, state.cathsPlan, 3)
  let next: GameState = { ...state, rng, improvementDeck, market, schemeDeck: schemeDeckAfterRefill, schemeDiscard, cathsPlan }

  next = checkWin(next)
  if (next.result) return next

  const newFirstPlayer = nextProducer(next, next.firstPlayer) ?? next.config.producers[0]!
  next = {
    ...next,
    round: next.round + 1,
    firstPlayer: newFirstPlayer,
    activeProducer: newFirstPlayer,
    actionsLeft: ACTIONS_PER_ROUND,
    squeezeSkip: [],
    expandSkip: [],
    producers: Object.fromEntries(
      Object.entries(next.producers).map(([id, p]) => [id, { ...p, roleUsedThisRound: false }]),
    ) as GameState['producers'],
  }

  // SPEC 8.1 "triggers (round start ..., region liberated ...)": fires once, the first time its condition
  // holds at cleanup — either a fixed round (SPEC 8.2 ch3's twist) or a liberated-region count (ch6's
  // "when the players liberate their 2nd region").
  const trigger = next.config.scriptedTrigger
  const triggerReady =
    !!trigger &&
    !next.scriptedTriggerFired &&
    ('round' in trigger ? next.round === trigger.round : countLiberated(next) >= trigger.liberatedCount)
  if (trigger && triggerReady) {
    next = {
      ...next,
      scriptedTriggerFired: true,
      wholesomeHollowRevealed: trigger.effect === 'wholesomeHollowReveal' ? true : next.wholesomeHollowRevealed,
      cathsPlanLocked: trigger.effect === 'unlockCathsPlan' ? false : next.cathsPlanLocked,
      // SPEC 8.2 ch6: "the Plan unlocks and the players get one free Scheme."
      freeSchemePlays: trigger.effect === 'unlockCathsPlan' ? next.freeSchemePlays + 1 : next.freeSchemePlays,
      log: [...next.log, { type: 'trigger', effect: trigger.effect, sceneId: trigger.sceneId }],
    }
  }

  // SPEC 7 carry-over rule: once revealed, each owned "Wholesome Hollow Contract" adds 1 Outlet to its
  // owner's home region at the start of every round (including the round it's revealed in), until torn up.
  if (next.wholesomeHollowRevealed) {
    for (const pid of next.config.producers) {
      const n = improvementCount(next, pid, 'wholesome-hollow-contract')
      if (n > 0) next = addOutlets(next, PRODUCERS[pid].home, n)
    }
    // A contract-added Outlet can un-liberate the owner's home region (SPEC 4.8: a liberated region loses
    // its Co-op marker if it ever gains an enemy piece).
    next = refreshAllLiberation(next)
  }

  // SPEC 4.5.1 Harvest happens at the start of the next round's producer turns.
  for (const pid of next.config.producers) {
    const p = next.producers[pid]
    // SPEC 7 "Oyster Beds": at Harvest, also gain 1 Goodwill if the owner has a Stall in Shingle Bay.
    const oysterBonus = hasImprovement(next, pid, 'oyster-beds') && (next.regions.shingleBay.stalls[pid] ?? 0) > 0 ? 1 : 0
    next = {
      ...next,
      producers: {
        ...next.producers,
        [pid]: {
          ...p,
          resources: {
            produce: p.resources.produce + p.production.produce,
            marks: p.resources.marks + p.production.marks,
            goodwill: p.resources.goodwill + p.production.goodwill + oysterBonus,
          },
        },
      },
    }
  }

  // No explicit round cap: with a 10-card Pressure deck (1 consumed at setup, 1 per round's Scout), the
  // deck empties during round 10's enemy turn, which `runEnemyTurn` already turns into a loss (SPEC 4.8).
  return next
}

// Called after an action reduces `actionsLeft` to 0: moves to the next producer's turn, or, once the
// last producer's turn is done, runs the Enemy turn (SPEC 4.5.3) and Cleanup (SPEC 4.5.4).
export function advanceTurnIfNeeded(state: GameState): GameState {
  if (state.result) return state
  if (state.actionsLeft > 0) return state

  const next = nextProducer(state, state.activeProducer)
  if (next) {
    return { ...state, activeProducer: next, actionsLeft: ACTIONS_PER_ROUND }
  }

  let afterEnemy = runEnemyTurn(state)
  if (afterEnemy.result) return afterEnemy
  afterEnemy = checkWin(afterEnemy)
  if (afterEnemy.result) return afterEnemy
  return cleanup(afterEnemy)
}
