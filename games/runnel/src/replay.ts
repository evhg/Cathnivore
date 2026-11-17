// Plan item 478: a solve's replay. Each turn the player makes is logged (`TurnLog`); `replayFrames` folds the log into
// about six seconds of frames on the real board: a run of turns on one tile becomes its net turn, a run that comes back
// to where it started (turned and turned back) is dropped, and the frames keep the player's own rhythm, squeezed into
// the replay's length. Pure: the board plays the frames, the tests check them.

/** One turn: [cell index, +1 clockwise or -1 anticlockwise, ms since the puzzle's clock started]. */
export type TurnEntry = [number, 1 | -1, number]
export type TurnLog = TurnEntry[]

export interface ReplayFrame {
  cell: number
  /** The tile's rotation (0-5) once this frame has played. */
  rot: number
  /** The net sixths turned in this frame (+ clockwise), for the spin. */
  turn: number
  /** When it plays, ms from the replay's start. */
  at: number
}

/** The replay's length, ms (the frames' times are squeezed or stretched to end here). */
export const REPLAY_MS = 6000
/** The first frame waits this long (the board settles); the last ends this long before the bloom. */
const LEAD_MS = 300

const mod6 = (n: number) => ((n % 6) + 6) % 6

/**
 * The frames that replay `log` from the starting rotations `start`. Consecutive turns on one tile fold into one frame
 * of their net turn; a fold that nets to no turn is dropped.
 */
export function replayFrames(start: readonly number[], log: TurnLog): ReplayFrame[] {
  const rots = [...start]
  const folded: { cell: number; turn: number; t: number }[] = []
  for (const [cell, dir, t] of log) {
    const last = folded[folded.length - 1]
    if (last && last.cell === cell) {
      last.turn += dir
      last.t = t
    } else folded.push({ cell, turn: dir, t })
  }
  const kept = folded.filter((f) => mod6(f.turn) !== 0)
  if (!kept.length) return []
  const t0 = kept[0]!.t
  const span = Math.max(1, kept[kept.length - 1]!.t - t0)
  const room = REPLAY_MS - 2 * LEAD_MS
  // The player's rhythm, squeezed into the replay: each frame at its share of the solve's span, but never closer to the
  // last than an even share would put it, so a long pause doesn't crowd the rest into a blur.
  const even = room / Math.max(1, kept.length - 1)
  let prev = -Infinity
  return kept.map((f, i) => {
    const byTime = LEAD_MS + ((f.t - t0) / span) * room
    const at = Math.round(Math.max(byTime, prev + Math.min(even, 220), i === 0 ? LEAD_MS : -Infinity))
    prev = at
    const turn = ((f.turn + 3) % 6 + 6) % 6 - 3 // the short way round: -2..3
    rots[f.cell] = mod6(rots[f.cell]! + f.turn)
    return { cell: f.cell, rot: rots[f.cell]!, turn, at: Math.min(at, REPLAY_MS - LEAD_MS) }
  })
}

/** The rotations once every frame has played. */
export function replayEnd(start: readonly number[], frames: readonly ReplayFrame[]): number[] {
  const rots = [...start]
  for (const f of frames) rots[f.cell] = f.rot
  return rots
}

/** How long a frame's tile takes to spin into place in the clip, ms. */
export const CLIP_SPIN_MS = 220
/** The clip holds the watered board this long after the replay ends, ms. */
export const CLIP_HOLD_MS = 1200

/**
 * The board at `t` ms into the clip: each tile's rotation (fractional while it spins, eased), how many frames have
 * started, and whether the replay is over. Pure, so the clip's drawing and the tests read the same board.
 */
export function clipFrameAt(start: readonly number[], frames: readonly ReplayFrame[], t: number): { rots: number[]; step: number; done: boolean } {
  const rots = [...start]
  let step = 0
  for (const f of frames) {
    if (t < f.at) break
    step++
    const p = Math.min(1, (t - f.at) / CLIP_SPIN_MS)
    const eased = 1 - (1 - p) ** 3
    rots[f.cell] = p >= 1 ? f.rot : f.rot - f.turn + f.turn * eased
  }
  return { rots, step, done: t >= REPLAY_MS }
}
