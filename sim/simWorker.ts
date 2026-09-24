// A CLI entry point spawned as a child process, one per job chunk (SPEC 9.3: "one per CPU core minus
// one"). Reads `{bot, difficulty, jobs}` from `--input <path>` (JSON), plays each job's game and writes
// the resulting outcomes to `--output <path>` (JSON).
//
// This runs as a real `tsx` CLI process rather than a `node:worker_threads` Worker: tsx's ESM loader hook
// (`--import tsx`, and `--require tsx/cjs`) only resolves the worker's own entry file, not extensionless
// relative imports further down that file's import chain (confirmed directly: a worker whose entry file
// imports `./a`, which imports `./b` without an extension, fails with `ERR_MODULE_NOT_FOUND` on `./b`,
// while the exact same chain works under plain `tsx some-file.ts` on the CLI). Rather than add explicit
// `.ts` extensions across `src/engine`/`src/ai`/`src/content` to work around a loader limitation, this
// uses one child process per chunk — the same "spread the games across N workers" outcome SPEC 9.3 asks
// for, just via `child_process` instead of `worker_threads`.
import { readFileSync, writeFileSync } from 'node:fs'
import { ALL_REGION_IDS } from '../src/content/map'
import { botFor, playOneGame } from './simCore'
import type { BotName, Difficulty, GameOutcome } from './simCore'
import type { ProducerId } from '../src/engine/types'

interface Job {
  pair: ProducerId[]
  seed: number
}

interface WorkerInput {
  bot: BotName
  difficulty: Difficulty
  jobs: Job[]
}

function arg(flag: string): string {
  const i = process.argv.indexOf(flag)
  const v = i >= 0 ? process.argv[i + 1] : undefined
  if (!v) throw new Error(`missing ${flag}`)
  return v
}

const inputPath = arg('--input')
const outputPath = arg('--output')

const { bot: botName, difficulty, jobs } = JSON.parse(readFileSync(inputPath, 'utf-8')) as WorkerInput
const bot = botFor(botName)

const outcomes: GameOutcome[] = jobs.map((job) => playOneGame(bot, job.pair, difficulty, job.seed, ALL_REGION_IDS))

writeFileSync(outputPath, JSON.stringify(outcomes))
