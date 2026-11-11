import { describe, expect, it } from 'vitest'
import type { TowerKind } from '../games/hedgerow/src/engine'
import { drawTower } from '../games/hedgerow/src/sprites'

// Plan item 322: every tower on the field has an idle of its own (sails turn, bees circle, the coat stirs, the lamp
// blinks...), so two frames a moment apart draw differently; under reduced motion (`still`) they draw the same.
// The tower is drawn into a canvas that records every call with its arguments and every style set.
function record(draw: (ctx: CanvasRenderingContext2D) => void): string {
  const log: string[] = []
  const gradient = { addColorStop() {} }
  const fmt = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : String(v))
  const ctx: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(t, k) {
      if (k in t) return t[k as string]
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradient
      if (k === 'measureText') return () => ({ width: 10 })
      return (...args: unknown[]) => void log.push(`${String(k)}(${args.map(fmt).join(',')})`)
    },
    set(t, k, v) {
      t[k as string] = v
      log.push(`${String(k)}=${fmt(v)}`)
      return true
    },
  }
  draw(new Proxy(ctx, handler) as unknown as CanvasRenderingContext2D)
  return log.join(';')
}

const KINDS: TowerKind[] = ['hedgerow', 'scarecrow', 'beehive', 'stall', 'pond', 'barn', 'silo', 'mast', 'tent', 'court', 'hall', 'windmill', 'cannon']

describe('Hedgerow tower idles (plan item 322)', () => {
  for (const kind of KINDS) {
    const frame = (t: number, still: boolean) =>
      record((ctx) => drawTower(ctx, { kind, tier: 1, spec: null, fired: 9, dazed: false, still }, 60, 60, 72, t))
    it(`${kind} moves between two frames`, () => expect(frame(1.3, false)).not.toBe(frame(1.75, false)))
    it(`${kind} holds still under reduced motion`, () => expect(frame(1.3, true)).toBe(frame(1.75, true)))
  }
})
