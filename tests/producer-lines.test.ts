import { describe, expect, it } from 'vitest'
import { PAIR_OPENERS, PRODUCER_LINES, REPLY_BEATS, producerReply } from '../src/content/producerLines'
import { pairKey } from '../src/content/pairLines'
import type { GameEvent, ProducerId, RegionId, RegionState } from '../src/engine/types'

// Plan item 489: the producers' replies at the table.
const ALL: ProducerId[] = ['mara', 'tomas', 'ines', 'sol']
const none = {} as Record<RegionId, RegionState>

describe('producer lines', () => {
  it('every producer has lines for every beat, short enough for a bubble, none repeated', () => {
    const seen = new Set<string>()
    for (const p of ALL)
      for (const b of REPLY_BEATS) {
        const lines = PRODUCER_LINES[p][b]
        expect(lines.length, `${p} ${b}`).toBeGreaterThanOrEqual(2)
        for (const l of lines) {
          expect(l.length, l).toBeLessThanOrEqual(70)
          expect(seen.has(l), l).toBe(false)
          seen.add(l)
        }
      }
  })
  it('every pair has an opener spoken by one of its two', () => {
    for (let i = 0; i < ALL.length; i++)
      for (let j = i + 1; j < ALL.length; j++) {
        const o = PAIR_OPENERS[pairKey(ALL[i]!, ALL[j]!)]
        expect(o, `${ALL[i]}+${ALL[j]}`).toBeTruthy()
        expect([ALL[i], ALL[j]]).toContain(o!.who)
      }
  })
  it('the strongest beat wins, and its own producer speaks', () => {
    const team: ProducerId[] = ['mara', 'tomas']
    const lib: GameEvent = { type: 'liberated', region: 'kingsmarket' as RegionId, producer: 'tomas' }
    const role = { type: 'action', producer: 'mara', action: { kind: 'role' } } as unknown as GameEvent
    expect(producerReply([role, lib], none, team, 4, 10)).toMatchObject({ producer: 'tomas', beat: 'liberated' })
    expect(producerReply([role], none, team, 4, 10)).toMatchObject({ producer: 'mara', beat: 'ability' })
    const squeeze = { type: 'squeeze', region: 'oakvale', lostLand: false, stallRemoved: true, trustLoss: 0 } as unknown as GameEvent
    const before = { oakvale: { stalls: { tomas: 1 } } } as unknown as Record<RegionId, RegionState>
    expect(producerReply([squeeze], before, team, 4, 10)).toMatchObject({ producer: 'tomas', beat: 'squeezed' })
    expect(producerReply([], none, team, 10, 10)?.beat).toBe('last')
    expect(producerReply([], none, team, 1, 10)).toMatchObject({ producer: 'tomas', beat: 'round', line: PAIR_OPENERS['mara+tomas']!.line })
    expect(producerReply([], none, team, 3, 10)?.beat).toBe('round')
    expect(producerReply([], none, team, 4, 10)).toBeNull()
  })
  it('a replayed turn says the same thing, and a producer off the team never speaks', () => {
    const role = { type: 'action', producer: 'sol', action: { kind: 'role' } } as unknown as GameEvent
    expect(producerReply([role], none, ['mara', 'tomas'], 5, 10)).toBeNull()
    const a = producerReply([role], none, ['sol', 'ines'], 5, 10)
    expect(producerReply([role], none, ['sol', 'ines'], 5, 10)).toEqual(a)
  })
})
