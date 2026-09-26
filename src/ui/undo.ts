import { SCHEMES_BY_ID } from '../content/schemes'
import type { Action, GameState } from '../engine/types'

// SPEC 4.6: "any action that reveals hidden information ... is marked irreversible, and undo cannot go
// back past it." Steak-out, Reconnaissance, Paper Trail and Weather Eye (all Schemes) do this so far —
// each peeks the top of the hidden Pressure or Agenda deck.
export function isIrreversible(action: Action): boolean {
  return action.kind === 'scheme' && (SCHEMES_BY_ID.get(action.schemeId)?.irreversible ?? false)
}

// One entry per action taken this turn: the state *before* that action, plus whether that action was
// irreversible. `undo`'s job is to walk back down this stack one entry at a time, but it must never pop
// (or look past) an entry whose action was irreversible — doing so would let a human "un-know" a card
// they already peeked at (SPEC 4.6). Pulled out of `Game.tsx` as plain functions, rather than left as
// inline closures over a ref, so this boundary logic can be unit-tested directly instead of only through
// the UI.
export interface UndoEntry {
  state: GameState
  irreversible: boolean
}

// Called right before applying `action` from `state`: records the boundary the new stack entry sits on.
export function pushUndo(stack: UndoEntry[], state: GameState, action: Action): UndoEntry[] {
  return [...stack, { state, irreversible: isIrreversible(action) }]
}

// True exactly when `undo` would actually do something: there's a prior entry, and it isn't the
// irreversible boundary itself. Used to disable the Undo button (SPEC 10.2's "available during your own
// turn" implies "and only while there's something left to undo").
export function canUndo(stack: UndoEntry[]): boolean {
  const top = stack[stack.length - 1]
  return !!top && !top.irreversible
}

// Pops the stack and returns the state to restore, or null (leaving the stack untouched) when there's
// nothing left to undo or the top entry is the irreversible boundary — a no-op, not a silent replay past
// it.
export function popUndo(stack: UndoEntry[]): { state: GameState; stack: UndoEntry[] } | null {
  const top = stack[stack.length - 1]
  if (!top || top.irreversible) return null
  return { state: top.state, stack: stack.slice(0, -1) }
}
