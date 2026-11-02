import { afterEach, describe, expect, it, vi } from 'vitest'

// Plan item 37: the screenshot hook plays in memory only.
describe('runnel saves under the screenshot hook', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('writes nothing to storage while frozen, and writes again once thawed', async () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) })
    const store = await import('../games/runnel/src/store')
    store.freezeSaves(true)
    store.save(store.load())
    expect(data.size).toBe(0)
    store.freezeSaves(false)
    store.save(store.load())
    expect(data.has('runnel:v1')).toBe(true)
  })
})
