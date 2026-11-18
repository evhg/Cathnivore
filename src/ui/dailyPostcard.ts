// Plan item 484: a Daily Market ends with a postcard to share, not just a line of text. A 1200x630 card drawn to a
// canvas: the final board (the game's own layout, freed land in its colour, held land in item 417's grey), Daily
// #N, the market event, Trust and rounds, the streak's pennants and Cath's one-line verdict. Tokens and the loaded
// fonts only; nothing is fetched.
import { MARKET_EVENTS } from '../engine/marketEvent'
import { LAYOUTS, placedLayout } from '../content/layouts'
import { REGIONS, regionType } from '../content/map'
import type { GameState, RegionId, RegionType } from '../engine/types'

export const POSTCARD_W = 1200
export const POSTCARD_H = 630

export interface PostcardHex {
  id: RegionId
  name: string
  /** Centre in hex-radius units (pointy-top axial layout). */
  x: number
  y: number
  type: RegionType
  freed: boolean
}

export interface PostcardData {
  number: number
  /** The Daily's date, YYYY-MM-DD (the postmark), or null. */
  date: string | null
  layoutName: string
  event: string | null
  won: boolean
  rounds: number
  regions: number
  trust: number
  streak: number
  grade: string
  verdict: string
  hexes: PostcardHex[]
}

/** Cath's verdict on the day, by the result and the streak. */
export function postcardVerdict(won: boolean, streak: number, trust: number): string {
  if (!won) return streak > 0 ? 'Marrow held out today. Same stall tomorrow.' : 'They held the market today. We go again tomorrow.'
  if (streak >= 7) return `A week of market days. Hollowell is writing memos about us.`
  if (streak >= 3) return `${streak} days running. The square knows our names.`
  return trust >= 5 ? 'A good day at the market. Everyone went home fed.' : 'We won it by a whisker. I need a cup of tea.'
}

export function postcardData(state: GameState, daily: { number: number; streak: number; layoutName: string }, grade: string): PostcardData {
  const result = state.result!
  const layout = placedLayout(state.config.layout ?? 'ring', state.config.placement)
  // The board's own placement, as Map.tsx draws it: the game's active regions, each at its layout's hex (a region
  // the placed layout doesn't list falls back to its ring hex, as the board's hexCenter does).
  const hexes = state.config.activeRegions
    .filter((id) => state.regions[id])
    .map((id) => {
      const [q, r] = layout.hexes[id] ?? LAYOUTS.ring.hexes[id] ?? [0, 0]
      return { id, name: REGIONS[id].name, x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r, type: regionType(state, id), freed: !!state.regions[id]?.liberated }
    })
  const ev = state.config.marketEvent
  return {
    number: daily.number,
    date: state.config.daily ?? null,
    layoutName: daily.layoutName,
    event: ev ? MARKET_EVENTS[ev].name : null,
    won: result.won,
    rounds: result.round,
    regions: result.regionsLiberated,
    trust: state.publicTrust,
    streak: daily.streak,
    grade,
    verdict: postcardVerdict(result.won, daily.streak, state.publicTrust),
    hexes,
  }
}

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

