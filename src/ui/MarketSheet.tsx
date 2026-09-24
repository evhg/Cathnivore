import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import type { GameState } from '../engine/types'

const TAG_LABEL: Record<string, string> = { pasture: 'Pasture', crop: 'Crop', coast: 'Coast', community: 'Community', media: 'Media', science: 'Science' }

// SPEC 10.2 "Sheets ... Market (4 Improvements)." `canBuy(cardId)` tells us whether the active human
// producer has a legal Invest action for that card right now (Invest never targets a region, so at most
// one such action exists per card); `onBuy` runs it via `Game.tsx`'s own `act()`, keeping this component
// free of the engine call itself.
export default function MarketSheet({
  state,
  canBuy,
  onBuy,
  onClose,
}: {
  state: GameState
  canBuy: (cardId: string) => boolean
  onBuy: (cardId: string) => void
  onClose(): void
}) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet card-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Market</h2>
          <button onClick={onClose}>Close</button>
        </header>
        <ul className="card-list">
          {state.market.map((id, slot) => {
            if (!id) return <li key={slot} className="card-empty" />
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id}>
                <strong>{card.name}</strong> — {card.cost} Marks ({card.tags.map((t) => TAG_LABEL[t]).join(', ')})
                {card.flavor && <p className="card-flavor">{card.flavor}</p>}
                {canBuy(id) && <button onClick={() => onBuy(id)}>Buy</button>}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
