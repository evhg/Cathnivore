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
      <div className="sheet-panel farm-sheet">
        <h2>Farm</h2>
        {state.config.producers.map((id) => (
          <FarmColumn key={id} state={state} producer={id} hideSummary={state.config.producers.length === 1} />
        ))}
      </div>
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
function FarmColumn({ state, producer, hideSummary }: { state: GameState; producer: ProducerId; hideSummary?: boolean }) {
  const p = state.producers[producer]
  const def = PRODUCERS[producer]
  const tagCounts: Partial<Record<string, number>> = {}
  for (const id of p.improvements) {
    for (const tag of IMPROVEMENTS_BY_ID.get(id)?.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  return (
    <section className="farm-column">
      {!hideSummary && <h3>{def.name}</h3>}
      {!hideSummary && <p className="farm-production">
        <Tooltip term="Produce">
          <ProduceIcon /> Produce {p.resources.produce} ({p.production.produce}/round)
        </Tooltip>{' '}
        · <Tooltip term="Marks">
          <MarksIcon /> Marks {p.resources.marks} ({p.production.marks}/round)
        </Tooltip>{' '}
        · <Tooltip term="Goodwill">
          <GoodwillIcon /> Goodwill {p.resources.goodwill} ({p.production.goodwill}/round)
        </Tooltip>
      </p>}
      {p.improvements.length === 0 ? (
        <p className="farm-empty">{hideSummary || state.config.producers.length < 2 ? 'No Improvements bought yet.' : 'No Improvements yet.'}</p>
      ) : (
        <ul className="farm-tableau">
          {p.improvements.map((id) => {
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id}>
                <strong>{card.name}</strong> ({card.tags.map((t) => TAG_LABEL[t]).join(', ')})
                {/* SPEC 10.5/STYLE.md 8: same gap as the Market/Cath's Plan sheets (see DECISIONS.md
                    2026-09-26) — a bought Improvement's own tableau entry is exactly where a player would
                    want to be reminded what an ongoing ability (a Supply discount, an extra free Rebut)
                    actually does, without reopening the Market or the Rules Reference. */}
                <div className="farm-card-text">{card.text}</div>
                {card.flavor && <div className="farm-flavor">{card.flavor}</div>}
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
