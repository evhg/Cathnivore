import { useId } from 'react'
import { LAYOUTS, layoutTypes, type LayoutId } from '../content/layouts'
import { REGIONS } from '../content/map'
import type { RegionId } from '../engine/types'
import { GAP_SCALE, GroundArt, HEX_R, REGION_FILL, TerrainArt, hexPoints } from './Map'
import RegionGroundArt from './RegionGroundArt'
import { regionGround } from './regionGround'

// Plan item 101: a map on the Setup as a miniature of the real board, drawn from the layout's data with the
// board's own tile art (each region's fill, ground, marks and terrain), the Delta's river channels and its two
// bridges. `named` writes each region's name on its tile, for the picked map. Decorative: the radio's label
// names the map.

const W = HEX_R * Math.sqrt(3)

function centre([q, r]: [number, number]) {
  return { x: W * (q + r / 2), y: HEX_R * 1.5 * r }
}

export default function BoardMiniature({ id, named = false, className }: { id: LayoutId; named?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const layout = LAYOUTS[id]
  const types = layoutTypes(layout)
  const hexes = (Object.entries(layout.hexes) as [RegionId, [number, number]][]).map(([rid, qr]) => ({ rid, ...centre(qr) }))
  const xs = hexes.map((h) => h.x)
  const ys = hexes.map((h) => h.y)
  const pad = 6
  const x0 = Math.min(...xs) - W / 2 - pad
  const y0 = Math.min(...ys) - HEX_R - pad
  const vw = Math.max(...xs) - Math.min(...xs) + W + 2 * pad
  const vh = Math.max(...ys) - Math.min(...ys) + 2 * HEX_R + 2 * pad
  const at = new Map(hexes.map((h) => [h.rid, h]))
  const edge = (a: RegionId, b: RegionId) => {
    const p = at.get(a)!
    const q = at.get(b)!
    const mx = (p.x + q.x) / 2
    const my = (p.y + q.y) / 2
    const dx = q.x - p.x
    const dy = q.y - p.y
    const len = Math.hypot(dx, dy)
    const half = HEX_R / 2
    return { mx, my, px: (-dy / len) * half, py: (dx / len) * half, ux: dx / len, uy: dy / len }
  }
  return (
    <svg className={`board-mini${className ? ` ${className}` : ''}`} viewBox={`${x0} ${y0} ${vw} ${vh}`} aria-hidden="true" data-regions={hexes.length} data-layout={id}>
      {hexes.map((h) => {
        const type = types[h.rid] ?? REGIONS[h.rid].type
        return (
          <g key={h.rid} data-region={h.rid}>
            <polygon points={hexPoints(h.x, h.y, HEX_R * GAP_SCALE)} fill={REGION_FILL[type]} stroke="var(--ink)" strokeWidth={5} />
            <g transform={`translate(${h.x}, ${h.y})`}>
              <GroundArt type={type} id={h.rid} clip={`${uid}-g-${h.rid}`} />
              <RegionGroundArt marks={regionGround(h.rid, type, [])} />
              <g className="terrain-art">
                <TerrainArt type={type} id={h.rid} />
              </g>
            </g>
          </g>
        )
      })}
      {layout.channels?.map(([a, b]) => {
        const e = edge(a, b)
        return (
          <line
            key={`c-${a}-${b}`}
            className="board-mini-river"
            x1={e.mx - e.px * 1.08}
            y1={e.my - e.py * 1.08}
            x2={e.mx + e.px * 1.08}
            y2={e.my + e.py * 1.08}
            stroke="var(--sea)"
            strokeWidth={16}
            strokeLinecap="round"
          />
        )
      })}
      {layout.bridges?.map(([a, b]) => {
        const e = edge(a, b)
        const bx = e.ux * 22
        const by = e.uy * 22
        return (
          <line
            key={`b-${a}-${b}`}
            className="board-mini-bridge"
            x1={e.mx - bx}
            y1={e.my - by}
            x2={e.mx + bx}
            y2={e.my + by}
            stroke="var(--clay)"
            strokeWidth={18}
            strokeLinecap="butt"
          />
        )
      })}
      {named &&
        hexes.map((h) => (
          <text key={`n-${h.rid}`} className="board-mini-name" x={h.x} y={h.y + 10} textAnchor="middle">
            {REGIONS[h.rid].name}
          </text>
        ))}
    </svg>
  )
}
