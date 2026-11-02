import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyAction, createGame, legalActions, validate } from '../src/engine/api'
import { CHAPTERS, CHAPTER_1, chapterConfig } from '../src/content/chapters'
import { matchesExpect, resumeIndex, stepMode, tutorialTargetId, upcomingExpect } from '../src/content/tutorial'
import { enemyTurnEvents } from '../src/ui/enemyTurnLog'
import { CAMPAIGN_KEY, isTutorialDone, loadCampaign, markChapterComplete, markTutorialDone } from '../src/platform/storage'
import type { GameState } from '../src/engine/types'

// The guided first round (CHAPTER_1.guided): replayed with the real engine, every step's expected action
// is legal (and the only legal match) when its step shows, the enemy turn really plays back, and what
// each step says about the board is true at that moment. The board and Pressure deck are scripted, so
// any seed gives the same game.
const steps = CHAPTER_1.tutorialSteps

// What each explain step claims about the board, checked at the moment it shows.
const CLAIMS: Record<number, (s: GameState) => void> = {
  1: (s) => expect(s.regions.brindleHills.stalls.mara).toBe(2),
  2: (s) => expect(s.regions.brindleHills.outlets).toBe(2),
  3: (s) => {
    expect(s.producers.mara.resources.produce).toBe(3)
    expect(s.producers.mara.production.produce).toBe(2)
  },
  4: (s) => expect(s.actionsLeft).toBe(3),
  5: (s) => {
    expect(s.regions.highmoor.outlets).toBe(1)
    expect(s.regions.highmoor.stalls.mara ?? 0).toBe(0)
  },
  8: (s) => expect(s.regions.highmoor.liberated).toBe(true),
  9: (s) => {
    expect(s.producers.mara.resources.produce).toBe(0)
    expect(s.actionsLeft).toBe(1)
  },
  11: (s) => {
    expect(s.round).toBe(2)
    expect(s.producers.mara.resources.produce).toBe(4)
  },
  12: (s) => expect(s.regions.brindleHills.outlets).toBe(3),
  14: (s) => {
    expect(s.regions.brindleHills.outlets).toBe(1)
    expect(s.regions.highmoor.liberated).toBe(true)
    expect(s.result).toBeNull()
  },
}

describe('chapter 1 guided tutorial script', () => {
  it('is a guided chapter, and the only one', () => {
    expect(CHAPTER_1.guided).toBe(true)
    expect(CHAPTERS.filter((c) => c.guided).map((c) => c.id)).toEqual([CHAPTER_1.id])
  })

  it('keeps every step to two sentences, with a one-line why', () => {
    for (const step of steps) {
      expect((step.text.match(/[.!?](\s|$)/g) ?? []).length, step.text).toBeLessThanOrEqual(2)
      expect(step.why, step.text).toBeTruthy()
      expect((step.why!.match(/[.!?](\s|$)/g) ?? []).length, step.why).toBeLessThanOrEqual(2)
    }
  })

  it('replays end to end: each expected action is legal and unique when shown, and every claim holds', () => {
    for (const seed of [1, 42, 20261102]) {
      let state = createGame(chapterConfig(CHAPTER_1), seed)
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
          // The action just before ended the round, and its enemy turn has something to show.
          expect(enemyEvents.length, `step ${i}`).toBeGreaterThan(0)
          expect(enemyEvents.some((e) => e.type === 'scout' && e.region === 'brindleHills')).toBe(true)
        } else {
          enemyEvents = []
        }
        if (step.target?.kind === 'region') expect(CHAPTER_1.activeRegions).toContain(step.target.region)
        if (step.target?.kind === 'action') expect(step.expect).toBeDefined()
      })
      // Handed over in round 2 with the chapter still winnable by plain play.
      expect(state.round).toBe(2)
      expect(state.result).toBeNull()
    }
  })

  it('the script spends the first round exactly: three actions, then the enemy turn', () => {
    const firstEnemy = steps.findIndex((s) => s.waitFor === 'enemyTurn')
    expect(steps.slice(0, firstEnemy).filter((s) => s.expect)).toHaveLength(3)
  })

  it('offers the next expected action during explain steps, and none past an enemy turn', () => {
    expect(upcomingExpect(steps, 0)).toEqual(steps[6]!.expect)
    expect(upcomingExpect(steps, 10)).toBeUndefined()
    expect(upcomingExpect(steps, 11)).toEqual(steps[13]!.expect)
    expect(upcomingExpect(steps, steps.length - 1)).toBeUndefined()
  })

  it('resumes a reloaded game just after the last action taken, skipping a spent enemy turn', () => {
    expect(resumeIndex(steps, 0)).toBe(0)
    expect(resumeIndex(steps, 1)).toBe(7)
    expect(resumeIndex(steps, 2)).toBe(8)
    expect(resumeIndex(steps, 3)).toBe(11)
    expect(resumeIndex(steps, 4)).toBe(14)
    expect(resumeIndex(steps, 9)).toBe(steps.length)
  })

  it('names a data-tutorial target for every phase of an action step', () => {
    expect(tutorialTargetId({ kind: 'region', region: 'highmoor' })).toBe('region-highmoor')
    expect(tutorialTargetId({ kind: 'ui', id: 'produce' })).toBe('produce')
    expect(tutorialTargetId({ kind: 'action' })).toBe('action')
    expect(tutorialTargetId({ kind: 'action' }, 'region', 'highmoor')).toBe('region-highmoor')
    expect(tutorialTargetId({ kind: 'action' }, 'confirm')).toBe('confirm')
    expect(tutorialTargetId(undefined)).toBeNull()
  })

  it('matches an expectation on kind, region and count', () => {
    expect(matchesExpect({ kind: 'graft' }, { kind: 'graft' })).toBe(true)
    expect(matchesExpect({ kind: 'openStall', region: 'highmoor' }, { kind: 'openStall', region: 'brindleHills' })).toBe(false)
    expect(matchesExpect({ kind: 'supplyOutlets', region: 'highmoor', count: 1 }, { kind: 'supplyOutlets', region: 'highmoor', count: 2 })).toBe(false)
    expect(matchesExpect({ kind: 'supplyOutlets' }, { kind: 'openStall', region: 'highmoor' })).toBe(false)
  })
})

describe('tutorial progress in campaign storage', () => {
  const data = new Map<string, string>()
  beforeEach(() => {
    data.clear()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is not done for a new player, and is once marked', () => {
    expect(isTutorialDone()).toBe(false)
    markTutorialDone()
    expect(isTutorialDone()).toBe(true)
    expect(loadCampaign().tutorialDone).toBe(true)
  })

  it('keeps the rest of the campaign save when marking it done', () => {
    markChapterComplete('word-of-mouth')
    markTutorialDone()
    expect(loadCampaign().completed).toEqual(['word-of-mouth'])
  })

  it('counts an older save that already finished chapter 1 as done (backwards compatible)', () => {
    data.set(CAMPAIGN_KEY, JSON.stringify({ version: 1, completed: ['fresh-meat'] }))
    expect(isTutorialDone()).toBe(true)
  })
})
