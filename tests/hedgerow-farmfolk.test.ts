import { describe, expect, it } from 'vitest'
import { LEVELS } from '../games/hedgerow/src/levels'
import { allOffLanes, cheer, makeFolk, panic, stepFolk, walkableCells, HIDE_SECS } from '../games/hedgerow/src/farmfolk'
import { laneCellsOf } from '../games/hedgerow/src/engine'

describe('Hedgerow farmfolk (plan item 143)', () => {
  it('puts four or more critters on every level, none on a lane cell', () => {
    for (const lv of LEVELS) {
      const w = makeFolk(lv)
      expect(w.folk.length, `level ${lv.id}`).toBeGreaterThanOrEqual(4)
      expect(allOffLanes(w), `level ${lv.id}`).toBe(true)
      const lanes = laneCellsOf(lv)
      for (const k of walkableCells(lv)) expect(lanes.has(k)).toBe(false)
    }
  })

  it('never steps onto a lane over minutes of play, panics and cheers included', () => {
    for (const lv of LEVELS.filter((_, i) => i % 3 === 0)) {
      const w = makeFolk(lv)
      const busy = new Set<string>()
      for (let i = 0; i < 60 * 90; i++) {
        if (i % 900 === 300) panic(w)
        if (i % 900 === 700) cheer(w)
        stepFolk(w, 1 / 60, busy, i % 1800 > 900)
        if (!allOffLanes(w)) throw new Error(`level ${lv.id} frame ${i}: ${JSON.stringify(w.folk.map((f) => [f.kind, f.x, f.y]))}`)
      }
    }
  })

  it('actually walks between rounds', () => {
    const w = makeFolk(LEVELS[0]!)
    const start = w.folk.map((f) => [f.x, f.y])
    for (let i = 0; i < 60 * 10; i++) stepFolk(w, 1 / 60, new Set(), false)
    const moved = w.folk.filter((f, i) => Math.hypot(f.x - start[i]![0]!, f.y - start[i]![1]!) > 0.5)
    expect(moved.length).toBeGreaterThanOrEqual(2)
  })

  it('runs for the farmhouse on a leak, hides, then goes back to work', () => {
    const lv = LEVELS[4]!
    const w = makeFolk(lv)
    for (let i = 0; i < 120; i++) stepFolk(w, 1 / 60, new Set(), false)
    const before = w.folk.map((f) => Math.hypot(f.x - w.house[0], f.y - w.house[1]))
    panic(w)
    expect(w.folk.every((f) => f.mode === 'flee')).toBe(true)
    for (let i = 0; i < 60 * 20 && w.folk.some((f) => f.mode === 'flee'); i++) stepFolk(w, 1 / 60, new Set(), false)
    expect(w.folk.every((f) => f.mode === 'home')).toBe(true)
    const after = w.folk.map((f) => Math.hypot(f.x - w.house[0], f.y - w.house[1]))
    expect(after.every((d, i) => d <= before[i]! + 0.75)).toBe(true)
    for (let i = 0; i < 60 * (HIDE_SECS + 0.2); i++) stepFolk(w, 1 / 60, new Set(), false)
    expect(w.folk.every((f) => f.mode === 'work')).toBe(true)
  })

  it('cheers on a cleared round, and reduced motion keeps everyone still', () => {
    const w = makeFolk(LEVELS[2]!)
    cheer(w)
    expect(w.folk.every((f) => f.mode === 'cheer')).toBe(true)
    const w2 = makeFolk(LEVELS[2]!)
    const at = w2.folk.map((f) => [f.x, f.y])
    for (let i = 0; i < 600; i++) stepFolk(w2, 1 / 60, new Set(), false, true)
    expect(w2.folk.every((f, i) => f.x === at[i]![0] && f.y === at[i]![1])).toBe(true)
  })

  it('is deterministic per level', () => {
    const a = makeFolk(LEVELS[7]!)
    const b = makeFolk(LEVELS[7]!)
    for (let i = 0; i < 300; i++) {
      stepFolk(a, 1 / 60, new Set(), false)
      stepFolk(b, 1 / 60, new Set(), false)
    }
    expect(a.folk.map((f) => [f.x, f.y])).toEqual(b.folk.map((f) => [f.x, f.y]))
  })

  it('steps off a plot as soon as a tower goes up on it', () => {
    const w = makeFolk(LEVELS[3]!)
    for (let i = 0; i < 60; i++) stepFolk(w, 1 / 60, new Set(), false)
    const f = w.folk.find((x) => x.kind === 'hand')!
    const cell = `${Math.floor(f.x)},${Math.floor(f.y)}`
    for (let i = 0; i < 60 * 3; i++) stepFolk(w, 1 / 60, new Set([cell]), false)
    expect(`${Math.floor(f.x)},${Math.floor(f.y)}`).not.toBe(cell)
  })
})
