import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { PRODUCERS } from '../content/producers'
import type { GameState, ProducerId } from '../engine/types'

const TAG_LABEL = { pasture: 'Pasture', crop: 'Crop', coast: 'Coast', community: 'Community', media: 'Media', science: 'Science' }

// SPEC 10.2 "Sheets ... Farm (tableau and tag counts)." Shows every producer (SPEC 6: 1 in campaign
// chapters 1-3, 2 in a full game) so either can check the other's tableau, not just the active one.
export default function FarmSheet({ state, onClose }: { state: GameState; onClose(): void }) {
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

function FarmColumn({ state, producer }: { state: GameState; producer: ProducerId }) {
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
      <h3>{def.name}</h3>
      <p className="farm-production">
        Produce {p.resources.produce} ({p.production.produce}/round) · Marks {p.resources.marks} ({p.production.marks}
        /round) · Goodwill {p.resources.goodwill} ({p.production.goodwill}/round)
      </p>
      {p.improvements.length === 0 ? (
        <p className="farm-empty">No Improvements bought yet.</p>
      ) : (
        <ul className="farm-tableau">
          {p.improvements.map((id) => {
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id}>
                <strong>{card.name}</strong> ({card.tags.map((t) => TAG_LABEL[t]).join(', ')})
                {card.flavor && <span className="farm-flavor"> — {card.flavor}</span>}
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
