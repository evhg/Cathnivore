// AAA UI shared motion helpers: every helper lands on the final state at once when motion is off, and
// writes per-element values only through style.setProperty (CSP).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { burst, countUp, reducedMotion, setVars, stagger, tick } from '../shared/ui/motion'

class FakeEl {
  props = new Map<string, string>()
  classes = new Set<string>()
  children: FakeEl[] = []
  attrs = new Map<string, string>()
  listeners = new Map<string, () => void>()
  textContent = ''
  className = ''
  parent: FakeEl | null = null
  offsetWidth = 10
  ownerDocument = { createElement: () => new FakeEl() }
  style = { setProperty: (n: string, v: string) => void this.props.set(n, v) }
  classList = {
    add: (c: string) => void this.classes.add(c),
    remove: (c: string) => void this.classes.delete(c),
    contains: (c: string) => this.classes.has(c),
  }
  get lastElementChild(): FakeEl | null {
    return this.children.at(-1) ?? null
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v)
  }
  appendChild(c: FakeEl) {
    c.parent = this
    this.children.push(c)
    return c
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this)
  }
  addEventListener(t: string, fn: () => void) {
    this.listeners.set(t, fn)
  }
}

const el = () => new FakeEl() as unknown as HTMLElement
const g = globalThis as Record<string, unknown>

describe('shared/ui/motion', () => {
  let reduce = false
  beforeEach(() => {
    reduce = false
    g.matchMedia = () => ({ matches: reduce })
    g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16)
  })
  afterEach(() => {
    delete g.matchMedia
    delete g.requestAnimationFrame
    vi.useRealTimers()
  })

  it('reads the OS setting', () => {
    expect(reducedMotion()).toBe(false)
    reduce = true
    expect(reducedMotion()).toBe(true)
  })

  it('setVars writes custom properties with or without the dashes', () => {
    const e = new FakeEl()
    setVars(e as unknown as HTMLElement, { i: 3, '--v': '0.5' })
    expect(e.props.get('--i')).toBe('3')
    expect(e.props.get('--v')).toBe('0.5')
  })

  it('stagger caps --i and marks the parent', () => {
    const p = new FakeEl()
    for (let i = 0; i < 14; i++) p.appendChild(new FakeEl())
    stagger(p as unknown as HTMLElement, 10)
    expect(p.classes.has('stagger')).toBe(true)
    expect(p.children[2]!.props.get('--i')).toBe('2')
    expect(p.children[13]!.props.get('--i')).toBe('10')
  })

  it('countUp jumps to the exact value when motion is off', async () => {
    reduce = true
    const e = el()
    await countUp(e, 79)
    expect(e.textContent).toBe('79')
  })

  it('countUp animates and still ends on the exact value', async () => {
    const e = el()
    await countUp(e, 1234, { ms: 60, fmt: (n) => Math.round(n).toLocaleString('en-GB') })
    expect(e.textContent).toBe('1,234')
  })

  it('tick and burst draw nothing when motion is off', () => {
    reduce = true
    const host = new FakeEl()
    tick(host as unknown as HTMLElement)
    expect(host.classes.has('ui-tick')).toBe(false)
    expect(burst(host as unknown as HTMLElement)).toBeNull()
    expect(host.children).toHaveLength(0)
  })

  it('burst caps at 12 nodes and removes itself', () => {
    vi.useFakeTimers()
    const host = new FakeEl()
    const b = burst(host as unknown as HTMLElement, { n: 40, color: '#D9B45A' }) as unknown as FakeEl
    expect(b.children).toHaveLength(12)
    expect(b.props.get('--burst')).toBe('#D9B45A')
    expect(host.children).toHaveLength(1)
    vi.advanceTimersByTime(1300)
    expect(host.children).toHaveLength(0)
  })
})
