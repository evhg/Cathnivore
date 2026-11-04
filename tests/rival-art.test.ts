import { describe, expect, it } from 'vitest'
import { RIVAL_MOODS, rivalMood } from '../src/ui/portraits/rivalFace'
import { MOOD_EXPRESSION } from '../src/ui/boardroom'

// Plan item 92: Graham Pell, Hollowell's face across the table, in the boardroom's three moods, mirroring Cath's.
describe('the rival across the table', () => {
  it('mirrors Cath: rattled when she is delighted, gloating when she is worried, smug otherwise', () => {
    expect(rivalMood('delighted')).toBe('rattled')
    expect(rivalMood('wink')).toBe('rattled')
    expect(rivalMood('worried')).toBe('gloat')
    expect(rivalMood('determined')).toBe('smug')
    expect(rivalMood('smirk')).toBe('smug')
    expect(rivalMood(undefined)).toBe('smug')
  })
  it('draws every mood with a distinct face', () => {
    expect(new Set(RIVAL_MOODS.map((m) => MOOD_EXPRESSION[m])).size).toBe(3)
  })
})
