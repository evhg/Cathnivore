import { describe, expect, it } from 'vitest'
import { canUndo, isIrreversible, popUndo, pushUndo, type UndoEntry } from '../src/ui/undo'
import { createGame } from '../src/engine/api'
import { applyAction, legalActions } from '../src/engine/actions'
import type { Action, GameConfig, GameState } from '../src/engine/types'

// SPEC 4.6: "any action that reveals hidden information ... is marked irreversible, and undo cannot go
// back past it." Steak-out, Reconnaissance, Paper Trail and Weather Eye all do this (src/content/schemes.ts)
// — each peeks the top of the hidden Pressure or Agenda deck.
describe('isIrreversible', () => {
  it('flags playing Steak-out', () => {
    const action: Action = { kind: 'scheme', schemeId: 'steak-out' }
    expect(isIrreversible(action)).toBe(true)
  })

  // Regression: these three schemes' own rules text says "Look at the top ... card" — exactly the "peeks
  // at a deck" example SPEC 4.6 names — but until this fix, only Steak-out was actually marked
  // `irreversible: true` in src/content/schemes.ts; these three silently let a human undo straight past a
  // hidden-information reveal.
  it('flags playing Reconnaissance (peeks the Pressure deck)', () => {
    const action: Action = { kind: 'scheme', schemeId: 'reconnaissance' }
    expect(isIrreversible(action)).toBe(true)
  })

  it('flags playing Paper Trail (peeks the Agenda deck)', () => {
    const action: Action = { kind: 'scheme', schemeId: 'paper-trail' }
    expect(isIrreversible(action)).toBe(true)
  })

  it('flags playing Weather Eye (peeks the Pressure deck)', () => {
    const action: Action = { kind: 'scheme', schemeId: 'weather-eye' }
    expect(isIrreversible(action)).toBe(true)
  })

  it('does not flag an ordinary Scheme', () => {
    const action: Action = { kind: 'scheme', schemeId: 'grass-roots' }
    expect(isIrreversible(action)).toBe(false)
  })

  it('does not flag non-Scheme actions', () => {
    const action: Action = { kind: 'graft' }
    expect(isIrreversible(action)).toBe(false)
  })
})

// SPEC 4.6's actual undo mechanics, exercised through the same pushUndo/canUndo/popUndo functions
// Game.tsx calls (not a reimplementation), against a real engine state — not just the classifier function.
describe('undo stack boundary (SPEC 4.6)', () => {
  const BASE_CONFIG: GameConfig = {
    producers: ['mara'],
    difficulty: 'normal',
    activeRegions: ['brindleHills', 'highmoor'],
  }

  it('undo stops dead at an irreversible action: a reversible action after it can be undone once, but a further undo attempt is rejected, not replayed past the boundary', () => {
    let state: GameState = createGame(BASE_CONFIG, 1)
    let stack: UndoEntry[] = []

    // Action 1: an ordinary, reversible action (Graft).
    const graft1 = legalActions(state).find((a) => a.kind === 'graft')!
    stack = pushUndo(stack, state, graft1)
    state = applyAction(state, graft1)

    // Action 2: Steak-out — irreversible. Force it legal (in the Plan, enough Goodwill) without touching
    // anything undo-relevant.
    state = {
      ...state,
      cathsPlan: [state.cathsPlan[0] ?? null, state.cathsPlan[1] ?? null, 'steak-out'],
      producers: {
        ...state.producers,
        mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, goodwill: 10 } },
      },
    }
    const steakOut = legalActions(state).find((a) => a.kind === 'scheme' && a.schemeId === 'steak-out')!
    stack = pushUndo(stack, state, steakOut)
    const pressureDeckBeforeSteakOut = state.pressureDeck
    state = applyAction(state, steakOut)
    const stateAfterSteakOut = state
    // Steak-out's own effect reorders the deck (having looked at it) — confirm this state really did
    // reveal/change something, i.e. this isn't a no-op action that just happens to be flagged irreversible.
    expect(state.pressureDeck).not.toBe(pressureDeckBeforeSteakOut)

    // The irreversible action's own entry already blocks undo — you can never undo *the irreversible
    // action itself* (that would "un-peek" the deck).
    expect(canUndo(stack)).toBe(false)
    expect(popUndo(stack)).toBeNull()

    // Action 3: another reversible action (Graft again), taken after the irreversible boundary.
    const graft2 = legalActions(state).find((a) => a.kind === 'graft')!
    stack = pushUndo(stack, state, graft2)
    state = applyAction(state, graft2)

    // First undo attempt: undoes Action 3 (Graft #2), landing back on the state right after Steak-out.
    expect(canUndo(stack)).toBe(true)
    const first = popUndo(stack)
    expect(first).not.toBeNull()
    stack = first!.stack
    state = first!.state
    expect(state).toEqual(stateAfterSteakOut)

    // Second undo attempt: the stack's remaining top is Steak-out's own entry (irreversible=true) — undo
    // must reject this outright, not silently pop it and land on the pre-Steak-out state, which would let
    // the player see a *different* top-of-Pressure-deck card next time without ever having "un-known" the
    // one Steak-out already showed them.
    expect(canUndo(stack)).toBe(false)
    const second = popUndo(stack)
    expect(second).toBeNull()
    expect(state).toEqual(stateAfterSteakOut) // untouched: a true no-op, not a partial/failed replay
    expect(stack).toHaveLength(2) // [graft1, steakOut] — nothing was popped
  })

  it('canUndo is false at the start of a turn (empty stack) and true after one reversible action', () => {
    const state: GameState = createGame(BASE_CONFIG, 1)
    let stack: UndoEntry[] = []
    expect(canUndo(stack)).toBe(false)

    const graft = legalActions(state).find((a) => a.kind === 'graft')!
    stack = pushUndo(stack, state, graft)
    expect(canUndo(stack)).toBe(true)
  })
})
