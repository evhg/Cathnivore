import { runEnemyTurn } from './enemy'
import { countLiberated } from './pieces'
import type { GameState, ProducerId } from './types'

function nextProducer(state: GameState, current: ProducerId): ProducerId | null {
  const order = state.config.producers
  const i = order.indexOf(current)
  const next = order[i + 1]
  return next ?? null
}

// SPEC 4.8: win the moment 5 regions are liberated, one of which is Kingsmarket.
function checkWin(state: GameState): GameState {
  const liberated = countLiberated(state)
  if (liberated >= 5 && state.regions.kingsmarket.liberated) {
    return { ...state, result: { won: true, regionsLiberated: liberated, round: state.round } }
  }
  return state
}

// SPEC 4.5.4 Cleanup: refill Market/Plan (deferred until Improvements/Schemes content lands), check
// win/loss, advance the round and swap the first player.
function cleanup(state: GameState): GameState {
  let next = checkWin(state)
  if (next.result) return next

  const newFirstPlayer = nextProducer(next, next.firstPlayer) ?? next.config.producers[0]!
  next = {
    ...next,
    round: next.round + 1,
    firstPlayer: newFirstPlayer,
    activeProducer: newFirstPlayer,
    actionsLeft: 3,
    producers: Object.fromEntries(
      Object.entries(next.producers).map(([id, p]) => [id, { ...p, roleUsedThisRound: false }]),
    ) as GameState['producers'],
  }

  // SPEC 4.5.1 Harvest happens at the start of the next round's producer turns.
  for (const pid of next.config.producers) {
    const p = next.producers[pid]
    next = {
      ...next,
      producers: {
        ...next.producers,
        [pid]: {
          ...p,
          resources: {
            produce: p.resources.produce + p.production.produce,
            marks: p.resources.marks + p.production.marks,
            goodwill: p.resources.goodwill + p.production.goodwill,
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
