import { describe, expect, it } from 'vitest'
import { lightFor, skyForHour } from '../src/ui/tableLight'

describe('lightFor (plan item 28)', () => {
  it('opens at dawn and reaches dusk by round 9', () => {
    expect(lightFor(1)).toBe('dawn')
    expect(lightFor(2)).toBe('dawn')
    expect(lightFor(5)).toBe('noon')
    expect(lightFor(9)).toBe('dusk')
    expect(lightFor(14)).toBe('dusk')
  })
  it('never runs backwards and round 1 differs from round 5', () => {
    const order = ['dawn', 'morning', 'noon', 'afternoon', 'dusk']
    for (let r = 1; r < 15; r++) expect(order.indexOf(lightFor(r + 1))).toBeGreaterThanOrEqual(order.indexOf(lightFor(r)))
    expect(lightFor(1)).not.toBe(lightFor(5))
  })
  it('is safe for odd input', () => {
    expect(lightFor(0)).toBe('dawn')
    expect(lightFor(-3)).toBe('dawn')
  })
})

describe('skyForHour (plan item 206)', () => {
  it('runs dawn, day, golden hour and evening through the day', () => {
    expect(skyForHour(6)).toBe('dawn')
    expect(skyForHour(8)).toBe('day')
    expect(skyForHour(15)).toBe('day')
    expect(skyForHour(16)).toBe('golden')
    expect(skyForHour(19)).toBe('evening')
    expect(skyForHour(2)).toBe('evening')
  })
  it('the dark theme is always the evening', () => {
    for (let h = 0; h < 24; h++) expect(skyForHour(h, true)).toBe('evening')
  })
})
