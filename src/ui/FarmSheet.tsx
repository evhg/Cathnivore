import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { useSheetDismiss } from './useSheetDismiss'
import { PRODUCERS } from '../content/producers'
import { GoodwillIcon, MarksIcon, ProduceIcon } from './icons/ResourceIcons'
import Tooltip from './Tooltip'
import Portrait from './portraits/Portrait'
import Vignette from './Vignette'
import { vignetteFor } from './vignetteKind'
import type { GameState, ProducerId } from '../engine/types'

const TAG_LABEL = { pasture: 'Pasture', crop: 'Crop', coast: 'Coast', community: 'Community', media: 'Media', science: 'Science' }

// SPEC 10.2 "Sheets ... Farm (tableau and tag counts)." Shows every producer (SPEC 6: 1 in campaign
// chapters 1-3, 2 in a full game) so either can check the other's tableau, not just the active one.
// `inline` (SPEC 10.3 desktop 3-column layout) renders the panel content directly in the page flow
// instead of as a phone-sized modal overlay — the same data, just without the overlay/Close chrome.
export default function FarmSheet({ state, onClose, inline }: { state: GameState; onClose(): void; inline?: boolean }) {
  const sheetRef = useSheetDismiss(onClose, !inline)
  if (inline) {
    return (
      <section className="farm-sheet farm-inline" aria-labelledby="farm-inline-title">
        <h2 className="farm-inline-title" id="farm-inline-title">Farm</h2>
        {/* Plan item 33: the active producer's row is only her name until she buys something (the card
            above names her and carries her figures), and that empty row pushed the Actions frame down
            far enough to cut the Invest cards at 1440x900. */}
        {state.config.producers
          .filter((id) => !(id === state.activeProducer && state.config.producers.length > 1 && state.producers[id].improvements.length === 0))
          .map((id) => (
            <FarmColumn key={id} state={state} producer={id} hideSummary={state.config.producers.length === 1} compact />
          ))}
        {state.config.producers.every((id) => state.producers[id].improvements.length === 0) && (
          <p className="farm-empty">No Improvements bought yet.</p>
        )}
      </section>
    )
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet farm-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="Farm" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Farm</h2>
          <button onClick={onClose}>Close</button>
        </header>
        {state.config.producers.map((id) => (
          <FarmColumn key={id} state={state} producer={id} />
        ))}
      </div>
    </div>
  )
}

// `hideSummary`: the desktop top-left card already shows a lone producer's name and stats (ROADMAP 169).
function FarmColumn({ state, producer, hideSummary, compact }: { state: GameState; producer: ProducerId; hideSummary?: boolean; compact?: boolean }) {
  const p = state.producers[producer]
  const def = PRODUCERS[producer]
  const tagCounts: Partial<Record<string, number>> = {}
  for (const id of p.improvements) {
    for (const tag of IMPROVEMENTS_BY_ID.get(id)?.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  return (
    <section className={compact ? 'farm-column farm-column--compact' : 'farm-column'}>
      {!hideSummary && !compact ? (
        // Plan item 36: the producer at their farm gate, and a ribbon that sums what the farm makes.
        <div className="farmstead-gate">
          <span className={`producer-cameo pc-${producer}`}>
            <Portrait character={producer} size={56} />
          </span>
          <h3>{def.name}</h3>
        </div>
      ) : (
        !hideSummary && <h3>{def.name}</h3>
      )}
      {!compact && (
        <p className="farmstead-ribbon">
          <span>
            <ProduceIcon /> +{p.production.produce}
          </span>
          <span>
            <MarksIcon /> +{p.production.marks}
          </span>
          <span>
            <GoodwillIcon /> +{p.production.goodwill}
          </span>
          <span className="farmstead-ribbon-tail">each round</span>
          <span className="visually-hidden">
            : {p.production.produce} Produce, {p.production.marks} {p.production.marks === 1 ? 'Mark' : 'Marks'} and {p.production.goodwill} Goodwill each round
          </span>
        </p>
      )}
      {/* AAA UI M4: a list, not inline " · " joiners (they dangled once the items stacked). The desktop
          frame shows the same figures as compact chips, one line a producer. */}
      {/* compact: the active producer's figures are already on the chips just above */}
      {!hideSummary && !(compact && producer === state.activeProducer) && (
        <ul className="farm-production">
          <li>
            <Tooltip term="Produce">
              <ProduceIcon /> {compact ? <span className="num">{p.resources.produce}</span> : `Produce ${p.resources.produce}`}
              {compact && <span className="farm-income num"> +{p.production.produce}</span>}
              {compact && <span className="visually-hidden"> Produce, plus {p.production.produce} a round</span>}
            </Tooltip>
          </li>
          <li>
            <Tooltip term="Marks">
              <MarksIcon /> {compact ? <span className="num">{p.resources.marks}</span> : `Marks ${p.resources.marks}`}
              {compact && <span className="farm-income num"> +{p.production.marks}</span>}
              {compact && <span className="visually-hidden"> Marks, plus {p.production.marks} a round</span>}
            </Tooltip>
          </li>
          <li>
            <Tooltip term="Goodwill">
              <GoodwillIcon /> {compact ? <span className="num">{p.resources.goodwill}</span> : `Goodwill ${p.resources.goodwill}`}
              {compact && <span className="farm-income num"> +{p.production.goodwill}</span>}
              {compact && <span className="visually-hidden"> Goodwill, plus {p.production.goodwill} a round</span>}
            </Tooltip>
          </li>
        </ul>
      )}
      {p.improvements.length === 0 ? (
        !compact && <p className="farm-empty">{hideSummary || state.config.producers.length < 2 ? 'No Improvements bought yet.' : 'No Improvements yet.'}</p>
      ) : compact ? (
        // Plan item 36: the desktop Farm is a row of small drawn cards a producer, in a fixed-height
        // frame, so the Actions frame under it never moves as the farm grows.
        <ul className="farmstead-thumbs" aria-label={`${def.name}'s Improvements`}>
          {p.improvements.map((id) => {
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id} className="farmstead-thumb" data-tag={card.tags[0]} data-card={id} title={`${card.name}: ${card.text}`}>
                <Vignette kind={vignetteFor(card)} seed={card.id} />
                <span className="visually-hidden">
                  {card.name} ({card.tags.map((t) => TAG_LABEL[t]).join(', ')}): {card.text}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        // Plan item 36: the phone Farm lays each bought card out in the farmstead as a drawn card.
        <ul className="farmstead-row">
          {p.improvements.map((id) => {
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id} className="farmstead-card card-framed" data-tag={card.tags[0]} data-card={id}>
                <Vignette kind={vignetteFor(card)} seed={card.id} />
                <strong>{card.name}</strong>
                <span className="card-tags">{card.tags.map((t) => TAG_LABEL[t]).join(', ')}</span>
                {/* SPEC 10.5/STYLE.md 8: a bought card's own entry reminds the player what an ongoing
                    ability does, without reopening the Market or the Rules Reference. */}
                <div className="farm-card-text">{card.text}</div>
              </li>
            )
          })}
        </ul>
      )}
      {Object.keys(tagCounts).length > 0 && (
        <p className="farm-tags">
          Tags:{' '}
          {Object.entries(tagCounts)
            .map(([tag, count]) => `${TAG_LABEL[tag as keyof typeof TAG_LABEL]} ${count}`)
            .join(', ')}
        </p>
      )}
    </section>
  )
}
