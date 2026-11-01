import { describe, expect, it } from 'vitest'
import { awardPin, chosenPin, earnedPins, pinForEvent } from '../shared/cath/pins'
import { cathSvg } from '../shared/cath/cath'

function mem() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('market pins', () => {
  it('maps each event to a pin and awards once', () => {
    const s = mem()
    expect(pinForEvent('glut')).toBe('turnip')
    expect(pinForEvent(undefined)).toBeNull()
    expect(awardPin('glut', s)).toBe(true)
    expect(awardPin('glut', s)).toBe(false)
    expect(awardPin(undefined, s)).toBe(false)
    expect(earnedPins(s)).toEqual(['turnip'])
    expect(chosenPin(s)).toBe('turnip')
  })
  it('ignores a pin that was never earned', () => {
    const s = mem()
    s.setItem('cath:pin', 'bunting')
    expect(chosenPin(s)).toBeUndefined()
  })
  it('draws the pin only when asked', () => {
    expect(cathSvg({})).not.toContain('cath-pin')
    expect(cathSvg({ pin: 'bunting' })).toContain('cath-pin')
  })
})
