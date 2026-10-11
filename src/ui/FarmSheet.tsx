import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { PRODUCERS } from '../content/producers'
import { GoodwillIcon, MarksIcon, ProduceIcon } from './icons/ResourceIcons'
import Tooltip from './Tooltip'
import type { GameState, ProducerId } from '../engine/types'

const TAG_LABEL = { pasture: 'Pasture', crop: 'Crop', coast: 'Coast', community: 'Community', media: 'Media', science: 'Science' }

// SPEC 10.2 "Sheets ... Farm (tableau and tag counts)." Shows every producer (SPEC 6: 1 in campaign
// chapters 1-3, 2 in a full game) so either can check the other's tableau, not just the active one.
// `inline` (SPEC 10.3 desktop 3-column layout) renders the panel content directly in the page flow
// instead of as a phone-sized modal overlay — the same data, just without the overlay/Close chrome.
export default function FarmSheet({ state, onClose, inline }: { state: GameState; onClose(): void; inline?: boolean }) {
  if (inline) {
    return (
      <section className="farm-sheet farm-inline" aria-labelledby="farm-inline-title">
        <h2 className="farm-inline-title" id="farm-inline-title">Farm</h2>
        {state.config.producers.map((id) => (
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
      <div className="sheet farm-sheet" onClick={(e) => e.stopPropagation()}>
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
      {!hideSummary && <h3>{def.name}</h3>}
      {/* AAA UI M4: a list, not inline " · " joiners (they dangled once the items stacked). The desktop
          frame shows the same figures as compact chips, one line a producer. */}
      {/* compact: the active producer's figures are already on the chips just above */}
      {!hideSummary && !(compact && producer === state.activeProducer) && (
        <ul className="farm-production">
          <li>
            <Tooltip term="Produce">
              <ProduceIcon /> {compact ? <span className="num">{p.resources.produce}</span> : `Produce ${p.resources.produce}`}
              {compact ? <span className="farm-income num"> +{p.production.produce}</span> : ` (${p.production.produce}/round)`}
              {compact && <span className="visually-hidden"> Produce, plus {p.production.produce} a round</span>}
            </Tooltip>
          </li>
          <li>
            <Tooltip term="Marks">
              <MarksIcon /> {compact ? <span className="num">{p.resources.marks}</span> : `Marks ${p.resources.marks}`}
              {compact ? <span className="farm-income num"> +{p.production.marks}</span> : ` (${p.production.marks}/round)`}
              {compact && <span className="visually-hidden"> Marks, plus {p.production.marks} a round</span>}
            </Tooltip>
          </li>
          <li>
            <Tooltip term="Goodwill">
              <GoodwillIcon /> {compact ? <span className="num">{p.resources.goodwill}</span> : `Goodwill ${p.resources.goodwill}`}
              {compact ? <span className="farm-income num"> +{p.production.goodwill}</span> : ` (${p.production.goodwill}/round)`}
              {compact && <span className="visually-hidden"> Goodwill, plus {p.production.goodwill} a round</span>}
            </Tooltip>
          </li>
        </ul>
      )}
      {p.improvements.length === 0 ? (
        !compact && <p className="farm-empty">{hideSummary || state.config.producers.length < 2 ? 'No Improvements bought yet.' : 'No Improvements yet.'}</p>
      ) : (
        <ul className="farm-tableau">
          {p.improvements.map((id) => {
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id}>
                {compact ? (
                  // Desktop frame: one line a card until opened, so the Actions frame keeps its height.
                  <details>
                    <summary>
                      <strong>{card.name}</strong> ({card.tags.map((t) => TAG_LABEL[t]).join(', ')})
                    </summary>
                    <div className="farm-card-text">{card.text}</div>
                    {card.flavor && <div className="farm-flavor">{card.flavor}</div>}
                  </details>
                ) : (
                  <>
                <strong>{card.name}</strong> ({card.tags.map((t) => TAG_LABEL[t]).join(', ')})
                {/* SPEC 10.5/STYLE.md 8: same gap as the Market/Cath's Plan sheets (see DECISIONS.md
                    2026-09-26) — a bought Improvement's own tableau entry is exactly where a player would
                    want to be reminded what an ongoing ability (a Supply discount, an extra free Rebut)
                    actually does, without reopening the Market or the Rules Reference. */}
                <div className="farm-card-text">{card.text}</div>
                {card.flavor && <div className="farm-flavor">{card.flavor}</div>}
                  </>
                )}
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
