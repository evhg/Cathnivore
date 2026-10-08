import { useState } from 'react'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { MarksIcon } from './icons/ResourceIcons'
import CardTagIcon from './icons/CardTagIcon'
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
  missingMarks,
  onBuy,
  onClose,
  inline,
}: {
  state: GameState
  canBuy: (cardId: string) => boolean
  // ROADMAP 9 "clear disabled and why-not states": Invest's only legality condition is Marks vs. cost
  // (see Game.tsx's `disabledInvest`), so a card the sheet can't offer a Buy button for can always say
  // exactly how many more Marks it needs, the same unambiguous reason the main action panel shows.
  // Returns `undefined` when the card is already buyable (or the gap isn't Marks-shaped, e.g. a gated
  // tutorial step or another producer's turn — Game.tsx's `missingMarks` already accounts for those).
  missingMarks: (cardId: string) => number | undefined
  onBuy: (cardId: string) => void
  onClose(): void
  inline?: boolean
}) {
  // ROADMAP 17: a bought card lifts and fades ("card-buying") before the engine swaps it out of the
  // Market; with reduced motion the purchase is immediate.
  const [buying, setBuying] = useState<string | null>(null)
  const buy = (id: string) => {
    if (buying) return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onBuy(id)
      return
    }
    setBuying(id)
    setTimeout(() => {
      setBuying(null)
      onBuy(id)
    }, 260)
  }
  const cards = (
    <ul className="card-list">
      {state.market.map((id, slot) => {
        if (!id) return <li key={slot} className="card-empty" />
        const card = IMPROVEMENTS_BY_ID.get(id)
        if (!card) return null
        return (
          <li key={id} className={`card-enter card-framed${buying === id ? ' card-buying' : ''}`} data-tag={card.tags[0]}>
            <CardTagIcon tag={card.tags[0]} /> <strong>{card.name}</strong> —{' '}
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
            {canBuy(id) ? (
              <button onClick={() => buy(id)}>Buy</button>
            ) : (
              missingMarks(id) !== undefined && <p className="card-why-not">Need {missingMarks(id)} more {missingMarks(id) === 1 ? "Mark" : "Marks"}</p>
            )}
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
              <li key={id} className={`card-enter card-row card-framed${buying === id ? ' card-buying' : ''}`} data-tag={card.tags[0]}>
                <details>
                  <summary>
                    <CardTagIcon tag={card.tags[0]} /> <strong>{card.name}</strong>
                    <span className="card-tags">{card.tags.map((t) => TAG_LABEL[t]).join(', ')}</span>
                  </summary>
                  <p className="card-text">{card.text}</p>
                  {card.flavor && <p className="card-flavor">{card.flavor}</p>}
                </details>
                {/* A sibling of <details>, not a descendant: Chromium hides every non-<summary> child of a
                    closed <details> (via an internal `::details-content` wrapper CSS can't carve one child
                    out of), so the cost has to live outside <details> entirely to stay visible while
                    collapsed. `.card-row`'s flex layout (global.css) puts it back on the same line as the
                    summary above. Also sidesteps axe's no-focusable-content rule (SPEC 11.4 gate 6), which
                    forbids a focusable Tooltip button inside <summary> itself. */}
                <div className="card-cost-row">
                  <Tooltip term="Marks">
                    <MarksIcon /> {card.cost} Marks
                  </Tooltip>
                </div>
                {canBuy(id) ? (
                  <button onClick={() => buy(id)}>Buy</button>
                ) : (
                  missingMarks(id) !== undefined && <p className="card-why-not">Need {missingMarks(id)} more {missingMarks(id) === 1 ? "Mark" : "Marks"}</p>
                )}
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
