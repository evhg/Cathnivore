import { describe, expect, it } from 'vitest'
import { BEATS_PER_BAR, MUZAK_DUCK, ScoreClock, barNotes, marketBar, modeFor, muzakBar, tempoFor } from '../src/platform/sound/score'

// Plan item 213: the market score's scheduler: bars, tempo and mode by round, the muzak duck, and silence after stop.
describe('the market score', () => {
  it('gives every bar a reed chord, a pluck on the downbeat and the hand drum on 1 and 3', () => {
    for (let bar = 0; bar < 16; bar++) {
      const notes = marketBar(bar, 1)
      expect(notes.filter((n) => n.voice === 'reed')).toHaveLength(2)
      expect(notes.some((n) => n.voice === 'pluck' && n.at === 0)).toBe(true)
      expect(notes.filter((n) => n.voice === 'drum').map((n) => n.at)).toEqual([0, 2])
      for (const n of notes) {
        expect(n.at).toBeGreaterThanOrEqual(0)
        expect(n.at).toBeLessThan(BEATS_PER_BAR)
        expect(n.gain).toBeGreaterThan(0)
      }
    }
    // Deterministic, and not the same bar over and over.
    expect(marketBar(5, 3)).toEqual(marketBar(5, 3))
    expect(new Set(Array.from({ length: 8 }, (_, b) => JSON.stringify(marketBar(b, 1)))).size).toBeGreaterThan(4)
  })

  it('warms up through the day and turns Dorian in the evening', () => {
    expect(tempoFor(1)).toBeLessThan(tempoFor(6))
    expect(tempoFor(10)).toBeLessThan(tempoFor(6))
    expect(modeFor(6)).toBe('major')
    expect(modeFor(7)).toBe('dorian')
    // The evening's flattened third (F natural, MIDI 65 an octave up from D) shows up; the morning's F sharp doesn't.
    const pitchClasses = (round: number) => new Set(Array.from({ length: 8 }, (_, b) => marketBar(b, round)).flat().map((n) => n.midi % 12))
    expect(pitchClasses(1).has(5)).toBe(false)
    expect(pitchClasses(8).has(5)).toBe(true)
  })

  it("ducks the market under Hollowell's muzak on his turn", () => {
    const market = barNotes(2, 'market', 4)
    const muzak = barNotes(2, 'muzak', 4)
    expect(market.some((n) => n.voice === 'muzak')).toBe(false)
    const ducked = muzak.filter((n) => n.voice !== 'muzak')
    expect(ducked).toHaveLength(market.length)
    ducked.forEach((n, i) => expect(n.gain).toBeCloseTo(market[i]!.gain * MUZAK_DUCK))
    expect(muzak.filter((n) => n.voice === 'muzak')).toEqual(muzakBar(2))
  })

  it('schedules bars ahead on the audio clock and nothing after stop', () => {
    const clock = new ScoreClock(10)
    const first = clock.due(10, 0.6)
    expect(first.map((b) => b.bar)).toEqual([0])
    expect(first[0]!.t0).toBe(10)
    // Nothing more until the next bar comes within the look-ahead.
    const barLen = (60 / tempoFor(1)) * BEATS_PER_BAR
    expect(clock.due(10.5, 0.6)).toEqual([])
    const next = clock.due(10 + barLen - 0.3, 0.6)
    expect(next.map((b) => b.bar)).toEqual([1])
    expect(next[0]!.t0).toBeCloseTo(10 + barLen)
    // A mode or round change takes hold from the next bar.
    clock.mode = 'muzak'
    clock.round = 8
    const third = clock.due(10 + 2 * barLen - 0.3, 0.6)[0]!
    expect(third.notes.some((n) => n.voice === 'muzak')).toBe(true)
    expect(third.beat).toBeCloseTo(60 / tempoFor(8))
    clock.stop()
    expect(clock.isStopped).toBe(true)
    expect(clock.due(100, 5)).toEqual([])
  })

  it('skips ahead after a stall instead of playing a burst of late bars', () => {
    const clock = new ScoreClock(0)
    clock.due(0, 0.6)
    const late = clock.due(60, 0.6)
    expect(late).toHaveLength(1)
    expect(late[0]!.t0).toBeGreaterThan(60)
  })
})

describe("the title's clock", () => {
  it('maps the sky to a stand-in round: evening is Dorian, the day busier than dawn', async () => {
    const { scoreRoundForSky } = await import('../src/platform/sound/score')
    expect(modeFor(scoreRoundForSky('evening'))).toBe('dorian')
    expect(modeFor(scoreRoundForSky('day'))).toBe('major')
    expect(tempoFor(scoreRoundForSky('day'))).toBeGreaterThan(tempoFor(scoreRoundForSky('dawn')))
  })
})
