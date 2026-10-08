import CathArt from './CathArt'
import Portrait from './portraits/Portrait'

interface Props {
  onClose(): void
}

// SPEC 10.1's title-screen nav list includes Credits. The cast list mirrors SPEC 3.2-3.4 (playable
// producers, antagonists and secrets); Cath is left off the "written for" line since she's the narrator.
const CAST: { id: string; name: string; note: string }[] = [
  { id: 'cath', name: 'Cath Hale ("the Cathnivore")', note: 'Guide, narrator, occasional zinger' },
  { id: 'mara', name: 'Mara Keel', note: 'Cattle rancher, Brindle Hills' },
  { id: 'tomas', name: 'Tomas Reed', note: 'Vegetable grower, Oakvale' },
  { id: 'ines', name: 'Dr Ines Farrow', note: 'Dairy farmer and country doctor, Rivermead' },
  { id: 'sol', name: 'Sol Abara', note: 'Salt-marsh lamb farmer and podcaster, Saltmarsh' },
  { id: 'pell', name: 'Graham Pell', note: 'Hollowell Group, CEO' },
  { id: 'vane', name: 'Dr Octavia Vane', note: 'Candor Health, Head of Public Understanding' },
  { id: 'crisp', name: 'Julian Crisp', note: 'PR fixer, works for both companies' },
  { id: 'pip', name: 'Pip Talbot', note: 'Kingsmarket market inspector' },
]

export default function Credits({ onClose }: Props) {
  return (
    <main className="settings credits">
      <header className="settings-header">
        <h1>Credits</h1>
        <CathArt framing="bust" expression="delighted" animate width={64} height={64} title="Cath" />
      </header>

      <section className="settings-card">
        <h2>Cast</h2>
        <ul>
          {CAST.map((c) => (
            <li key={c.name}>
              <span className="credit-portrait" aria-hidden="true">
                <Portrait character={c.id} size={44} />
              </span>
              <span className="credit-text">
                <strong>{c.name}</strong>
                <span>{c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2>Made with</h2>
        <p>TypeScript, React and Vite. The map, cards, pieces and portraits are all drawn in code — no stock art.</p>
      </section>

      <section className="settings-card">
        <h2>A note</h2>
        <p>A work of satire. The Republic of Marrow, Hollowell Group, Candor Health and everyone in this story are fictional.</p>
      </section>

      <button onClick={onClose}>Back</button>
    </main>
  )
}
