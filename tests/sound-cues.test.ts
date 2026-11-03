// Plan item 53: every action and event on the table has its own cue, and Hollowell's are synth only.
import { describe, expect, it } from 'vitest'
import { ACTION_CUE, cueFor, eventCue, HOLLOWELL_EVENTS, SYNTH_CUES, type Cue } from '../src/platform/sound/cues'
import { CUE_LENGTH } from '../src/platform/sound/synth'
import type { Action, GameEvent } from '../src/engine/types'

const ACTIONS: Action[] = [
  { kind: 'openStall', region: 'saltmarsh' as never },
  { kind: 'supplyOutlets', region: 'saltmarsh' as never, count: 1 },
  { kind: 'supplyBuyout', region: 'saltmarsh' as never },
  { kind: 'rebut', region: 'saltmarsh' as never, count: 1 },
  { kind: 'invest', improvementId: 'x' },
  { kind: 'sell', count: 1 },
  { kind: 'scheme', schemeId: 'x' },
  { kind: 'graft' },
  { kind: 'role' },
  { kind: 'decide', decisionId: 'x', choice: 'marks' as never },
  { kind: 'tearUpContract' },
]
const EVENTS: GameEvent[] = [
  { type: 'action', producer: 'cath' as never, action: { kind: 'graft' } },
  { type: 'liberated', region: 'r' as never, producer: 'cath' as never },
  { type: 'agenda', cardId: 'a' as never, bonusSkipped: false },
  { type: 'squeeze', region: 'r' as never, lostLand: false, stallRemoved: false, trustLoss: 0 },
  { type: 'squeeze', region: 'r' as never, lostLand: true, stallRemoved: false, trustLoss: 1 },
  { type: 'expand', region: 'r' as never, piece: 'outlet' },
  { type: 'expand', region: 'r' as never, piece: 'buyout' },
  { type: 'expand', region: 'r' as never, piece: 'doubt' },
  { type: 'scout', region: 'r' as never, doubtAdded: true },
  { type: 'invest', producer: 'cath' as never, improvementId: 'x' as never },
  { type: 'schemePlayed', producer: 'cath' as never, schemeId: 'x' as never, target: null },
  { type: 'riftSplit', faction: 'x' as never },
  { type: 'decision', decisionId: 'd', choice: 'marks' as never },
  { type: 'trigger', effect: 'e', sceneId: 's' },
]

describe('cueFor', () => {
  it('gives every action kind its own table sound, never a synth one', () => {
    for (const a of ACTIONS) {
      const [c] = cueFor(a, [])
      expect(c, a.kind).toBe(ACTION_CUE[a.kind])
      expect(SYNTH_CUES.has(c!), a.kind).toBe(false)
    }
  })

  it('gives every event type a cue (only the action echo is silent), Hollowell only synth', () => {
    const types = new Set<string>()
    for (const e of EVENTS) {
      types.add(e.type)
      const c = eventCue(e)
      if (e.type === 'action') {
        expect(c).toBeNull()
        continue
      }
      expect(c, e.type).not.toBeNull()
      expect(SYNTH_CUES.has(c!), e.type).toBe(HOLLOWELL_EVENTS.has(e.type))
    }
    expect(types.size).toBe(11)
  })

  it('plays the action first, one per kind of event, at most four, and the result alone', () => {
    const squeeze = EVENTS[3]!
    expect(cueFor(ACTIONS[0]!, [squeeze, squeeze, EVENTS[1]!])).toEqual(['awning', 'synthSweep', 'crowd'])
    expect(cueFor(null, EVENTS).length).toBe(4)
    expect(cueFor(ACTIONS[0]!, EVENTS, { won: true } as never)).toEqual(['win'])
    expect(cueFor(null, [], { won: false } as never)).toEqual(['lose'])
  })

  it('keeps every cue under 1.2 s', () => {
    for (const [cue, len] of Object.entries(CUE_LENGTH) as Array<[Cue, number]>) expect(len, cue).toBeLessThan(1.2)
  })
})
