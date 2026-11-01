// Plan item 6: the win worth sharing. Draws the solved board and the result onto a 2D canvas as a share
// card (1080x1350, a portrait post). The drawing only uses a small subset of the canvas API (`CardContext`)
// so a test can record the calls and pin them with a hash: the same seed always draws the same card.

import { computeFlow, type Puzzle } from './engine'

export interface CardContext {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineCap: CanvasLineCap
  font: string
  textAlign: CanvasTextAlign
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  arc(x: number, y: number, r: number, a0: number, a1: number): void
  fill(): void
  stroke(): void
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
}

export interface CardResult {
  title: string
  time: string
  taps: number
  par: number
  streak?: number
}

export const CARD_W = 1080
export const CARD_H = 1350

const INK = '#2b2320'
const PAPER = '#f6efe0'
const COLOURS = { stone: '#9a948a', field: '#7bbf4a', spring: '#4aa3d8', channel: '#d9c39a', water: '#3d8fd1', rim: '#5a4632' }

/** Draws the card: a title, the solved board with water in every channel, the numbers and the address. */
export function drawShareCard(ctx: CardContext, puzzle: Puzzle, result: CardResult): void {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // a band of field green along the bottom, like the edge of a meadow
  ctx.fillStyle = '#d7e6b8'
  ctx.fillRect(0, CARD_H - 170, CARD_W, 170)

  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.font = '600 64px Georgia, serif'
  ctx.fillText(result.title, CARD_W / 2, 120)
  ctx.font = '36px Georgia, serif'
  ctx.fillText('Every field is watered.', CARD_W / 2, 176)

  // the board in its solved orientation, scaled to fit a 780 px square between the title and the numbers
  const solved = puzzle.cells.map((c) => ({ ...c, rot: 0 }))
  const flow = computeFlow(solved)
  const xs = solved.map((c) => Math.sqrt(3) * (c.q + c.r / 2))
  const ys = solved.map((c) => 1.5 * c.r)
  const span = Math.max(Math.max(...xs) - Math.min(...xs) + 2, Math.max(...ys) - Math.min(...ys) + 2)
  const s = 780 / span
  const cx = CARD_W / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * s
  const cy = 220 + 400 - ((Math.max(...ys) + Math.min(...ys)) / 2) * s
  const hex = (x: number, y: number, r: number) => {
    ctx.beginPath()
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k + 30)
      const px = x + r * Math.cos(a)
      const py = y + r * Math.sin(a)
      if (k) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
    ctx.closePath()
  }
  solved.forEach((c, i) => {
    const x = cx + xs[i]! * s
    const y = cy + ys[i]! * s
    hex(x, y, s * 0.96)
    ctx.fillStyle = c.kind === 'stone' ? COLOURS.stone : c.kind === 'field' ? COLOURS.field : c.kind === 'spring' ? COLOURS.spring : COLOURS.channel
    ctx.fill()
    ctx.strokeStyle = COLOURS.rim
    ctx.lineWidth = 3
    ctx.stroke()
    if (c.kind === 'stone') return
    // water along every opening of the solved channel
    ctx.strokeStyle = flow.wet.has(i) ? COLOURS.water : '#b8a98a'
    ctx.lineWidth = s * 0.22
    ctx.lineCap = 'round'
    for (let d = 0; d < 6; d++) {
      if (!(c.solved & (1 << d))) continue
      const a = (Math.PI / 180) * 60 * d
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a) * s * 0.86, y + Math.sin(a) * s * 0.86)
      ctx.stroke()
    }
    if (c.kind === 'field' || c.kind === 'spring') {
      ctx.fillStyle = c.kind === 'spring' ? '#e8f6ff' : '#f2d13a'
      ctx.beginPath()
      ctx.arc(x, y, s * 0.2, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  // the numbers
  const stats: [string, string][] = [
    [result.time, 'time'],
    [String(result.taps), 'taps'],
    [String(result.par), 'par'],
  ]
  if (result.streak && result.streak > 1) stats.push([String(result.streak), 'day streak'])
  const colW = CARD_W / stats.length
  stats.forEach(([value, label], i) => {
    const x = colW * i + colW / 2
    ctx.fillStyle = INK
    ctx.font = '600 72px Georgia, serif'
    ctx.fillText(value, x, CARD_H - 240)
    ctx.font = '30px Georgia, serif'
    ctx.fillText(label, x, CARD_H - 198)
  })
  ctx.fillStyle = INK
  ctx.font = '600 34px Georgia, serif'
  ctx.fillText('cathnivore.com/runnel', CARD_W / 2, CARD_H - 70)
}
