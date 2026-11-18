import { describe, expect, it } from 'vitest'
import { nextChapterBeat, titleBoardState } from '../src/ui/titleBoard'
import { attractOn } from '../src/ui/titleBeat'

// Plan item 503: the title's board previews the next chapter.
describe('nextChapterBeat', () => {
  it('points a fresh save at Brindle Hills', () => {
    expect(nextChapterBeat([])).toEqual({ chapter: 'fresh-meat', region: 'brindleHills', line: 'Brindle Hills next. Shall we?' })
  })
  it('follows the campaign, always onto a region the save still holds', () => {
    const order = ['fresh-meat', 'word-of-mouth', 'growing-season', 'the-plan', 'friends-in-low-places']
    for (let i = 1; i <= order.length; i++) {
      const done = order.slice(0, i)
      const beat = nextChapterBeat(done)!
      expect(beat.chapter).toBe(i < order.length ? order[i] : 'kingsmarket')
      expect(titleBoardState(done).regions[beat.region]!.liberated).toBe(false)
    }
    expect(nextChapterBeat(order)!.line).toBe('Kingsmarket next. Shall we finish it?')
  })
  it('stops once Marrow is free', () => {
    expect(nextChapterBeat(['kingsmarket'])).toBeNull()
  })
})

describe('attractOn', () => {
  it('runs for players, and under webdriver only with ?attract', () => {
    expect(attractOn('', false)).toBe(true)
    expect(attractOn('', true)).toBe(false)
    expect(attractOn('?attract', true)).toBe(true)
  })
})
