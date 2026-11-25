import { describe, expect, it } from 'vitest'
import { weekChipText } from '../shared/cath/weekchip'
import type { WeekGoal } from '../shared/cath/week'

const g = (game: string, need: number, done: number): WeekGoal => ({ id: 'runnel', game, text: 'Do it', need, done, href: '/', cta: 'Play' })

describe('weekChipText', () => {
  it('names the next open goal', () => {
    expect(weekChipText([g('A', 1, 1), g('B', 3, 1)])).toBe("Cath's Week 1/2 · B: do it")
  })
  it("inside a game names only that game's goal, or the count once it is met (plan item 47)", () => {
    const goals = [g('Runnel', 3, 1), g('Hedgerow', 3, 2)]
    expect(weekChipText(goals, 'Hedgerow')).toBe("Cath's Week · Do it (2/3)")
    expect(weekChipText([g('Runnel', 3, 1), g('Hedgerow', 3, 3)], 'Hedgerow')).toBe("Cath's Week 1/2 · Hedgerow done ✓")
    expect(weekChipText(goals, 'Cathnivore')).toBe("Cath's Week 0/2")
  })
  it('says complete when all done', () => {
    expect(weekChipText([g('A', 1, 1), g('B', 3, 5)])).toContain('complete')
  })
})

describe('mountWeekChip (plan item 677)', () => {
  it('refreshes the chip already mounted, so a solve counts at once', async () => {
    const mem = new Map<string, string>()
    const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const g = globalThis as unknown as { localStorage?: unknown }
    const prev = g.localStorage
    g.localStorage = ls
    type El = { className: string; href: string; dataset: Record<string, string>; textContent: string; isConnected: boolean }
    const kids: El[] = []
    const host = {
      querySelector: () => kids[0] ?? null,
      append: (a: El) => { a.isConnected = true; kids.push(a) },
    }
    const doc = { createElement: (): El => ({ className: '', href: '', dataset: {}, textContent: '', isConnected: false }) }
    try {
      const { mountWeekChip } = await import('../shared/cath/weekchip')
      mountWeekChip(host as unknown as HTMLElement, 'Runnel', doc as unknown as Document)
      expect(kids[0]?.textContent).toContain('(0/3)')
      ls.setItem('runnel:v1', JSON.stringify({ results: { '2026-11-23': {} } }))
      mountWeekChip(host as unknown as HTMLElement, 'Runnel', doc as unknown as Document)
      expect(kids).toHaveLength(1)
      expect(kids[0]?.textContent).toContain('(1/3)')
      // Plan item 682: a game's own in-memory save (Runnel's `?shotwin` writes nothing) counts through `storage`.
      const view = { getItem: (k: string) => (k === 'runnel:v1' ? JSON.stringify({ results: { a: {}, b: {} } }) : ls.getItem(k)) }
      mountWeekChip(host as unknown as HTMLElement, 'Runnel', doc as unknown as Document, view)
      expect(kids[0]?.textContent).toContain('(2/3)')
    } finally {
      g.localStorage = prev
    }
  })
})
