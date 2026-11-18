// Plan item 490: on the Setup a producer's power plays out before you pick: their real board moment (item 189's
// `AbilityMoment`: Mara's gavel, Tomas's awning, Ines striking a Doubt, Sol's radio rings) on a tile of their home
// region, in place of their portrait for a moment. Decorative: the card's own text and label name the power.
import { useEffect, useId, useState } from 'react'
import { PRODUCERS } from '../content/producers'
import { REGIONS } from '../content/map'
import type { ProducerId } from '../engine/types'
import AbilityMoment from './AbilityMoment'
import { GAP_SCALE, GroundArt, HEX_R, REGION_FILL, TerrainArt, hexPoints } from './Map'

/** How long the tile stands in for the portrait: the moment's 1.1 s run and a beat to read its last frame. */
export const ABILITY_PREVIEW_MS = 1700

export default function AbilityPreview({ producer, n }: { producer: ProducerId; n: number }) {
  const uid = useId().replace(/:/g, '')
  const region = PRODUCERS[producer].home
  const type = REGIONS[region].type
  const r = HEX_R * GAP_SCALE
  const pad = r * 0.12
  // `data-played` is set once the moment has mounted and started, so a check can tell a stage that ran from one that didn't
  const [played, setPlayed] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPlayed(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <span className="ability-preview" data-ability-preview={producer} data-played={played ? '' : undefined} aria-hidden="true">
      <svg viewBox={`${-r - pad} ${-r - pad} ${2 * (r + pad)} ${2 * (r + pad)}`}>
        <polygon points={hexPoints(0, 0, r)} fill={REGION_FILL[type]} stroke="var(--ink)" strokeWidth={5} />
        <GroundArt type={type} id={region} clip={`${uid}-g`} />
        <g className="terrain-art">
          <TerrainArt type={type} id={region} />
        </g>
        <AbilityMoment view={{ producer, region, key: n }} x={0} y={0} r={r} />
      </svg>
    </span>
  )
}
