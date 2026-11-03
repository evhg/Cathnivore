import CathArt from './CathArt'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import Portrait from './portraits/Portrait'
import '../styles/noticeboard.css'

interface Props {
  onClose(): void
}

interface CastMember { id: string; name: string; note: string }

// SPEC 10.1's title-screen nav list includes Credits. The cast list mirrors SPEC 3.2-3.4 (playable
// producers, antagonists and secrets). Plan item 56: a closing card on Cath's noticeboard, the cast pinned
// up in three groups like a market's who's who.
const CAST: Array<{ group: string; people: CastMember[] }> = [
  {
    group: 'At the stalls',
    people: [
      { id: 'cath', name: 'Cath Hale ("the Cathnivore")', note: 'Guide, narrator, occasional zinger' },
      { id: 'mara', name: 'Mara Keel', note: 'Cattle rancher, Brindle Hills' },
      { id: 'tomas', name: 'Tomas Reed', note: 'Vegetable grower, Oakvale' },
      { id: 'ines', name: 'Dr Ines Farrow', note: 'Dairy farmer and country doctor, Rivermead' },
      { id: 'sol', name: 'Sol Abara', note: 'Salt-marsh lamb farmer and podcaster, Saltmarsh' },
    ],
  },
  {
    group: 'In the boardroom',
    people: [
      { id: 'pell', name: 'Graham Pell', note: 'Hollowell Group, CEO' },
      { id: 'vane', name: 'Dr Octavia Vane', note: 'Candor Health, Head of Public Understanding' },
      { id: 'crisp', name: 'Julian Crisp', note: 'PR fixer, works for both companies' },
    ],
  },
  {
    group: 'At the gate',
    people: [{ id: 'pip', name: 'Pip Talbot', note: 'Kingsmarket market inspector' }],
  },
]

export default function Credits({ onClose }: Props) {
  return (
    <main className="settings credits noticeboard">
      <header className="settings-header">
        <div>
          <h1>Credits</h1>
          <p className="settings-tip">That’s the market packed up. Thank you for coming, love.</p>
        </div>
        <span className="nb-bust">
          <CathArt framing="bust" pose={SCREEN_POSE['cathnivore:credits']} expression="delighted" animate width={64} height={64} title="Cath" />
        </span>
      </header>

      <div className="nb-layout">
        <aside className="nb-cath" aria-hidden="true">
          <CathArt framing="half" pose={SCREEN_POSE['cathnivore:credits']} expression="delighted" animate />
        </aside>
        <div className="nb-board">
          <section className="settings-card nb-note credits-cast" aria-labelledby="credits-cast-head">
            <h2 id="credits-cast-head">Cast</h2>
            {CAST.map((g) => (
              <div key={g.group} className="cast-group">
                <h3>{g.group}</h3>
                <ul className="cast-grid">
                  {g.people.map((c) => (
                    <li key={c.id} className="cast-card">
                      <span className="credit-portrait" aria-hidden="true">
                        <Portrait character={c.id} size={56} />
                      </span>
                      <span className="credit-text">
                        <strong>{c.name}</strong>
                        <span>{c.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="settings-card nb-note">
            <h2>Made with</h2>
            <p>TypeScript, React and Vite. The map, cards, pieces and portraits are all drawn in code — no stock art.</p>
            <p>Set in Fraunces, Atkinson Hyperlegible Next and Figtree, all under the SIL Open Font License.</p>
          </section>

          <section className="settings-card nb-note">
            <h2>A note</h2>
            <p>A work of satire. The Republic of Marrow, Hollowell Group, Candor Health and everyone in this story are fictional.</p>
          </section>
        </div>
      </div>

      <div className="nb-counter">
        <button className="settings-back" onClick={onClose}>Back</button>
      </div>
    </main>
  )
}
