import { SCHEMES_BY_ID } from '../content/schemes'
import type { GameState } from '../engine/types'

// SPEC 10.2 "Sheets ... Cath's Plan (3 Schemes)." Playing a Scheme may need picking a region, which the
// map's targeting mode already handles (SPEC 10.2); `onPlay` decides whether that scheme can be played
// as one action right now or needs the player to tap a glowing region next, and does either from here.
export default function CathsPlanSheet({
  state,
  canPlay,
  onPlay,
  onClose,
}: {
  state: GameState
  canPlay: (schemeId: string) => boolean
  onPlay: (schemeId: string) => void
  onClose(): void
}) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet card-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Cath&rsquo;s Plan</h2>
          <button onClick={onClose}>Close</button>
        </header>
        <ul className="card-list">
          {state.cathsPlan.map((id, slot) => {
            if (!id) return <li key={slot} className="card-empty" />
            const card = SCHEMES_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id}>
                <strong>{card.name}</strong> — {card.cost} Goodwill
                <p className="card-flavor">&ldquo;{card.line}&rdquo;</p>
                {canPlay(id) && <button onClick={() => onPlay(id)}>Play</button>}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
