import { describe, expect, it } from 'vitest'
import { dailyPuzzle, hashString } from '../games/runnel/src/engine'
import { drawShareCard, type CardContext } from '../games/runnel/src/sharecard'

// Plan item 6: the share card draws the same picture for the same seed (pinned by a hash of its calls).
function recorder(): CardContext & { log: string[] } {
  const log: string[] = []
  const r = (n: number) => n.toFixed(1)
  const props: Record<string, unknown> = {}
  const ctx = {
    log,
    beginPath: () => log.push('B'),
    moveTo: (x: number, y: number) => log.push(`M${r(x)},${r(y)}`),
    lineTo: (x: number, y: number) => log.push(`L${r(x)},${r(y)}`),
    closePath: () => log.push('Z'),
    arc: (x: number, y: number, rad: number) => log.push(`A${r(x)},${r(y)},${r(rad)}`),
    fill: () => log.push(`F${String(props.fillStyle)}`),
    stroke: () => log.push(`S${String(props.strokeStyle)}/${r(Number(props.lineWidth))}`),
    fillRect: (x: number, y: number, w: number, h: number) => log.push(`R${x},${y},${w},${h},${String(props.fillStyle)}`),
    fillText: (t: string, x: number, y: number) => log.push(`T${t}@${r(x)},${r(y)} ${String(props.font)}`),
  }
  return new Proxy(ctx, {
    get: (t, k: string) => (k in t ? (t as Record<string, unknown>)[k] : props[k]),
    set: (_t, k: string, v) => ((props[k] = v), true),
  }) as unknown as CardContext & { log: string[] }
}

describe('runnel share card', () => {
  it('draws the solved board, the numbers and the address', () => {
    const ctx = recorder()
    const p = dailyPuzzle('2026-11-01')
    drawShareCard(ctx, p, { title: 'Runnel #36', time: '1:42', taps: 40, par: 38, streak: 3 })
    expect(ctx.log.some((l) => l.startsWith('TRunnel #36'))).toBe(true)
    expect(ctx.log.some((l) => l.startsWith('Tcathnivore.com/runnel'))).toBe(true)
    expect(ctx.log.some((l) => l.startsWith('T3@'))).toBe(true)
    // every non-stone cell is drawn as a hex: six corners each
    expect(ctx.log.filter((l) => l === 'Z').length).toBe(p.cells.length)
  })
  it('is the same picture for the same seed', () => {
    const draw = () => {
      const ctx = recorder()
      drawShareCard(ctx, dailyPuzzle('2026-11-01'), { title: 'Runnel #36', time: '1:42', taps: 40, par: 38 })
      return hashString(ctx.log.join('\n'))
    }
    expect(draw()).toBe(draw())
    expect(draw()).toMatchInlineSnapshot(`119405226`)
  })
})
