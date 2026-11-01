import { describe, expect, it } from 'vitest'
import { creditBoard, eventBoardOf, eventCrops, eventOn } from '../games/runnel/src/events'
import { parseBoardCode } from '../games/runnel/src/code'

describe('Runnel seasonal events', () => {
  it('runs 1 to 21 April and October only', () => {
    expect(eventOn('2027-04-01')?.id).toBe('spring-2027')
    expect(eventOn('2026-10-21')?.id).toBe('autumn-2026')
    expect(eventOn('2026-10-22')).toBeNull()
    expect(eventOn('2026-11-01')).toBeNull()
  })
  it('boards are valid shareable codes that map back to the event', () => {
    const e = eventOn('2026-04-05')!
    expect(e.boards).toHaveLength(5)
    e.boards.forEach((b, i) => {
      expect(parseBoardCode(b.code)?.seed).toBe(b.seed)
      expect(eventBoardOf(b.seed)).toMatchObject({ index: i, event: { id: 'spring-2026' } })
    })
    expect(eventBoardOf('practice-small-abc-1')).toBeNull()
  })
  it('five distinct solves earn the crop', () => {
    let done: number[] = []
    for (const i of [0, 0, 1, 2, 3]) done = creditBoard(done, i).done
    expect(creditBoard(done, 3).complete).toBe(false)
    expect(creditBoard(done, 4).complete).toBe(true)
    expect(eventCrops(['autumn-2026'])[0]!.glyph).toBe('🎃')
  })
})
