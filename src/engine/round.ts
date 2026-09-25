import { runEnemyTurn } from './enemy'
import { countLiberated } from './pieces'
import { shuffle } from './rng'
import { hasImprovement } from './producer'
import type { GameState, ProducerId } from './types'

function nextProducer(state: GameState, current: ProducerId): ProducerId | null {
  const order = state.config.producers
  const i = order.indexOf(current)
  const next = order[i + 1]
  return next ?? null
}

// SPEC 4.8: win the moment 5 regions are liberated, one of which is Kingsmarket. SPEC 8.2: a campaign
// chapter can set its own goal (a lower region count, and/or not requiring Kingsmarket).
function checkWin(state: GameState): GameState {
  const goal = state.config.winCondition ?? { regionsRequired: 5, requireKingsmarket: true }
  const liberated = countLiberated(state)
  const kingsmarketOk = !goal.requireKingsmarket || state.regions.kingsmarket.liberated
  if (liberated >= goal.regionsRequired && kingsmarketOk) {
    return { ...state, result: { won: true, regionsLiberated: liberated, round: state.round } }
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
  let next = checkWin(state)
  if (next.result) return next

  // SPEC 5: "When the deck runs out, shuffle the discard pile to form a new deck."
  let schemeDeck = next.schemeDeck
  let schemeDiscard = next.schemeDiscard
  let rng = next.rng
  if (schemeDeck.length === 0 && schemeDiscard.length > 0) {
    const [reshuffled, nextRng] = shuffle(schemeDiscard, rng)
    schemeDeck = reshuffled
    schemeDiscard = []
    rng = nextRng
  }

  const { deck: improvementDeck, slots: market } = refillSlots(next.improvementDeck, next.market, 4)
  const { deck: schemeDeckAfterRefill, slots: cathsPlan } = refillSlots(schemeDeck, next.cathsPlan, 3)
  next = { ...next, rng, improvementDeck, market, schemeDeck: schemeDeckAfterRefill, schemeDiscard, cathsPlan }

  const newFirstPlayer = nextProducer(next, next.firstPlayer) ?? next.config.producers[0]!
  next = {
    ...next,
    round: next.round + 1,
    firstPlayer: newFirstPlayer,
    activeProducer: newFirstPlayer,
    actionsLeft: 3,
    squeezeSkip: [],
    expandSkip: [],
    producers: Object.fromEntries(
      Object.entries(next.producers).map(([id, p]) => [id, { ...p, roleUsedThisRound: false }]),
    ) as GameState['producers'],
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
    return { ...state, activeProducer: next, actionsLeft: 3 }
  }

  let afterEnemy = runEnemyTurn(state)
  if (afterEnemy.result) return afterEnemy
  afterEnemy = checkWin(afterEnemy)
  if (afterEnemy.result) return afterEnemy
  return cleanup(afterEnemy)
}
