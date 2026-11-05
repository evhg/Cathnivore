// Plan item 6: the win worth sharing. Draws the solved board and the result onto a 2D canvas as a share
// card (1080x1350, a portrait post). The drawing only uses a small subset of the canvas API (`CardContext`)
// so a test can record the calls and pin them with a hash: the same seed always draws the same card.

import { computeFlow, type Puzzle } from './engine'
import type { FeatureKind } from './weekvalley'

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
  /** Plan item 142: the week's valley, Monday on: what each day left (a keep, or a fallow plot for a day missed). */
  week?: FeatureKind[]
}

export const CARD_W = 1080
export const CARD_H = 1350

const INK = '#2b2320'
const PAPER = '#f6efe0'
const COLOURS = { stone: '#9a948a', field: '#7bbf4a', spring: '#4aa3d8', channel: '#d9c39a', water: '#3d8fd1', rim: '#5a4632', bankSun: '#b98a55', bankShade: '#6e4b29', bed: '#4e3520' }

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
    // Plan item 61: every opening a ditch like the board's: a shaded and a lit slope (noon light from above), a
    // dark bed, and water in it where the river runs.
    const spokes: number[] = []
    for (let d = 0; d < 6; d++) if (c.solved & (1 << d)) spokes.push((Math.PI / 180) * 60 * d)
    const along = (a: number, off: number, colour: string, width: number) => {
      const nx = -Math.sin(a) * off
      const ny = Math.cos(a) * off
      ctx.strokeStyle = colour
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x + nx, y + ny)
      ctx.lineTo(x + Math.cos(a) * s * 0.86 + nx, y + Math.sin(a) * s * 0.86 + ny)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
    for (const a of spokes) {
      along(a, s * 0.055, Math.cos(a) * -0.2 + Math.sin(a) * -0.98 < 0 ? COLOURS.bankSun : COLOURS.bankShade, s * 0.11)
      along(a, -s * 0.055, Math.cos(a) * -0.2 + Math.sin(a) * -0.98 < 0 ? COLOURS.bankShade : COLOURS.bankSun, s * 0.11)
      along(a, 0, COLOURS.bed, s * 0.065)
    }
    ctx.lineCap = 'round'
    ctx.fillStyle = COLOURS.bed
    ctx.beginPath()
    ctx.arc(x, y, s * 0.13, 0, Math.PI * 2)
    ctx.fill()
    if (flow.wet.has(i)) for (const a of spokes) along(a, 0, COLOURS.water, s * 0.09)
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
  if (result.week?.length) drawWeek(ctx, result.week)
  ctx.fillStyle = INK
  ctx.font = '600 34px Georgia, serif'
  ctx.fillText('cathnivore.com/runnel', CARD_W / 2, CARD_H - 70)
}

/** Plan item 142: the week's keeps along the meadow, in the order the days came, each on a 90 px spot. */
function drawWeek(ctx: CardContext, week: readonly FeatureKind[]): void {
  const step = 110
  const x0 = CARD_W / 2 - ((week.length - 1) * step) / 2
  const base = CARD_H - 120
  const line = (pts: Array<[number, number]>, colour: string, w: number) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = w
    ctx.beginPath()
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  }
  const dot = (x: number, y: number, r: number, colour: string) => {
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.lineCap = 'round'
  week.forEach((kind, i) => {
    const x = x0 + i * step
    if (kind === 'mill') {
      ctx.fillStyle = '#f1e4cc'
      ctx.fillRect(x - 10, base - 44, 20, 44)
      line([[x - 22, base - 66], [x + 22, base - 26]], INK, 4)
      line([[x + 22, base - 66], [x - 22, base - 26]], INK, 4)
      dot(x, base - 46, 4, INK)
    } else if (kind === 'footbridge') {
      ctx.strokeStyle = '#8a5a32'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(x, base + 18, 40, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      line([[x - 40, base + 4], [x + 40, base + 4]], '#5f9ab0', 6)
    } else if (kind === 'orchard') {
      for (const dx of [-26, 0, 26]) {
        line([[x + dx, base], [x + dx, base - 16]], '#6b4a2b', 5)
        dot(x + dx, base - 26, 13, '#6f9a45')
        dot(x + dx - 4, base - 27, 3, '#c8402e')
      }
    } else if (kind === 'scarecrow') {
      line([[x, base], [x, base - 56]], '#6b4a2b', 5)
      line([[x - 22, base - 40], [x + 22, base - 40]], '#6b4a2b', 5)
      ctx.fillStyle = '#5f7a3a'
      ctx.fillRect(x - 12, base - 40, 24, 22)
      dot(x, base - 60, 9, '#e8c88a')
    } else {
      ctx.fillStyle = '#a88763'
      ctx.fillRect(x - 34, base - 22, 68, 22)
      for (const dy of [-16, -9, -2]) line([[x - 30, base + dy], [x + 30, base + dy]], '#7d5f40', 2)
    }
  })
  ctx.lineCap = 'butt'
}
