import { describe, expect, it } from 'vitest'
import { OPENING_KEY, shouldOpen, type OpeningEnv } from '../src/ui/titleOpening'

const memory = () => {
  const m: Record<string, string> = {}
  return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => void (m[k] = v), m }
}
const env = (over: Partial<OpeningEnv> = {}): OpeningEnv => ({ day: '2026-11-16', webdriver: false, forced: false, tallPhone: true, store: memory(), ...over })

describe('the title opening (plan item 453)', () => {
  it('plays on the day\'s first load on a tall phone, then not again that day', () => {
    const store = memory()
    expect(shouldOpen(env({ store }))).toBe(true)
    expect(store.m[OPENING_KEY]).toBe('2026-11-16')
    expect(shouldOpen(env({ store }))).toBe(false)
    expect(shouldOpen(env({ store, day: '2026-11-17' }))).toBe(true)
  })
  it('never plays on desktop, under webdriver or without storage, unless forced', () => {
    expect(shouldOpen(env({ tallPhone: false }))).toBe(false)
    expect(shouldOpen(env({ webdriver: true }))).toBe(false)
    expect(shouldOpen(env({ store: null }))).toBe(false)
    expect(shouldOpen(env({ webdriver: true, forced: true }))).toBe(true)
  })
  it('a storage that throws means no opening', () => {
    const store = { getItem: () => { throw new Error('blocked') }, setItem: () => {} }
    expect(shouldOpen(env({ store }))).toBe(false)
  })
})
