// Plan item 478: the solve's replay as a clip to keep. The share card's board plays the solve (each tile spinning into
// place, the water following, the taps climbing) on a canvas that a MediaRecorder films as a WebM, ending on the
// watered board. Where the browser can't film a canvas, the caller saves today's card image instead.

import type { Puzzle } from './engine'
import { CLIP_HOLD_MS, REPLAY_MS, clipFrameAt, type ReplayFrame } from './replay'
import { CARD_H, CARD_W, drawShareCard, type CardResult } from './sharecard'

/** The clip's size: the card at two thirds (720x900), small enough to share, sharp on a phone. */
const SCALE = 2 / 3
const TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

/** The WebM type this browser can film a canvas in, or null. */
export function clipType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

/** Films the replay on the card in real time (about seven seconds) and returns the WebM, or null if filming failed. */
export async function recordReplayClip(puzzle: Puzzle, start: readonly number[], frames: readonly ReplayFrame[], result: CardResult): Promise<Blob | null> {
  const type = clipType()
  if (!type) return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CARD_W * SCALE)
  canvas.height = Math.round(CARD_H * SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const draw = (t: number): void => {
    const f = clipFrameAt(start, frames, t)
    const taps = f.done ? result.taps : Math.round((result.taps * f.step) / Math.max(1, frames.length))
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    drawShareCard(ctx, puzzle, { ...result, taps }, { rots: f.rots, caption: f.done ? 'Every field is watered.' : 'Watch the water find its way.' })
  }
  draw(0)
  const stream = canvas.captureStream(30)
  const chunks: Blob[] = []
  let rec: MediaRecorder
  try {
    rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 })
  } catch {
    return null
  }
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()))
  rec.start(500)
  const t0 = performance.now()
  const total = REPLAY_MS + CLIP_HOLD_MS
  await new Promise<void>((res) => {
    // a timer, not animation frames: a hidden tab still finishes the clip
    const id = window.setInterval(() => {
      const t = performance.now() - t0
      draw(Math.min(t, total))
      if (t >= total) {
        window.clearInterval(id)
        res()
      }
    }, 1000 / 30)
  })
  rec.stop()
  stream.getTracks().forEach((tr) => tr.stop())
  await stopped
  return chunks.length ? new Blob(chunks, { type: 'video/webm' }) : null
}
