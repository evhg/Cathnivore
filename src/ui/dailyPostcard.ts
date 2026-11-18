// Plan item 484: a Daily Market ends with a postcard to share, not just a line of text. A 1200x630 card drawn to a
// canvas: the final board (the game's own layout, freed land in its colour, held land in item 417's grey), Daily
// #N, the market event, Trust and rounds, the streak's pennants and Cath's one-line verdict. Tokens and the loaded
// fonts only; nothing is fetched.
import { MARKET_EVENTS } from '../engine/marketEvent'
import { placedLayout } from '../content/layouts'
import { regionType } from '../content/map'
import type { GameState, RegionId, RegionType } from '../engine/types'

export const POSTCARD_W = 1200
export const POSTCARD_H = 630

export interface PostcardHex {
  id: RegionId
  /** Centre in hex-radius units (pointy-top axial layout). */
  x: number
  y: number
  type: RegionType
  freed: boolean
}

export interface PostcardData {
  number: number
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
  const hexes = (Object.entries(layout.hexes) as [RegionId, [number, number]][])
    .filter(([id]) => state.regions[id])
    .map(([id, [q, r]]) => ({ id, x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r, type: regionType(state, id), freed: !!state.regions[id]?.liberated }))
  const ev = state.config.marketEvent
  return {
    number: daily.number,
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
  const xs = d.hexes.map((h) => h.x)
  const ys = d.hexes.map((h) => h.y)
  const span = Math.max(Math.max(...xs) - Math.min(...xs) + Math.sqrt(3), (Math.max(...ys) - Math.min(...ys) + 2) * 1.05)
  const R = Math.min(140, 470 / span)
  const ox = 70 + 470 / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * R
  const oy = POSTCARD_H / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * R
  for (const h of d.hexes) {
    const cx = ox + h.x * R
    const cy = oy + h.y * R
    g.beginPath()
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3
      const px = cx + Math.cos(a) * R * 0.95
      const py = cy + Math.sin(a) * R * 0.95
      if (k) g.lineTo(px, py)
      else g.moveTo(px, py)
    }
    g.closePath()
    g.fillStyle = h.freed ? fills[h.type] : held
    g.fill()
    g.lineWidth = 3
    g.strokeStyle = ink
    g.stroke()
    if (h.freed) {
      // a little bunting flag on every freed region
      g.fillStyle = pasture
      g.beginPath()
      g.moveTo(cx - R * 0.22, cy - R * 0.1)
      g.lineTo(cx + R * 0.22, cy - R * 0.1)
      g.lineTo(cx, cy + R * 0.22)
      g.closePath()
      g.fill()
    }
  }
  // the words on the right half
  const x0 = 640
  g.fillStyle = ink
  g.textBaseline = 'alphabetic'
  g.font = `700 22px ${text}`
  g.fillText('CATHNIVORE · DAILY MARKET', x0, 96)
  g.font = `italic 700 104px ${display}`
  g.fillText(`#${d.number}`, x0, 200)
  g.font = `600 26px ${text}`
  g.fillText([d.layoutName, d.event].filter(Boolean).join(' · '), x0, 244)
  g.font = `700 40px ${display}`
  g.fillStyle = d.won ? pasture : clay
  g.fillText(d.won ? `Liberated in ${d.rounds} rounds` : `Held out to round ${d.rounds}`, x0, 312)
  g.fillStyle = ink
  g.font = `600 28px ${text}`
  g.fillText(`${d.regions} regions free · Trust ${d.trust} · grade ${d.grade}`, x0, 356)
  // the streak's pennants (at most 10 drawn)
  const n = Math.min(10, d.streak)
  for (let i = 0; i < n; i++) {
    g.fillStyle = [clay, css('--wheat', '#e2b84a'), pasture][i % 3]!
    g.beginPath()
    g.moveTo(x0 + i * 42, 392)
    g.lineTo(x0 + i * 42 + 34, 392)
    g.lineTo(x0 + i * 42 + 17, 430)
    g.closePath()
    g.fill()
  }
  g.fillStyle = ink
  g.font = `600 22px ${text}`
  g.fillText(d.streak > 0 ? `${d.streak} in a row` : 'A new streak starts tomorrow', x0, n ? 462 : 420)
  // Cath's verdict, with her face
  if (cath) g.drawImage(cath, x0 - 8, 476, 104, 104)
  g.font = `italic 500 26px ${display}`
  wrap(g, `“${d.verdict}”`, x0 + (cath ? 108 : 0), 520, POSTCARD_W - 70 - (x0 + (cath ? 108 : 0)), 32)
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
