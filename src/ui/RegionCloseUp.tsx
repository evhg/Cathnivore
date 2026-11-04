import { useId } from 'react'
import { REGIONS, regionType } from '../content/map'
import { PRODUCERS } from '../content/producers'
import type { GameState, ProducerId, RegionId, RegionType } from '../engine/types'
import { Buyout, Doubt, GAP_SCALE, GroundArt, HEX_R, Outlet, REGION_FILL, TerrainArt, hexPoints } from './Map'
import RegionGroundArt from './RegionGroundArt'
import { regionGround } from './regionGround'
import { useSheetDismiss } from './useSheetDismiss'

const TYPE_NAME: Record<RegionType, string> = { capital: 'The capital', pasture: 'Pasture', crop: 'Cropland', coast: 'Coast' }

/**
 * Plan item 109: on a phone, a region up close. Its hex at 300 px or more with its own ground, its pieces at
 * 32 px or more with their counts, and what is on it in words: who holds it, Hollowell's pieces and the
 * producers' stalls. Esc, a tap outside, a swipe down or Close returns to the board.
 */
export default function RegionCloseUp({ state, region, onClose }: { state: GameState; region: RegionId; onClose(): void }) {
  const sheetRef = useSheetDismiss(onClose, true)
  const uid = useId().replace(/:/g, '')
  const def = REGIONS[region]
  const r = state.regions[region]
  const type = regionType(state, region)
  const stalls = (Object.entries(r.stalls).filter(([, n]) => (n ?? 0) > 0) as [ProducerId, number][]).map(([id, n]) => ({ id, n }))
  const holder = r.liberated ? 'Freed: the co-op holds it' : r.outlets + r.buyouts > 0 ? 'Hollowell has its hooks in it' : 'Open ground'
  const pieces: Array<{ key: string; label: string; n: number; art: JSX.Element }> = [
    { key: 'outlet', label: r.outlets === 1 ? 'Outlet' : 'Outlets', n: r.outlets, art: <Outlet /> },
    { key: 'buyout', label: r.buyouts === 1 ? 'Buyout' : 'Buyouts', n: r.buyouts, art: <Buyout /> },
    { key: 'doubt', label: 'Doubt', n: r.doubt, art: <Doubt /> },
  ].filter((p) => p.n > 0)
  let touch: number | null = null
  return (
    <div className="sheet-overlay region-closeup-overlay" onClick={onClose}>
      <div
        className="sheet region-closeup"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${def.name} up close`}
        data-region={region}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => (touch = e.touches[0]?.clientY ?? null)}
        onTouchEnd={(e) => {
          const y = e.changedTouches[0]?.clientY
          if (touch !== null && y !== undefined && y - touch > 70) onClose()
          touch = null
        }}
      >
        <header>
          <div>
            <h2 className="region-closeup-name">{def.name}</h2>
            <p className="region-closeup-kind">{TYPE_NAME[type]} · {holder}</p>
          </div>
          <button onClick={onClose}>Close</button>
        </header>
        <svg className="region-closeup-hex" viewBox={`${-HEX_R - 4} ${-HEX_R - 4} ${HEX_R * 2 + 8} ${HEX_R * 2 + 8}`} aria-hidden="true">
          <polygon points={hexPoints(0, 0, HEX_R * GAP_SCALE)} fill={REGION_FILL[type]} stroke="var(--ink)" strokeWidth={3} />
          <GroundArt type={type} id={region} clip={`${uid}-cu`} />
          <RegionGroundArt marks={regionGround(region, type, [])} />
          <g className="terrain-art">
            <TerrainArt type={type} id={region} />
          </g>
          {/* Hollowell's pieces standing on the ground, each about 32 px across on a 320 px hex. */}
          {(() => {
            const row = pieces.flatMap((p) => Array.from({ length: Math.min(p.n, 4) }, (_, i) => ({ key: `${p.key}${i}`, art: p.art })))
            const step = 22
            const x0 = -((row.length - 1) * step) / 2
            return row.map((q, i) => (
              <g key={q.key} className="region-closeup-piece" transform={`translate(${x0 + i * step - 9}, 40) scale(1.5)`}>
                {q.art}
              </g>
            ))
          })()}
        </svg>
        <ul className="region-closeup-pieces" aria-label="On this region">
          {pieces.map((p) => (
            <li key={p.key} data-piece={p.key}>
              <svg viewBox="-1 -1 14 16" aria-hidden="true">{p.art}</svg>
              <span>
                <b>{p.n}</b> {p.label}
              </span>
            </li>
          ))}
          {stalls.map((s) => (
            <li key={s.id} data-piece="stall">
              <span className="region-closeup-stall" aria-hidden="true">{PRODUCERS[s.id].name.slice(0, 1)}</span>
              <span>
                <b>{s.n}</b> {s.n === 1 ? 'stall' : 'stalls'} of {PRODUCERS[s.id].name}
              </span>
            </li>
          ))}
          {r.lostLand > 0 && (
            <li data-piece="lost">
              <span className="region-closeup-lost" aria-hidden="true">×</span>
              <span>
                <b>{r.lostLand}</b> Lost Land
              </span>
            </li>
          )}
          {pieces.length + stalls.length === 0 && r.lostLand === 0 && <li className="region-closeup-empty">Nothing on it yet.</li>}
        </ul>
      </div>
    </div>
  )
}
