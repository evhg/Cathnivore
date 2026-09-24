// SPEC 9.3 simulation harness: `npm run sim -- --games 1000 --bot mcts --difficulty normal --pairs all`.
// Runs headless games across a pool of child processes (one per CPU core minus one, per SPEC 9.3's "Node
// worker threads" -- see `sim/simWorker.ts` for why this uses `child_process` instead of an actual
// `worker_threads.Worker`), writes `sim/reports/<timestamp>.json`, then appends a summary to `BALANCE.md`.
//
// MCTSBot decisions are the expensive case (~400ms/decision profiled at the sim harness's 200-simulation
// budget before the rollout-policy fix in `src/ai/mcts.ts`, ~100ms after it), which made a full 1,000-game
// MCTSBot run take on the order of hours single-threaded (see PROGRESS.md's M2 perf note / DECISIONS.md).
// This worker pool is the other half of that fix, matching SPEC 9.3's own text.
import { writeFileSync, mkdirSync, appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cpus } from 'node:os'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
import { ALL_PAIRS, playOneGame, botFor } from './simCore'
import type { BotName, Difficulty, GameOutcome } from './simCore'
import type { ProducerId } from '../src/engine/types'
import { ALL_REGION_IDS } from '../src/content/map'
import { IMPROVEMENTS } from '../src/content/improvements'
import { SCHEMES } from '../src/content/schemes'

interface Args {
  games: number
  bot: BotName
  difficulty: Difficulty
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

// One child process per job list, running `sim/simWorker.ts` as a real `tsx` CLI invocation (see that
// file's header comment for why). Input/output are small JSON files in a scratch temp dir, since a
// worker's whole job list and outcome list are both well under any pipe/argv size limit but a file is
// simpler to get right than streaming NDJSON over stdout.
function runInWorker(
  tmpDir: string,
  index: number,
  botName: BotName,
  difficulty: Difficulty,
  jobs: { pair: ProducerId[]; seed: number }[],
): Promise<GameOutcome[]> {
  const inputPath = join(tmpDir, `in-${index}.json`)
  const outputPath = join(tmpDir, `out-${index}.json`)
  writeFileSync(inputPath, JSON.stringify({ bot: botName, difficulty, jobs }))

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'sim/simWorker.ts', '--input', inputPath, '--output', outputPath], {
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`sim worker ${index} exited with code ${code}`))
        return
      }
      resolve(JSON.parse(readFileSync(outputPath, 'utf-8')) as GameOutcome[])
    })
  })
}

// SPEC 9.3: "one per CPU core minus one." Single-threaded (no worker) for tiny runs, since spawning a
// worker thread costs more than a handful of RandomBot/HeuristicBot games take to just run inline.
async function playAllGames(args: Args): Promise<GameOutcome[]> {
  const pairs = args.pairs === 'all' ? ALL_PAIRS : [args.pairs]
  const jobs: { pair: ProducerId[]; seed: number }[] = []
  let seed = 1
  for (let i = 0; i < args.games; i++) {
    jobs.push({ pair: pairs[i % pairs.length]!, seed })
    seed += 1
  }

  const workerCount = Math.max(1, cpus().length - 1)
  if (args.games < 20 || workerCount <= 1) {
    const bot = botFor(args.bot)
    return jobs.map((job) => playOneGame(bot, job.pair, args.difficulty, job.seed, ALL_REGION_IDS))
  }

  const chunks: { pair: ProducerId[]; seed: number }[][] = Array.from({ length: workerCount }, () => [])
  jobs.forEach((job, i) => chunks[i % workerCount]!.push(job))

  const tmpDir = mkdtempSync(join(tmpdir(), 'cathnivore-sim-'))
  try {
    const results = await Promise.all(
      chunks.filter((c) => c.length > 0).map((chunk, i) => runInWorker(tmpDir, i, args.bot, args.difficulty, chunk)),
    )
    return results.flat()
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const args = parseArgs()

  const outcomes = await playAllGames(args)

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

void main()
