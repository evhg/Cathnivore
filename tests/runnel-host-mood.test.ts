import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHost } from '../games/runnel/src/host'

// Plan item 558: the host's face (the valley figure at D, item 122's one Cath) follows the puzzle: at least three
// distinct faces tied to puzzle events (a tap, a new field, a spill, the solve). A stub element stands in for the DOM.
function stub(): HTMLElement {
  const classes = new Set<string>()
  return {
    dataset: {} as DOMStringMap,
    innerHTML: '',
    textContent: '',
    offsetWidth: 1,
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) },
  } as unknown as HTMLElement
}

describe('Runnel host mood (plan item 558)', () => {
  const g = globalThis as Record<string, unknown>
  const had = { matchMedia: g.matchMedia, localStorage: g.localStorage }
  beforeAll(() => {
    g.matchMedia = () => ({ matches: false })
    g.localStorage = { getItem: () => null, setItem: () => undefined }
  })
  afterAll(() => {
    g.matchMedia = had.matchMedia
    g.localStorage = had.localStorage
  })

  it('shows at least three expressions across a game: greeting, spill, progress and solve', () => {
    const face = stub()
    const host = createHost(face, stub(), stub())
    const seen = new Set<string>()
    host.greet(true, 3)
    seen.add(face.dataset.expression!)
    host.react(0.45, false, 2, true) // water under way but a channel spills
    seen.add(face.dataset.expression!)
    host.react(0.8, false, 4, false) // nearly there
    seen.add(face.dataset.expression!)
    host.react(1, true, 6, false) // solved
    const solved = face.dataset.expression!
    seen.add(solved)
    expect(seen.size, [...seen].join(',')).toBeGreaterThanOrEqual(3)
    expect(solved).toBe('delighted')
    expect(face.innerHTML).toContain('<svg')
  })
})