/** Draws the postcard onto `canvas` (sized 1200x630). `cath` is her portrait, already loaded, or null. */
export function drawPostcard(canvas: HTMLCanvasElement, d: PostcardData, cath: HTMLImageElement | null): void {
  canvas.width = POSTCARD_W
  canvas.height = POSTCARD_H
  const g = canvas.getContext('2d')
  if (!g) return
  const paper = css('--paper-on-fixed-fill', '#f6efe2')
  const ink = css('--ink-on-fixed-fill', '#2b2118')
  const wood = css('--wood', '#8a5a34')
  const clay = css('--clay', '#c0603c')
  const pasture = css('--pasture', '#5f8a3c')
  const display = css('--font-display', 'Georgia, serif')
  const text = css('--font-text', 'system-ui, sans-serif')
  // the card: cream paper in a wooden frame, a stamp-dashed inner border
  g.fillStyle = wood
  g.fillRect(0, 0, POSTCARD_W, POSTCARD_H)
  g.fillStyle = paper
  g.fillRect(18, 18, POSTCARD_W - 36, POSTCARD_H - 36)
  g.strokeStyle = wood
  g.setLineDash([10, 6])
  g.lineWidth = 2
  g.strokeRect(34, 34, POSTCARD_W - 68, POSTCARD_H - 68)
  g.setLineDash([])
  // the board on the left half
  const fills: Record<RegionType, string> = {
    pasture: css('--region-pasture', '#9cc27a'),
    crop: css('--region-crop', '#e2c26b'),
    coast: css('--region-coast', '#9cc6d6'),
    capital: css('--region-capital', '#d9a77d'),
  }
  // held land in item 417's tarmac grey
  const held = css('--held-ground', '#9a9a96')
  const edge = css('--wood-dark', '#5e3b22')
  const xs = d.hexes.map((h) => h.x)
  const ys = d.hexes.map((h) => h.y)
  const span = Math.max(Math.max(...xs) - Math.min(...xs) + Math.sqrt(3), (Math.max(...ys) - Math.min(...ys) + 2) * 1.05)
  const R = Math.min(140, 470 / span)
  const ox = 70 + 470 / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * R
  const oy = POSTCARD_H / 2 - 8 - ((Math.max(...ys) + Math.min(...ys)) / 2) * R
  const hexPath = (cx: number, cy: number, r: number) => {
    g.beginPath()
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3
      if (k) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    g.closePath()
  }
  // The board's tiles, as the game prints them (Map.tsx, plan item 20): each a thick tile whose edge shows under
  // its face, on a soft shadow. Drawn back to front so a nearer tile's edge never paints over a farther face.
  const depth = Math.max(5, R * 0.1)
  const order = [...d.hexes].sort((a, b) => a.y - b.y || a.x - b.x)
  g.save()
  g.shadowColor = 'rgba(43, 33, 24, 0.28)'
  g.shadowBlur = 18
  g.shadowOffsetY = 10
  g.fillStyle = edge
  for (const h of order) {
    hexPath(ox + h.x * R, oy + h.y * R + depth, R * 0.95)
    g.fill()
  }
  g.restore()
  for (const h of order) {
    const cx = ox + h.x * R
    const cy = oy + h.y * R
    hexPath(cx, cy + depth, R * 0.95)
    g.fillStyle = edge
    g.fill()
    g.lineWidth = 2.5
    g.strokeStyle = ink
    g.stroke()
    hexPath(cx, cy, R * 0.95)
    g.fillStyle = h.freed ? fills[h.type] : held
    g.fill()
    g.stroke()
    // a lighter inner bevel, so the face reads as a raised tile
    hexPath(cx, cy, R * 0.86)
    g.lineWidth = 2
    g.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    g.stroke()
    // the region's name along its top
    g.fillStyle = ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `700 ${Math.round(Math.max(13, R * 0.17))}px ${text}`
    g.fillText(h.name, cx, cy - R * 0.5, R * 1.5)
    if (h.freed) {
      // the market's pennant on a pole, planted on every freed region
      const top = cy - R * 0.28
      g.strokeStyle = ink
      g.lineWidth = Math.max(2, R * 0.035)
      g.beginPath()
      g.moveTo(cx - R * 0.12, cy + R * 0.42)
      g.lineTo(cx - R * 0.12, top)
      g.stroke()
      g.fillStyle = clay
      g.beginPath()
      g.moveTo(cx - R * 0.12, top)
      g.lineTo(cx + R * 0.34, top + R * 0.13)
      g.lineTo(cx - R * 0.12, top + R * 0.26)
      g.closePath()
      g.fill()
      g.lineWidth = 2
      g.stroke()
    }
  }
  g.textAlign = 'left'
  // A Marrow postmark, dated, in the top right corner, with its wavy cancellation lines.
  if (d.date) {
    const px = POSTCARD_W - 156
    const py = 112
    g.strokeStyle = clay
    g.globalAlpha = 0.8
    g.lineWidth = 3
    g.beginPath()
    g.arc(px, py, 58, 0, Math.PI * 2)
    g.stroke()
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(px, py, 50, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = clay
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const [day, year] = postmarkDate(d.date).split(/ (?=\d{4}$)/)
    g.font = `700 14px ${text}`
    g.fillText('MARROW', px, py - 27)
    g.font = `700 21px ${text}`
    g.fillText(day!, px, py - 3)
    g.font = `700 16px ${text}`
    g.fillText(year!, px, py + 18)
    g.font = `700 10px ${text}`
    g.fillText('MARKET DAY', px, py + 36)
    g.lineWidth = 2.5
    for (let i = 0; i < 3; i++) {
      g.beginPath()
      for (let x = 0; x <= 48; x += 3) {
        const y = py - 18 + i * 18 + Math.sin(x / 9) * 4
        if (x) g.lineTo(px + 64 + x, y)
        else g.moveTo(px + 64 + x, y)
      }
      g.stroke()
    }
    g.globalAlpha = 1
    g.textAlign = 'left'
  }
  g.textBaseline = 'alphabetic'
  // the words on the right half
  const x0 = 640
  g.fillStyle = ink
  g.textBaseline = 'alphabetic'
  g.font = `700 22px ${text}`
  g.fillText('CATHNIVORE · DAILY MARKET', x0, 86)
  g.font = `italic 700 104px ${display}`
  g.fillText(`#${d.number}`, x0, 184)
  g.font = `600 26px ${text}`
  g.fillText([d.layoutName, d.event].filter(Boolean).join(' · '), x0, 226)
  g.font = `700 40px ${display}`
  g.fillStyle = d.won ? pasture : clay
  g.fillText(d.won ? `Liberated in ${d.rounds} rounds` : `Held out to round ${d.rounds}`, x0, 290)
  g.fillStyle = ink
  g.font = `600 28px ${text}`
  g.fillText(`${d.regions} regions free · Trust ${d.trust} · grade ${d.grade}`, x0, 332)
  // the streak's pennants (at most 10 drawn)
  const n = Math.min(10, d.streak)
  if (n) {
    // the bunting's cord, sagging a little between its ends
    g.strokeStyle = ink
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(x0 - 6, 360)
    g.quadraticCurveTo(x0 + n * 21, 366, x0 + n * 42 + 2, 360)
    g.stroke()
  }
  for (let i = 0; i < n; i++) {
    g.fillStyle = [clay, css('--wheat', '#e2b84a'), pasture][i % 3]!
    g.beginPath()
    g.moveTo(x0 + i * 42, 362)
    g.lineTo(x0 + i * 42 + 34, 362)
    g.lineTo(x0 + i * 42 + 17, 400)
    g.closePath()
    g.fill()
  }
  g.fillStyle = ink
  g.font = `600 22px ${text}`
  g.fillText(d.streak > 0 ? `${d.streak} in a row` : 'A new streak starts tomorrow', x0, n ? 428 : 386)
  // Cath's verdict, with her face
  if (cath) g.drawImage(cath, x0 - 14, 446, 140, 140)
  g.font = `italic 500 28px ${display}`
  wrap(g, `“${d.verdict}”`, x0 + (cath ? 136 : 0), 506, POSTCARD_W - 70 - (x0 + (cath ? 136 : 0)), 34)
}

function wrap(g: CanvasRenderingContext2D, s: string, x: number, y: number, w: number, lh: number): void {
  let line = ''
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > w && line) {
      g.fillText(line, x, y)
      line = word
      y += lh
    } else line = next
  }
  if (line) g.fillText(line, x, y)
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
/** '2026-11-18' as the postmark prints it: '18 NOV 2026'. */
export function postmarkDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`
}
