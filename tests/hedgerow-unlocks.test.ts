import { describe, expect, it } from 'vitest'
import { UNLOCKS, initUnlocks, isOpen, markUnlockSeen, openActs, pendingUnlock } from '../games/hedgerow/src/unlocks'
import { emptySave } from '../games/hedgerow/src/store'
import { LEVELS } from '../games/hedgerow/src/levels'

const cleared = (n: number) => {
  const d = emptySave()
  for (let i = 1; i <= n; i++) d.stars[String(i)] = 1
  return d
}

describe('Hedgerow progressive unlocks (plan item 3)', () => {
  it('a fresh save has nothing open, no card, act 1 only, and two towers on level 1', () => {
    const d = emptySave()
    initUnlocks(d)
    for (const u of UNLOCKS) expect(isOpen(d, u.id)).toBe(false)
    expect(pendingUnlock(d)).toBeNull()
    expect(openActs(d, 10)).toBe(1)
    expect(LEVELS[0]!.towers.length).toBeLessThanOrEqual(2)
  })

  it('the table is ordered by level, ids are unique, and every system opens by the end of act 2', () => {
    const levels = UNLOCKS.map((u) => u.level)
    expect([...levels].sort((a, b) => a - b)).toEqual(levels)
    expect(new Set(UNLOCKS.map((u) => u.id)).size).toBe(UNLOCKS.length)
    expect(Math.max(...levels)).toBeLessThanOrEqual(20)
  })

  it('each card appears once, in order, when its field opens', () => {
    const d = emptySave()
    initUnlocks(d)
    const shown: string[] = []
    for (let n = 1; n <= 20; n++) {
      d.stars[String(n)] = 1
      for (let u = pendingUnlock(d); u; u = pendingUnlock(d)) {
        expect(u.level).toBe(n + 1)
        shown.push(u.id)
        markUnlockSeen(d, u.id)
      }
    }
    expect(shown).toEqual(UNLOCKS.map((u) => u.id))
  })

  it('a save from before the table counts open cards as seen, and only shows later ones', () => {
    const d = cleared(5) // fields 1-6 open: almanac, kit, daily and modes are open already
    expect(initUnlocks(d)).toBe(true)
    expect(pendingUnlock(d)).toBeNull()
    expect(initUnlocks(d)).toBe(false)
    for (let i = 6; i <= 10; i++) d.stars[String(i)] = 1
    expect(pendingUnlock(d)?.id).toBe('orchard')
  })

  it('sandbox opens everything and shows no cards; acts open one boss at a time', () => {
    const d = emptySave()
    expect(isOpen(d, 'show', true)).toBe(true)
    expect(pendingUnlock(cleared(20), true)).toBeNull()
    expect(openActs(cleared(9), 10)).toBe(1)
    expect(openActs(cleared(10), 10)).toBe(2)
    expect(openActs(cleared(100), 10)).toBe(10)
  })
})
