// Teach on the board (plan item 22; owner, 2026-11-02: "teach me the game by example"). A first visit opens
// no rules modal: a four-tile field (the spring, two channels, one field) where Cath asks for exactly one tap
// at a time on a glowing tile: turn, connect, bloom. Three taps, then today's daily. The full rules stay
// behind "?". Pure data and rules here; main.ts drives the board and the speech bubble.

import { computeFlow, tapsToSolve, type Cell, type Puzzle } from './engine'
import type { CathExpression } from '../../../shared/cath/cath'

const E = 1 << 0
const SE = 1 << 1
const W = 1 << 3
const NW = 1 << 4

/** The lesson field: the spring on the left, a bend, a straight, and a field at the bottom. */
export function lessonPuzzle(): Puzzle {
  const cells: Cell[] = [
    // The spring opens east and never turns.
    { q: -1, r: 0, kind: 'spring', solved: E, rot: 0, locked: false, fixed: true },
    // A bend (west to south-east) turned one step anticlockwise: one tap lets the water in.
    { q: 0, r: 0, kind: 'channel', solved: W | SE, rot: 5, locked: false },
    // A straight (north-west to south-east) lying east-west: one tap lines it up.
    { q: 0, r: 1, kind: 'channel', solved: NW | SE, rot: 2, locked: false },
    // The field, its one opening facing west: one tap turns it to the water.
    { q: 0, r: 2, kind: 'field', solved: NW, rot: 5, locked: false },
  ]
  return { seed: 'lesson', radius: 2, cells, par: 3, frameRadius: 1 }
}

export interface LessonStep {
  /** The one tile Cath asks for (an index into lessonPuzzle().cells). */
  target: number
  expression: CathExpression
  /** What to do, and why, in her voice. */
  ask: string
}

export const LESSON_STEPS: readonly LessonStep[] = [
  { target: 1, expression: 'smirk', ask: "Hi, I'm Cath. Water runs from the spring along the grooves. Tap the glowing tile to turn it." },
  { target: 2, expression: 'determined', ask: 'See it run in? Now turn the next one so the grooves meet.' },
  { target: 3, expression: 'wink', ask: 'Last one: turn the field to face the water.' },
]

/** What she says once the field blooms, before today's puzzle. */
export const LESSON_DONE = "That's all there is to it: every tile watered, nothing spilling. Here's today's field."

export interface LessonTap {
  /** The tap was on the tile she asked for. */
  accepted: boolean
  /** The step to show next (LESSON_STEPS.length once the field is watered). */
  step: number
  solved: boolean
}

/**
 * A tap during the lesson: only the asked-for tile turns (always clockwise, so one tap is always enough), and
 * the lesson moves on once that tile sits right.
 */
export function lessonTap(cells: Cell[], step: number, index: number): LessonTap {
  const want = LESSON_STEPS[step]
  if (!want || index !== want.target) return { accepted: false, step, solved: false }
  const cell = cells[index]!
  cell.rot = (cell.rot + 1) % 6
  const right = tapsToSolve(cell) === 0
  const next = right ? step + 1 : step
  return { accepted: true, step: next, solved: computeFlow(cells).solved }
}
