// SPEC 9.3 simulation harness: `npm run sim -- --games 1000 --bot mcts --difficulty normal --pairs all`.
// Runs headless games and writes `sim/reports/<timestamp>.json`, then appends a summary to `BALANCE.md`.
//
// Runs single-threaded rather than across Node worker threads (SPEC 9.3's "one per CPU core minus one").
// Logged as a decision in DECISIONS.md: correctness of the metrics matters more than wall-clock speed
// while the balance loop hasn't started (M4), and 1,000 games already finishes in well under a minute at
// the lower (200-simulation) MCTS budget SPEC 9.3 allows for sims. Revisit if M4's iteration loop (up to
// 12 iterations x 1,000+ games) turns out too slow.
import { writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { createRng } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import { RandomBot } from '../src/ai/random'
import { HeuristicBot } from '../src/ai/heuristic'
import { createMCTSBot } from '../src/ai/mcts'
import { IMPROVEMENTS } from '../src/content/improvements'
import { SCHEMES } from '../src/content/schemes'
import type { Bot } from '../src/ai/types'
import type { GameConfig, GameState, ProducerId } from '../src/engine/types'

// SPEC 9.3: "Simulations may use a lower budget (200 simulations per decision) to save time."
const SIM_MCTS_BUDGET = 200
const STEP_CAP = 2000
const SETTLED_LIBERATED_THRESHOLD = 4

const ALL_PAIRS: ProducerId[][] = [
  ['mara', 'tomas'],
  ['mara', 'ines'],
  ['mara', 'sol'],
  ['tomas', 'ines'],
  ['tomas', 'sol'],
  ['ines', 'sol'],
]

interface Args {
  games: number
  bot: 'random' | 'heuristic' | 'mcts'
  difficulty: 'easy' | 'normal' | 'hard'
  pairs: 'all' | ProducerId[]
}

function parseArgs(): Args {
  const raw = process.argv.slice(2)
  const get = (flag: string, fallback: string): string => {
    const i = raw.indexOf(flag)
    return i >= 0 && raw[i + 1] ? raw[i + 1]! : fallback
  }
  const games = Number.parseInt(get('--games', '1000'), 10)
  const bot = get('--bot', 'mcts') as Args['bot']
  const difficulty = get('--difficulty', 'normal') as Args['difficulty']
  const pairsArg = get('--pairs', 'all')
  const pairs: Args['pairs'] = pairsArg === 'all' ? 'all' : (pairsArg.split(',') as ProducerId[])
  return { games, bot, difficulty, pairs }
}

function botFor(name: Args['bot']): Bot {
  if (name === 'random') return RandomBot
  if (name === 'heuristic') return HeuristicBot
  return createMCTSBot(SIM_MCTS_BUDGET)
}

interface GameOutcome {
  pair: string
  won: boolean
  lossReason: string | null
  rounds: number
  settledRound: number | null // first round the outcome looked decided (SPEC 9.3)
  improvementsBought: string[]
  schemesPlayed: string[]
  legalActionCounts: number[]
  crashed: boolean
  invariantFailure: string | null
}

// "the round at which the outcome became settled (4 or more regions liberated, or a loss track within 1
// of losing)" — checked once per round, right after Cleanup, using that round's ending state.
function isSettled(state: GameState): boolean {
  const liberated = Object.values(state.regions).filter((r) => r.liberated).length
  if (liberated >= SETTLED_LIBERATED_THRESHOLD) return true
  if (state.publicTrust <= 1) return true
  if (state.lostLandPool <= 1) return true
  if (state.pressureDeck.length <= 1) return true
  return false
}

function playOneGame(bot: Bot, pair: ProducerId[], difficulty: Args['difficulty'], seed: number): GameOutcome {
  const config: GameConfig = { producers: pair, difficulty, activeRegions: ALL_REGION_IDS }
  const pairLabel = [...pair].sort().join('+')
  const outcome: GameOutcome = {
    pair: pairLabel,
    won: false,
    lossReason: null,
    rounds: 0,
    settledRound: null,
    improvementsBought: [],
    schemesPlayed: [],
    legalActionCounts: [],
    crashed: false,
    invariantFailure: null,
  }
  try {
    let state = createGame(config, seed)
    let rng = createRng(seed * 7919 + 1)
    let lastRound = state.round
    for (let step = 0; step < STEP_CAP; step++) {
      if (state.result) {
        outcome.won = state.result.won
        outcome.lossReason = state.result.lossReason ?? null
        outcome.rounds = state.round
        break
      }
      const actions = legalActions(state)
      outcome.legalActionCounts.push(actions.length)
      const [action, next] = bot.chooseAction(state, rng)
      rng = next
      state = applyAction(state, action)
      if (action.kind === 'invest') outcome.improvementsBought.push(action.improvementId)
      if (action.kind === 'scheme') outcome.schemesPlayed.push(action.schemeId)
      const errors = validate(state)
      if (errors.length > 0) {
        outcome.invariantFailure = errors.map((e) => e.message).join('; ')
        return outcome
      }
      if (state.round !== lastRound && outcome.settledRound === null && isSettled(state)) {
        outcome.settledRound = state.round
      }
      lastRound = state.round
    }
  } catch (err) {
    outcome.crashed = true
    outcome.invariantFailure = err instanceof Error ? err.message : String(err)
  }
  return outcome
}

interface Summary {
  timestamp: string
  args: Args
  totalGames: number
  crashes: number
  invariantFailures: number
  winRate: number
  winRateByPair: Record<string, number>
  lossReasonShare: Record<string, number>
  avgRounds: number
  avgSettledRound: number | null
  settledBeforeRound7Share: number
  avgLegalActions: number
  improvementPurchaseRate: Record<string, number>
  improvementWinRateWhenBought: Record<string, number>
  schemePlayRate: Record<string, number>
}

function summarize(outcomes: GameOutcome[], args: Args): Summary {
  const n = outcomes.length
  const crashes = outcomes.filter((o) => o.crashed).length
  const invariantFailures = outcomes.filter((o) => o.invariantFailure && !o.crashed).length
  const finished = outcomes.filter((o) => !o.crashed && !o.invariantFailure)
  const wins = finished.filter((o) => o.won)

  const winRateByPair: Record<string, number> = {}
  for (const pair of new Set(finished.map((o) => o.pair))) {
    const games = finished.filter((o) => o.pair === pair)
    winRateByPair[pair] = games.filter((o) => o.won).length / games.length
  }

  const losses = finished.filter((o) => !o.won)
  const lossReasonShare: Record<string, number> = {}
  for (const reason of new Set(losses.map((o) => o.lossReason ?? 'unknown'))) {
    lossReasonShare[reason] = losses.filter((o) => (o.lossReason ?? 'unknown') === reason).length / Math.max(1, losses.length)
  }

  const settled = finished.filter((o) => o.settledRound !== null)
  const avgSettledRound = settled.length > 0 ? settled.reduce((s, o) => s + o.settledRound!, 0) / settled.length : null
  const settledBeforeRound7 = finished.filter((o) => o.settledRound !== null && o.settledRound < 7).length

  const allLegalCounts = finished.flatMap((o) => o.legalActionCounts)

  const improvementPurchaseRate: Record<string, number> = {}
  const improvementWinRateWhenBought: Record<string, number> = {}
  for (const card of IMPROVEMENTS) {
    const bought = finished.filter((o) => o.improvementsBought.includes(card.id))
    improvementPurchaseRate[card.id] = bought.length / Math.max(1, finished.length)
    improvementWinRateWhenBought[card.id] = bought.length > 0 ? bought.filter((o) => o.won).length / bought.length : 0
  }

  const schemePlayRate: Record<string, number> = {}
  for (const card of SCHEMES) {
    const played = finished.filter((o) => o.schemesPlayed.includes(card.id))
    schemePlayRate[card.id] = played.length / Math.max(1, finished.length)
  }

  return {
    timestamp: new Date().toISOString(),
    args,
    totalGames: n,
    crashes,
    invariantFailures,
    winRate: wins.length / Math.max(1, finished.length),
    winRateByPair,
    lossReasonShare,
    avgRounds: finished.reduce((s, o) => s + o.rounds, 0) / Math.max(1, finished.length),
    avgSettledRound,
    settledBeforeRound7Share: settled.length > 0 ? settledBeforeRound7 / settled.length : 0,
    avgLegalActions: allLegalCounts.length > 0 ? allLegalCounts.reduce((a, b) => a + b, 0) / allLegalCounts.length : 0,
    improvementPurchaseRate,
    improvementWinRateWhenBought,
    schemePlayRate,
  }
}

function appendToBalanceLog(summary: Summary, reportPath: string): void {
  const lines = [
    '',
    `## ${summary.timestamp}`,
    `- args: ${JSON.stringify(summary.args)}`,
    `- games: ${summary.totalGames}, crashes: ${summary.crashes}, invariant failures: ${summary.invariantFailures}`,
    `- win rate: ${(summary.winRate * 100).toFixed(1)}%`,
    `- win rate by pair: ${Object.entries(summary.winRateByPair)
      .map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`)
      .join(', ')}`,
    `- loss reason share: ${Object.entries(summary.lossReasonShare)
      .map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`)
      .join(', ')}`,
    `- avg rounds: ${summary.avgRounds.toFixed(2)}, avg settled round: ${summary.avgSettledRound?.toFixed(2) ?? 'n/a'}, settled before round 7: ${(summary.settledBeforeRound7Share * 100).toFixed(1)}%`,
    `- avg legal actions per decision: ${summary.avgLegalActions.toFixed(2)}`,
    `- full report: \`${reportPath}\``,
    '',
  ]
  if (!existsSync('BALANCE.md')) {
    writeFileSync('BALANCE.md', '# Balance log\n\nAppended by `npm run sim` (SPEC 9.3). Newest entries at the bottom.\n')
  }
  appendFileSync('BALANCE.md', lines.join('\n'))
}

function main(): void {
  const args = parseArgs()
  const bot = botFor(args.bot)
  const pairs = args.pairs === 'all' ? ALL_PAIRS : [args.pairs]

  const outcomes: GameOutcome[] = []
  let seed = 1
  for (let i = 0; i < args.games; i++) {
    const pair = pairs[i % pairs.length]!
    outcomes.push(playOneGame(bot, pair, args.difficulty, seed))
    seed += 1
  }

  const summary = summarize(outcomes, args)

  mkdirSync('sim/reports', { recursive: true })
  const reportPath = `sim/reports/${summary.timestamp.replace(/[:.]/g, '-')}.json`
  writeFileSync(reportPath, JSON.stringify({ summary, outcomes }, null, 2))
  appendToBalanceLog(summary, reportPath)

  console.log(`sim: ${summary.totalGames} games (${args.bot}, ${args.difficulty}), win rate ${(summary.winRate * 100).toFixed(1)}%`)
  console.log(`sim: crashes ${summary.crashes}, invariant failures ${summary.invariantFailures}`)
  console.log(`sim: report written to ${reportPath}, summary appended to BALANCE.md`)

  if (summary.crashes > 0 || summary.invariantFailures > 0) process.exit(1)
}

main()
