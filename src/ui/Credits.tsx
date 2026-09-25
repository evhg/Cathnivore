interface Props {
  onClose(): void
}

// SPEC 10.1's title-screen nav list includes Credits. The cast list mirrors SPEC 3.2-3.4 (playable
// producers, antagonists and secrets); Cath is left off the "written for" line since she's the narrator.
const CAST: { name: string; note: string }[] = [
  { name: 'Cath Hale ("the Cathnivore")', note: 'Guide, narrator, occasional zinger' },
  { name: 'Mara Keel', note: 'Cattle rancher, Brindle Hills' },
  { name: 'Tomas Reed', note: 'Vegetable grower, Oakvale' },
  { name: 'Dr Ines Farrow', note: 'Dairy farmer and country doctor, Rivermead' },
  { name: 'Sol Abara', note: 'Salt-marsh lamb farmer and podcaster, Saltmarsh' },
]

export default function Credits({ onClose }: Props) {
  return (
    <main className="settings credits">
      <h1>Credits</h1>

      <section>
        <h2>Cast</h2>
        <ul>
          {CAST.map((c) => (
            <li key={c.name}>
              <strong>{c.name}</strong> — {c.note}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Made with</h2>
        <p>TypeScript, React and Vite. The map, cards, pieces and portraits are all drawn in code — no stock art.</p>
      </section>

      <section>
        <h2>A note</h2>
        <p>A work of satire. The Republic of Marrow, Hollowell Group, Candor Health and everyone in this story are fictional.</p>
      </section>

      <button onClick={onClose}>Back</button>
    </main>
  )
}
