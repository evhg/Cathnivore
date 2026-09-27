import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { MarksIcon } from './icons/ResourceIcons'
import Tooltip from './Tooltip'
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
  inline,
}: {
  state: GameState
  canBuy: (cardId: string) => boolean
  onBuy: (cardId: string) => void
  onClose(): void
  inline?: boolean
}) {
  const cards = (
    <ul className="card-list">
      {state.market.map((id, slot) => {
        if (!id) return <li key={slot} className="card-empty" />
        const card = IMPROVEMENTS_BY_ID.get(id)
        if (!card) return null
        return (
          <li key={id} className="card-enter">
            <strong>{card.name}</strong> —{' '}
            <Tooltip term="Marks">
              <MarksIcon /> {card.cost} Marks
            </Tooltip>{' '}
            ({card.tags.map((t) => TAG_LABEL[t]).join(', ')})
            {/* SPEC 10.5: "All rules text is generated from card and rules data" — `card.text` is the
                plain-English effect (STYLE.md 8: "rules text in Atkinson Hyperlegible"), checked against
                the card's actual `onBuy` by tests/rules-text.test.ts. It was previously only shown in the
                Rules Reference, never here, so a player deciding whether to buy a card during play had no
                way to see what it does without leaving the Market sheet to search for it separately. */}
            <p className="card-text">{card.text}</p>
            {card.flavor && <p className="card-flavor">{card.flavor}</p>}
            {canBuy(id) && <button onClick={() => onBuy(id)}>Buy</button>}
          </li>
        )
      })}
    </ul>
  )

  // SPEC 10.3 desktop 3-column layout: the same cards, collapsed to name/cost by default (a native
  // <details> per card, no extra JS state) so the right column's fixed height doesn't have to fit every
  // card's rules text and flavour line at once — see DECISIONS.md for why prior CSS-only squeezes on this
  // column couldn't close the SPEC 10.3 "no scrolling at 1280x800" gap on their own. The Buy button stays
  // outside the <details> so buying never requires expanding a card first.
  if (inline) {
    return (
      <div className="sheet-panel card-sheet">
        <h2>Market</h2>
        <ul className="card-list card-list-collapsible">
          {state.market.map((id, slot) => {
            if (!id) return <li key={slot} className="card-empty" />
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id} className="card-enter">
                <details>
                  <summary>
                    <strong>{card.name}</strong> —{' '}
                    <Tooltip term="Marks">
                      <MarksIcon /> {card.cost} Marks
                    </Tooltip>{' '}
                    ({card.tags.map((t) => TAG_LABEL[t]).join(', ')})
                  </summary>
                  <p className="card-text">{card.text}</p>
                  {card.flavor && <p className="card-flavor">{card.flavor}</p>}
                </details>
                {canBuy(id) && <button onClick={() => onBuy(id)}>Buy</button>}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet card-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Market</h2>
          <button onClick={onClose}>Close</button>
        </header>
        {cards}
      </div>
    </div>
  )
}
