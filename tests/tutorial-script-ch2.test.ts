import { describe, expect, it } from 'vitest'
import { applyAction, createGame, legalActions, validate } from '../src/engine/api'
import { CHAPTER_2, chapterConfig } from '../src/content/chapters'
import { matchesExpect, resumeIndex, stepMode, upcomingExpect } from '../src/content/tutorial'
import { enemyTurnEvents } from '../src/ui/enemyTurnLog'
import type { GameState } from '../src/engine/types'

// Chapter 2's coach (plan item 32): replayed with the real engine like chapter 1's. Each expected action
// is the only legal match when its step shows, and what each step says about the board is true then.
const steps = CHAPTER_2.tutorialSteps

const CLAIMS: Record<number, (s: GameState) => void> = {
  1: (s) => {
    expect(s.regions.saltmarsh.stalls.sol).toBe(2)
    expect(s.regions.saltmarsh.outlets).toBe(2)
    expect(s.regions.saltmarsh.doubt).toBe(1)
  },
  2: (s) => {
    expect(s.producers.sol.resources.goodwill).toBe(2)
    expect(s.producers.sol.production.goodwill).toBe(2)
  },
  4: (s) => expect(s.regions.saltmarsh.doubt).toBe(0),
  5: (s) => {
    expect(s.publicTrust).toBe(10)
    expect(s.regions.saltmarsh.outlets).toBe(1)
  },
  6: (s) => expect(s.producers.sol.roleUsedThisRound).toBe(false),
  7: (s) => {
    expect(s.publicTrust).toBe(11)
    expect(s.producers.sol.resources.produce).toBe(0)
    expect(s.actionsLeft).toBe(1)
  },
  9: (s) => {
    expect(s.round).toBe(2)
    expect(s.producers.sol.resources.produce).toBe(3)
    expect(s.producers.sol.resources.goodwill).toBe(3)
  },
  10: (s) => {
    expect(s.regions.rivermead.outlets).toBe(1)
    expect(s.regions.rivermead.doubt).toBe(0)
  },
  12: (s) => {
    expect(s.regions.rivermead.liberated).toBe(true)
    expect(s.regions.saltmarsh.outlets).toBe(1)
    expect(s.regions.saltmarsh.doubt).toBe(0)
    expect(s.result).toBeNull()
  },
}

describe('chapter 2 guided tutorial script', () => {
  it('is guided, two sentences a step with a one-line why', () => {
    expect(CHAPTER_2.guided).toBe(true)
    for (const step of steps) {
      expect((step.text.match(/[.!?](\s|$)/g) ?? []).length, step.text).toBeLessThanOrEqual(2)
      expect(step.why, step.text).toBeTruthy()
      expect((step.why!.match(/[.!?](\s|$)/g) ?? []).length, step.why).toBeLessThanOrEqual(2)
    }
  })

  it('replays end to end: each expected action is legal and unique when shown, and every claim holds', () => {
    for (const seed of [1, 42, 20261102]) {
      let state = createGame(chapterConfig(CHAPTER_2), seed)
      let enemyEvents: ReturnType<typeof enemyTurnEvents> = []
      steps.forEach((step, i) => {
        CLAIMS[i]?.(state)
        const mode = stepMode(step)
        if (mode === 'action') {
          const matches = legalActions(state).filter((a) => matchesExpect(step.expect!, a))
          expect(matches, `step ${i}: ${step.text}`).toHaveLength(1)
          const before = state
          state = applyAction(state, matches[0]!)
          enemyEvents = enemyTurnEvents(before, state)
          expect(validate(state)).toEqual([])
        } else if (mode === 'enemyTurn') {
          expect(enemyEvents.some((e) => e.type === 'scout' && e.region === 'highmoor'), `step ${i}`).toBe(true)
          expect(state.regions.highmoor.outlets).toBe(2)
        } else {
          enemyEvents = []
        }
        if (step.target?.kind === 'region') expect(CHAPTER_2.activeRegions).toContain(step.target.region)
        if (step.target?.kind === 'action') expect(step.expect).toBeDefined()
      })
      expect(state.round).toBe(2)
      expect(state.result).toBeNull()
      expect(state.actionsLeft).toBe(1)
    }
  })

  it('is right that Doubt arrives with the Scout after round 3, not before', () => {
    let state = createGame(chapterConfig(CHAPTER_2), 7)
    const doubtTotal = (s: GameState) => Object.values(s.regions).reduce((n, r) => n + r.doubt, 0)
    // Play rounds out with Grafts only, so nothing removes Doubt.
    const doubtAt: number[] = []
    while (state.round <= 3 && !state.result) {
      const round = state.round
      while (state.round === round && !state.result) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
      doubtAt.push(doubtTotal(state))
    }
    expect(doubtAt[0]).toBe(1)
    expect(doubtAt[1]).toBe(1)
    expect(doubtAt[2]).toBeGreaterThan(1)
  })

  it('round 1 spends exactly three actions with the free role among them', () => {
    const firstEnemy = steps.findIndex((s) => s.waitFor === 'enemyTurn')
    const round1 = steps.slice(0, firstEnemy).filter((s) => s.expect)
    expect(round1.filter((s) => s.expect!.kind !== 'role')).toHaveLength(3)
    expect(round1.some((s) => s.expect!.kind === 'role')).toBe(true)
  })

  it('resumes after the last action taken, and offers the next action on explain steps', () => {
    expect(resumeIndex(steps, 0)).toBe(0)
    expect(resumeIndex(steps, 1)).toBe(4)
    expect(resumeIndex(steps, 4)).toBe(9)
    expect(resumeIndex(steps, 6)).toBe(12)
    expect(upcomingExpect(steps, 0)).toEqual(steps[3]!.expect)
    expect(upcomingExpect(steps, 5)).toEqual(steps[6]!.expect)
  })

  it('matches On Air by its choice', () => {
    expect(matchesExpect({ kind: 'role', choice: 'trust' }, { kind: 'role', choice: 'goodwill' })).toBe(false)
    expect(matchesExpect({ kind: 'role', choice: 'trust' }, { kind: 'role', choice: 'trust' })).toBe(true)
  })
})
