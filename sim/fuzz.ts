// SPEC 11.4 gate 3: fuzz games with validate() after every step. Zero exceptions, zero invariant
// failures, every game ends by round 10. RandomBot only for now; HeuristicBot fuzzing is added once
// src/ai/heuristic.ts exists (M2) — see PROGRESS.md.
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { createRng, nextInt } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, ProducerId } from '../src/engine/types'

const quick = process.argv.includes('--quick')
const games = quick ? 200 : 10_000
const STEP_CAP = 2000

const PRODUCER_PAIRS: ProducerId[][] = [
  ['mara', 'tomas'],
  ['mara', 'ines'],
  ['mara', 'sol'],
  ['tomas', 'ines'],
  ['tomas', 'sol'],
  ['ines', 'sol'],
]

function playOneGame(seed: number): { ok: true; rounds: number } | { ok: false; error: string } {
  const producers = PRODUCER_PAIRS[seed % PRODUCER_PAIRS.length]!
  const config: GameConfig = { producers, difficulty: 'normal', activeRegions: ALL_REGION_IDS }
  try {
    let state = createGame(config, seed)
    let rng = createRng(seed * 7919 + 1)
    for (let step = 0; step < STEP_CAP; step++) {
      if (state.result) {
        if (state.round > 10) return { ok: false, error: `seed ${seed}: game ran past round 10 (round ${state.round})` }
        return { ok: true, rounds: state.round }
      }
      const actions = legalActions(state)
      if (actions.length === 0) return { ok: false, error: `seed ${seed}: no legal actions but game not over` }
      const [i, next] = nextInt(rng, actions.length)
      rng = next
      state = applyAction(state, actions[i]!)
      const errors = validate(state)
      if (errors.length > 0) {
        return { ok: false, error: `seed ${seed}: invariant failure — ${errors.map((e) => e.message).join('; ')}` }
      }
    }
    return { ok: false, error: `seed ${seed}: did not end within ${STEP_CAP} steps` }
  } catch (err) {
    return { ok: false, error: `seed ${seed}: threw — ${err instanceof Error ? err.message : String(err)}` }
  }
}

function main(): void {
  const failures: string[] = []
  let totalRounds = 0
  for (let seed = 1; seed <= games; seed++) {
    const result = playOneGame(seed)
    if (!result.ok) {
      failures.push(result.error)
      if (failures.length >= 20) break // enough to diagnose without flooding the log
    } else {
      totalRounds += result.rounds
    }
  }

  if (failures.length > 0) {
    console.error(`fuzz: ${failures.length} failure(s) found out of ${games} games (showing up to 20):`)
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(`fuzz: ${games} RandomBot games (${quick ? 'quick' : 'full'} mode), 0 exceptions, 0 invariant failures, all ended by round 10.`)
  console.log(`fuzz: average game length ${(totalRounds / games).toFixed(2)} rounds.`)
}

main()
