import { describe, expect, it } from 'vitest'
import { computeFlow, dailyPuzzle, rotateCell, tapsToSolve } from '../games/runnel/src/engine'
import { CLIP_SPIN_MS, REPLAY_MS, clipFrameAt, replayEnd, replayFrames, type TurnLog } from '../games/runnel/src/replay'
import { drawShareCard, type CardContext } from '../games/runnel/src/sharecard'

// Plan item 478: the solve's replay is folded from the player's own turns and must land on exactly the board they solved,
// inside the replay's six seconds, frames in order.
function playerSolve(date: string, seed: number): { start: number[]; end: number[]; log: TurnLog } {
  const p = dailyPuzzle(date)
  const start = p.cells.map((c) => c.rot)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const log: TurnLog = []
  let t = 0
  const turn = (i: number, dir: 1 | -1) => {
    if (rotateCell(p.cells, i, dir === 1)) log.push([i, dir, (t += 300 + Math.floor(rnd() * 2500))])
  }
  const order = p.cells.map((_, i) => i).sort(() => rnd() - 0.5)
  for (const i of order) {
    // a wrong turn and its undo now and then (a run that nets to nothing), a detour on another tile, then the real turns
    if (rnd() < 0.3) { turn(i, 1); turn(i, -1) }
    if (rnd() < 0.2) { const j = order[Math.floor(rnd() * order.length)]!; turn(j, 1) }
    const n = tapsToSolve(p.cells[i]!)
    for (let k = 0; k < n; k++) turn(i, 1)
  }
  // the detours left some tiles off; set them right
  for (const i of order) for (let k = tapsToSolve(p.cells[i]!); k > 0; k--) turn(i, 1)
  expect(computeFlow(p.cells).solved, date).toBe(true)
  return { start, end: p.cells.map((c) => c.rot), log }
}

describe('Runnel solve replay (plan item 478)', () => {
  for (const [date, seed] of [['2026-11-17', 1], ['2026-11-03', 7], ['2026-10-12', 42], ['2026-11-15', 99]] as const) {
    it(`${date}: the replay lands on the solved board within ${REPLAY_MS} ms`, () => {
      const { start, end, log } = playerSolve(date, seed)
      const frames = replayFrames(start, log)
      expect(replayEnd(start, frames)).toEqual(end)
      expect(frames.length).toBeGreaterThan(0)
      expect(frames.length).toBeLessThanOrEqual(log.length)
      for (let i = 1; i < frames.length; i++) expect(frames[i]!.at).toBeGreaterThanOrEqual(frames[i - 1]!.at)
      expect(frames[0]!.at).toBeGreaterThanOrEqual(0)
      expect(frames[frames.length - 1]!.at).toBeLessThanOrEqual(REPLAY_MS)
      for (const f of frames) expect(f.turn).not.toBe(0)
    })
  }
  it('a turn and its undo on one tile leave no frame', () => {
    expect(replayFrames([0, 0], [[1, 1, 100], [1, -1, 400]])).toEqual([])
  })
})

describe('Runnel replay clip (plan item 478)', () => {
  it('starts on the scrambled board, spins each tile through its turn and ends on the solved one', () => {
    const { start, end, log } = playerSolve('2026-11-17', 3)
    const frames = replayFrames(start, log)
    expect(clipFrameAt(start, frames, 0)).toEqual({ rots: start, step: 0, done: false })
    const last = clipFrameAt(start, frames, REPLAY_MS)
    expect(last.rots).toEqual(end)
    expect(last.step).toBe(frames.length)
    expect(last.done).toBe(true)
    // half way through a frame's spin its tile sits between where it was and where it lands
    const f = frames[0]!
    const mid = clipFrameAt(start, frames, f.at + CLIP_SPIN_MS / 2).rots[f.cell]!
    const from = f.rot - f.turn
    expect(Math.min(from, f.rot)).toBeLessThan(mid)
    expect(mid).toBeLessThan(Math.max(from, f.rot))
    expect(Number.isInteger(mid)).toBe(false)
  })

  it('draws the card mid-solve with its own caption, the water only where it runs', () => {
    const p = dailyPuzzle('2026-11-17')
    const start = p.cells.map((c) => c.rot)
    const calls: string[] = []
    const props: Record<string, unknown> = {}
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_t, k: string) => (k in props ? props[k] : (...a: unknown[]) => calls.push(`${k}:${a.map(String).join(',')}:${String(props.strokeStyle)}`)),
      set: (_t, k: string, v) => ((props[k] = v), true),
    }) as unknown as CardContext
    drawShareCard(ctx, p, { title: 'Runnel #1', time: '1:00', taps: 3, par: 10 }, { rots: start, caption: 'Watch the water find its way.' })
    expect(calls.some((c) => c.startsWith('fillText:Watch the water find its way.'))).toBe(true)
    const water = (cs: string[]) => cs.filter((c) => c.startsWith('stroke:') && c.endsWith('#3d8fd1')).length
    const scrambled = water(calls)
    calls.length = 0
    drawShareCard(ctx, p, { title: 'Runnel #1', time: '1:00', taps: 3, par: 10 })
    expect(water(calls)).toBeGreaterThan(scrambled)
  })
})
