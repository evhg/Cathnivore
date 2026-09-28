import type { CathExpression } from '../../shared/cath/cath'
import CathArt from './CathArt'

// ROADMAP "Cath in Cathnivore, as guide and narrator": a companion on the game screen who reacts to what
// just happened with an expression and a short line from `cathCompanionLines.ts`. Purely presentational —
// Game.tsx decides which reaction is current.
export default function CathCompanion({ expression, line }: { expression: CathExpression; line: string }) {
  return (
    <section className="cath-companion" aria-live="polite">
      <CathArt framing="bust" expression={expression} animate width={56} height={56} title="Cath" />
      {/* `key` on the text, not the section: swapping it lets the bubble content change without the
          portrait itself remounting (which would restart her idle-animation timers on every reaction). */}
      <p className="cath-companion-line" key={line}>
        {line}
      </p>
    </section>
  )
}
