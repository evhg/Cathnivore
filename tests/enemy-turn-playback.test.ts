import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { enemyTurnEvents, captionFor } from '../src/ui/enemyTurnLog'
import type { GameConfig } from '../src/engine/types'

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

  it('returns no events for an action that does not end the round', () => {
    const state = createGame({ ...config, producers: ['mara', 'ines'] }, 999)
    const [action] = legalActions(state).filter((a) => a.kind === 'graft')
    const next = applyAction(state, action!)
    expect(enemyTurnEvents(state, next)).toEqual([])
  })
})
