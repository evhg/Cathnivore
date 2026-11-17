import { describe, expect, it } from 'vitest'
import { computeFlow, dailyPuzzle, rotateCell, tapsToSolve } from '../games/runnel/src/engine'
import { REPLAY_MS, replayEnd, replayFrames, type TurnLog } from '../games/runnel/src/replay'

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
