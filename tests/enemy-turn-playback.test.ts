import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { enemyTurnEvents, captionFor, pendingMidSceneTrigger } from '../src/ui/enemyTurnLog'
import type { GameConfig, GameEvent } from '../src/engine/types'

// SPEC 10.2: the enemy turn plays back as a caption per step. `enemyTurnEvents` picks out exactly the
// log entries added by the enemy turn (agenda onward) from one `applyAction` call, and every one of
// those event types should render a non-empty caption.
describe('enemy turn playback', () => {
  const config: GameConfig = {
    producers: ['mara'],
    difficulty: 'normal',
    activeRegions: ['kingsmarket', 'brindleHills', 'highmoor', 'saltmarsh', 'rivermead', 'shingleBay', 'oakvale'],
  }

  it('captures only the enemy-turn events, starting at Agenda, when an action ends the round', () => {
    let state = createGame(config, 12345)
    let events: ReturnType<typeof enemyTurnEvents> = []
    // Drive Graft actions until a round boundary is crossed (actionsLeft wraps back to 3 with no more
    // producers to advance through, since this is a 1-producer game).
    for (let i = 0; i < 3 && events.length === 0; i++) {
      const before = state
      const [action] = legalActions(before).filter((a) => a.kind === 'graft')
      state = applyAction(before, action!)
      events = enemyTurnEvents(before, state)
    }

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]!.type).toBe('agenda')
    for (const event of events) {
      expect(captionFor(event)).not.toBe('')
    }
  })

  // STYLE.md 12: "No exclamation marks and no emoji anywhere in the interface." Enemy-turn captions are
  // interface text, not story or Cath's-voice text, so none of the caption forms may use one.
  it('never uses an exclamation mark, for any event type', () => {
    const events: GameEvent[] = [
      { type: 'agenda', cardId: 'h1', bonusSkipped: false },
      { type: 'scout', region: 'highmoor', doubtAdded: true },
      { type: 'expand', region: 'highmoor', piece: 'outlet' },
      { type: 'squeeze', region: 'highmoor', lostLand: true, stallRemoved: true, trustLoss: 2 },
      { type: 'squeeze', region: 'highmoor', lostLand: false, stallRemoved: false, trustLoss: 0 },
      { type: 'liberated', region: 'highmoor', producer: 'mara' },
      { type: 'riftSplit', faction: 'hollowell' },
    ]
    for (const event of events) {
      expect(captionFor(event)).not.toContain('!')
    }
  })

  it('returns no events for an action that does not end the round', () => {
    const state = createGame({ ...config, producers: ['mara', 'ines'] }, 999)
    const [action] = legalActions(state).filter((a) => a.kind === 'graft')
    const next = applyAction(state, action!)
    expect(enemyTurnEvents(state, next)).toEqual([])
  })
})

// SPEC 8.1/8.2 ch3/ch6: a chapter's mid-game scripted scene must pause play once and never reappear once
// dismissed, even across a reload (which starts with fresh, empty `dismissedMidScenes` component state —
// see src/ui/Game.tsx). Regression coverage for a real bug a review session found: `pendingMidSceneTrigger`
// used to be plain `dismissedMidScenes.includes(...)`-only logic inline in Game.tsx, which made the scene
// reappear (re-blocking the current turn) on every reload after the round it fired on, not just the one
// where it was first shown.
describe('pendingMidSceneTrigger (SPEC 8.1/8.2 mid-game scripted scenes)', () => {
  const triggerEvent: GameEvent = { type: 'trigger', effect: 'wholesomeHollowReveal', sceneId: 'twist' }
  const actionEvent: GameEvent = {
    type: 'action',
    producer: 'tomas',
    action: { kind: 'graft' },
  }

  it('is pending the moment the trigger fires, before anything else happens', () => {
    expect(pendingMidSceneTrigger([triggerEvent], [])).toEqual(triggerEvent)
  })

  it('is no longer pending once dismissed in the current session', () => {
    expect(pendingMidSceneTrigger([triggerEvent], ['twist'])).toBeUndefined()
  })

  it('is no longer pending after a reload, once at least one action was logged afterward', () => {
    // Simulates the exact bug: `dismissedMidScenes` is back to `[]` (a fresh reload), but the log itself
    // proves the scene was already shown and dismissed, since the Scene overlay blocks every action.
    const log = [triggerEvent, actionEvent]
    expect(pendingMidSceneTrigger(log, [])).toBeUndefined()
  })

  it('stays pending across a reload if no action was logged after the trigger yet', () => {
    // The trigger just fired and nothing else has happened yet (e.g. the enemy turn that caused it was
    // the very last thing in the log) — a fresh reload with empty `dismissedMidScenes` must still show it.
    expect(pendingMidSceneTrigger([triggerEvent], [])).toEqual(triggerEvent)
  })
})
