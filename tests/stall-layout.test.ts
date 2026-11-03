import { describe, expect, it } from 'vitest'
import { stallLayout, tagTallies, SLOT_W, SLOT_H } from '../src/ui/stallLayout'
import { IMPROVEMENTS } from '../src/content/improvements'

const cards = (n: number) => IMPROVEMENTS.slice(0, n).map((c) => ({ id: c.id, tags: c.tags }))

// Plan item 62: the farm stall's layout.
describe('stallLayout', () => {
  for (const n of [0, 1, 6, 12])
    it(`places ${n} improvements with no two crates on the same spot`, () => {
      const slots = stallLayout(cards(n))
      expect(slots).toHaveLength(n)
      const keys = new Set(slots.map((s) => `${s.shelf}:${s.col}:${s.layer}`))
      expect(keys.size).toBe(n)
      for (let i = 0; i < slots.length; i++)
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i]!
          const b = slots[j]!
          const same = Math.abs(a.x - b.x) < SLOT_W / 2 && Math.abs(a.y - b.y) < SLOT_H / 3
          expect(same, `${a.id} and ${b.id}`).toBe(false)
        }
    })
  it('keeps every slot where it was as more are bought', () => {
    const six = stallLayout(cards(6))
    const twelve = stallLayout(cards(12))
    expect(twelve.slice(0, 6)).toEqual(six)
  })
  it('tallies tags, the most first', () => {
    const t = tagTallies([{ tags: ['crop'] }, { tags: ['crop', 'science'] }, { tags: ['coast'] }])
    expect(t[0]).toEqual(['crop', 2])
    expect(t.length).toBe(3)
  })
})
