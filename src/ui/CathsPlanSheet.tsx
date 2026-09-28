import { SCHEMES_BY_ID } from '../content/schemes'
import { GoodwillIcon } from './icons/ResourceIcons'
import Tooltip from './Tooltip'
import type { GameState } from '../engine/types'

// SPEC 10.2 "Sheets ... Cath's Plan (3 Schemes)." Playing a Scheme may need picking a region, which the
// map's targeting mode already handles (SPEC 10.2); `onPlay` decides whether that scheme can be played
// as one action right now or needs the player to tap a glowing region next, and does either from here.
export default function CathsPlanSheet({
  state,
  canPlay,
  missingGoodwill,
  onPlay,
  onClose,
  inline,
}: {
  state: GameState
  canPlay: (schemeId: string) => boolean
  // ROADMAP 9 "clear disabled and why-not states": only unambiguous for a `targeting: 'none'` Scheme,
  // whose sole legality condition is Goodwill vs. cost (see Game.tsx's `disabledScheme`) — a 'required'/
  // 'optional' Scheme could be missing a legal region just as easily, so this returns `undefined` for
  // those and the sheet falls back to today's plain absence, same as before this session.
  missingGoodwill: (schemeId: string) => number | undefined
  onPlay: (schemeId: string) => void
  onClose(): void
  inline?: boolean
}) {
  const cards = (
    <ul className="card-list">
      {state.freeSchemePlays > 0 && (
        <li className="card-note">Cath&rsquo;s Plan grants a free Scheme play — no Goodwill needed this once.</li>
      )}
      {state.cathsPlan.map((id, slot) => {
        if (!id) return <li key={slot} className="card-empty" />
        const card = SCHEMES_BY_ID.get(id)
        if (!card) return null
        return (
          <li key={id} className="card-enter">
            <strong>{card.name}</strong> —{' '}
            <Tooltip term="Goodwill">
              <GoodwillIcon /> {card.cost} Goodwill
            </Tooltip>
            {/* SPEC 10.5: "All rules text is generated from card and rules data" — `card.text` is the
                plain-English effect, checked against the card's actual `effect` by tests/rules-text.test.ts.
                It was previously only shown in the Rules Reference, never here, so a player deciding whether
                to play a Scheme during play had no way to see what it does without leaving Cath's Plan sheet
                to search for it separately. Cath's own voice line stays as the flavour text below it. */}
            <p className="card-text">{card.text}</p>
            <p className="card-flavor">&ldquo;{card.line}&rdquo;</p>
            {canPlay(id) ? (
              <button onClick={() => onPlay(id)}>Play</button>
            ) : (
              missingGoodwill(id) !== undefined && <p className="card-why-not">Need {missingGoodwill(id)} more Goodwill</p>
            )}
          </li>
        )
      })}
    </ul>
  )

  // SPEC 10.3 desktop 3-column layout: same collapsed-by-default treatment as the Market sheet's inline
  // mode (see MarketSheet.tsx and DECISIONS.md) — a card's rules text and Cath's line only show once
  // expanded, cutting the right column's fixed height while the Play button stays outside the <details>.
  if (inline) {
    return (
      <div className="sheet-panel card-sheet">
        <h2>Cath&rsquo;s Plan</h2>
        <ul className="card-list card-list-collapsible">
          {state.freeSchemePlays > 0 && (
            <li className="card-note">Cath&rsquo;s Plan grants a free Scheme play — no Goodwill needed this once.</li>
          )}
          {state.cathsPlan.map((id, slot) => {
            if (!id) return <li key={slot} className="card-empty" />
            const card = SCHEMES_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id} className="card-enter card-row">
                <details>
                  <summary>
                    <strong>{card.name}</strong>
                  </summary>
                  <p className="card-text">{card.text}</p>
                  <p className="card-flavor">&ldquo;{card.line}&rdquo;</p>
                </details>
                {/* Sibling of <details>, not a descendant — see MarketSheet.tsx for why. */}
                <div className="card-cost-row">
                  <Tooltip term="Goodwill">
                    <GoodwillIcon /> {card.cost} Goodwill
                  </Tooltip>
                </div>
                {canPlay(id) ? (
                  <button onClick={() => onPlay(id)}>Play</button>
                ) : (
                  missingGoodwill(id) !== undefined && <p className="card-why-not">Need {missingGoodwill(id)} more Goodwill</p>
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
          <h2>Cath&rsquo;s Plan</h2>
          <button onClick={onClose}>Close</button>
        </header>
        {cards}
      </div>
    </div>
  )
}
