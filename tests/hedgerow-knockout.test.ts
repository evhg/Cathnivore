import { describe, expect, it } from 'vitest'
import { playLevel } from '../games/hedgerow/src/bot'
import { stepGame } from '../games/hedgerow/src/engine'
import { holdsKnockout, KNOCKOUT_MS, KNOCKOUT_RATE, renderStep } from '../games/hedgerow/src/knockout'
import { LEVELS } from '../games/hedgerow/src/levels'

// Plan item 479: the win's held knockout is render-only. The engine has finished when it starts, so stepping the
// won game through the hold (as the frame loop does, ~42 steps at 60 Hz) changes nothing: its clock, its tick-driven
// state and its outcome are what the tuner and replays see.
describe('hedgerow: the held knockout', () => {
  it('leaves a won game\'s engine untouched', () => {
    const level = LEVELS.find((l) => l.id === 3)!
    const g = playLevel(level, 'best')
    expect(g.phase).toBe('won')
    const before = JSON.stringify({ tick: g.tick, waveClock: g.waveClock, wave: g.wave, goodwill: g.goodwill, marks: g.marks, leaks: g.leaks, enemies: g.enemies.length })
    for (let i = 0; i < Math.ceil((KNOCKOUT_MS / 1000) * 60); i++) stepGame(g)
    expect(JSON.stringify({ tick: g.tick, waveClock: g.waveClock, wave: g.wave, goodwill: g.goodwill, marks: g.marks, leaks: g.leaks, enemies: g.enemies.length })).toBe(before)
    expect(g.phase).toBe('won')
  })
  it('slows the render clock only inside the window', () => {
    expect(renderStep(0.016, 100, 800)).toBeCloseTo(0.016 * KNOCKOUT_RATE)
    expect(renderStep(0.016, 800, 800)).toBe(0.016)
    expect(renderStep(0.016, 900, 0)).toBe(0.016)
  })
  it('holds only with motion, and under webdriver only when asked', () => {
    expect(holdsKnockout(false, false, '')).toBe(true)
    expect(holdsKnockout(true, false, '')).toBe(false)
    expect(holdsKnockout(false, true, '?level=3')).toBe(false)
    expect(holdsKnockout(false, true, '?sandbox=1&showdown')).toBe(true)
  })
})
