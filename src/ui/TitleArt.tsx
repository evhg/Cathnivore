import { useMemo } from 'react'
import Map from './Map'
import { titleBoardState } from './titleBoard'
import { loadCampaign } from '../platform/storage'
import CathArt from './CathArt'
import { SCREEN_POSE } from '../../shared/cath/screenposes'

// The title screen's illustration: the real board (plan item 60), purely decorative (aria-hidden); every
// animation is CSS so reduced motion stills it.

/**
 * Plan item 60: the title opens on the real table. The game's own board (Map.tsx, read-only) on the market cloth,
 * laid from the player's campaign (titleBoard.ts), with Cath standing beside it, never over a hex.
 */
export default function TitleArt() {
  const completed = useMemo(() => loadCampaign().completed, [])
  const state = useMemo(() => titleBoardState(completed), [completed])
  return (
    <div className="title-art title-table" aria-hidden="true" data-free={Object.values(state.regions).filter((r) => r.liberated).length}>
      <div className="title-cath">
        <CathArt framing="half" expression="smirk" pose={SCREEN_POSE['cathnivore:title']} animate />
      </div>
      <div className="title-board">
        <Map state={state} />
      </div>
    </div>
  )
}
