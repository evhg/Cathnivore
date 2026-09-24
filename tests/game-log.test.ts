import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { logCaption } from '../src/ui/gameLog'
import type { GameConfig } from '../src/engine/types'

// SPEC 10.2's Log sheet shows turn history and enemy events in one feed. Every event `state.log` can
// ever contain (bar the pure-mechanical 'decision' recording a default choice) should render a caption.
describe('logCaption', () => {
  const config: GameConfig = {
    producers: ['mara', 'ines'],
    difficulty: 'normal',
    activeRegions: ['kingsmarket', 'brindleHills', 'highmoor', 'saltmarsh', 'rivermead', 'shingleBay', 'oakvale'],
  }

  it('captions every action a full game round can log, with no crash', () => {
    let state = createGame(config, 42)
    for (let i = 0; i < 20 && !state.result; i++) {
      const options = legalActions(state)
      state = applyAction(state, options[0]!)
    }
    expect(state.log.length).toBeGreaterThan(0)
    for (const event of state.log) {
      expect(() => logCaption(event)).not.toThrow()
    }
    // At least one caption should be a real, non-empty line (the openStall/graft/agenda mix above).
    expect(state.log.some((e) => (logCaption(e) ?? '').length > 0)).toBe(true)
  })
})
