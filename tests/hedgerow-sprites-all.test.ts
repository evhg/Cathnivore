import { describe, expect, it } from 'vitest'
import { ENEMIES, type EnemyKind } from '../games/hedgerow/src/engine'
import { drawEnemy } from '../games/hedgerow/src/sprites'

// Plan item 285: every enemy on the lane has a drawn sprite of its own, not just a shadow on the ground. The sprite
// is drawn into a recording canvas; the ground shadow alone is one fill, so a real body adds several more.
function recorder() {
  let ops = 0
  const gradient = { addColorStop() {} }
  const ctx: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(t, k) {
      if (k in t) return t[k as string]
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradient
      if (k === 'measureText') return () => ({ width: 10 })
      if (k === 'fill' || k === 'stroke' || k === 'fillRect' || k === 'strokeRect' || k === 'fillText' || k === 'drawImage') return () => void ops++
      return () => {}
    },
    set(t, k, v) {
      t[k as string] = v
      return true
    },
  }
  return { ctx: new Proxy(ctx, handler) as unknown as CanvasRenderingContext2D, ops: () => ops }
}

describe('Hedgerow enemy sprites (plan item 285)', () => {
  const kinds = Object.keys(ENEMIES) as EnemyKind[]
  it('covers every enemy id', () => expect(kinds.length).toBeGreaterThan(10))
  it('would catch a missing sprite (an unknown id draws its shadow only)', () => {
    const r = recorder()
    drawEnemy(r.ctx, { kind: 'no-such-enemy' as EnemyKind, facing: 1, hit: 9, ghost: false, phase: 0 }, 50, 50, 60, 0.3)
    expect(r.ops()).toBeLessThan(4)
  })
  for (const kind of kinds)
    it(`${kind} draws a body of its own`, () => {
      const r = recorder()
      drawEnemy(r.ctx, { kind, facing: 1, hit: 9, ghost: false, phase: 0 }, 50, 50, 60, 0.3)
      expect(r.ops()).toBeGreaterThanOrEqual(4)
    })
})
