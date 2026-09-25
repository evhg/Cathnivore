// SPEC 11.4 gate 3: fuzz games with validate() after every step. Zero exceptions, zero invariant
// failures, every game ends by round 10. 10,000 RandomBot games and 1,000 HeuristicBot games (200/100
// in --quick mode, used by `npm run check`). SPEC 12's M7 "long fuzz run of 50,000 RandomBot games" uses
// `--games <n>` to run only RandomBot at that count, in a seed range distinct from the default run's.
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { createRng } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import { RandomBot } from '../src/ai/random'
import { HeuristicBot } from '../src/ai/heuristic'
import type { Bot } from '../src/ai/types'
import type { GameConfig, ProducerId } from '../src/engine/types'

const quick = process.argv.includes('--quick')
const gamesFlagIndex = process.argv.indexOf('--games')
const gamesOverride = gamesFlagIndex === -1 ? null : Number(process.argv[gamesFlagIndex + 1])
const STEP_CAP = 2000

const PRODUCER_PAIRS: ProducerId[][] = [
  ['mara', 'tomas'],
  ['mara', 'ines'],
  ['mara', 'sol'],
  ['tomas', 'ines'],
  ['tomas', 'sol'],
  ['ines', 'sol'],
]

function playOneGame(bot: Bot, seed: number): { ok: true; rounds: number } | { ok: false; error: string } {
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
      const [action, next] = bot.chooseAction(state, rng)
      rng = next
      state = applyAction(state, action)
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

function runBatch(label: string, bot: Bot, games: number, seedOffset: number): boolean {
  const failures: string[] = []
  let totalRounds = 0
  for (let seed = 1; seed <= games; seed++) {
    const result = playOneGame(bot, seed + seedOffset)
    if (!result.ok) {
      failures.push(result.error)
      if (failures.length >= 20) break // enough to diagnose without flooding the log
    } else {
      totalRounds += result.rounds
    }
  }

  if (failures.length > 0) {
    console.error(`fuzz: ${label}: ${failures.length} failure(s) found out of ${games} games (showing up to 20):`)
    for (const f of failures) console.error(`  - ${f}`)
    return false
  }
  console.log(`fuzz: ${games} ${label} games, 0 exceptions, 0 invariant failures, all ended by round 10.`)
  console.log(`fuzz: ${label} average game length ${(totalRounds / games).toFixed(2)} rounds.`)
  return true
}

function main(): void {
  if (gamesOverride !== null) {
    // A long, RandomBot-only run (SPEC 12 M7), in a seed range distinct from both default batches.
    const ok = runBatch('RandomBot', RandomBot, gamesOverride, 3_000_000)
    if (!ok) process.exit(1)
    return
  }
  const randomGames = quick ? 200 : 10_000
  const heuristicGames = quick ? 100 : 1_000
  // Distinct seed ranges so the two batches never replay the same games.
  const ok1 = runBatch('RandomBot', RandomBot, randomGames, 0)
  const ok2 = runBatch('HeuristicBot', HeuristicBot, heuristicGames, 1_000_000)
  if (!ok1 || !ok2) process.exit(1)
}

main()
