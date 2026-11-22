// Plan item 653: a new player's first week climbs to the daily. After the four-tile lesson come three short fields
// that grow (7, 12, then 18 tiles), each opened by one line from Cath, before today's daily; the daily can be a
// 37-tile "Hardest" board, too big a step straight from the lesson. A player with any daily result skips it, and
// it can be skipped. Pure data and rules here; main.ts plays the boards as the 'climb' mode.

import { generatePuzzle, type GenerateOptions, type Puzzle } from './engine'
import type { CathExpression } from '../../../shared/cath/cath'
import type { SaveData } from './store'

export interface ClimbBoard {
  seed: string
  options: GenerateOptions
  /** Cath's one-line lesson as the board opens. */
  expression: CathExpression
  ask: string
  /** What she says as it blooms (the last board's is the daily's line, `climbDailyLine`). */
  bloom: string
}

export const CLIMB: readonly ClimbBoard[] = [
  {
    seed: 'climb-1',
    // radius 1: the spring and its six neighbours
    options: { radius: 1, stoneRate: 0 },
    expression: 'smirk',
    ask: 'Same again, a little bigger. Follow the water out from the spring, one tile at a time.',
    bloom: 'Lovely. A bit bigger now.',
  },
  {
    seed: 'climb-2',
    // radius 2 with seven of the outer ring's twelve tiles turned to stone: twelve tiles to water
    options: { radius: 2, stoneRate: 0.58 },
    expression: 'determined',
    ask: "Stones don't turn and don't need water. Start with the tiles that can only point one way.",
    bloom: "That's the knack. One more warm-up.",
  },
  {
    seed: 'climb-3',
    options: { radius: 2 },
    expression: 'wink',
    ask: "Last warm-up. Sure of a tile? Hold it to pin it, so a stray tap can't turn it.",
    bloom: '',
  },
]

export function climbPuzzle(index: number): Puzzle {
  const b = CLIMB[Math.max(0, Math.min(CLIMB.length - 1, index))]!
  return generatePuzzle(b.seed, b.options)
}

/** The climb runs for a player who hasn't finished or skipped it and has no daily result saved. */
export function climbDue(data: Pick<SaveData, 'results' | 'climbDone'>): boolean {
  return !data.climbDone && Object.keys(data.results).length === 0
}

/** Her line as the climb hands over to today's daily, by how hard the day is in the weekly arc. */
export function climbDailyLine(arc: string | null): string {
  const a = arc?.toLowerCase()
  if (a === 'hardest') return "Warmed up. Today's is the week's hardest field, so take it slowly. You've got this."
  if (a === 'hard' || a === 'harder' || a === 'tricky') return `Warmed up. Today's field is a ${a} one: work out from the spring.`
  if (a) return `Warmed up. Today's field is ${a === 'easy' ? 'an' : 'a'} ${a} one. Off you go.`
  return "Warmed up. Here's today's field."
}
