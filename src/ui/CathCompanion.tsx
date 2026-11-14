import { useRef, useState, type ReactNode } from 'react'
import type { CathExpression } from '../../shared/cath/cath'
import CathArt from './CathArt'

// ROADMAP "Cath in Cathnivore, as guide and narrator": a companion on the game screen who reacts to what
// just happened with an expression and a short line from `cathCompanionLines.ts`. Purely presentational —
// Game.tsx decides which reaction is current.
//
// AAA UI M4 (aaa-ui-specs.md "cathnivore" 4.9 "Cath's aside"): a 48px wheat-ringed cameo beside a torn
// paper strip in her voice. A new line slides in from the left and the cameo gives a small nod; the nod
// alternates between two identical keyframe names so it replays without remounting her portrait.
export default function CathCompanion({ expression, line }: { expression: CathExpression; line: string }) {
  const lastLine = useRef(line)
  const nods = useRef(0)
  if (lastLine.current !== line) {
    lastLine.current = line
    nods.current += 1
  }
  const nod = nods.current === 0 ? '' : nods.current % 2 ? ' nod-a' : ' nod-b'
  return (
    <section className="cath-companion" data-expression={expression} aria-live="polite">
      <span className={`cath-frame cameo${nod}`}>
        <CathArt framing="bust" expression={expression} animate width={56} height={56} title="Cath" />
      </span>
      {/* `key` on the text, not the section: swapping it lets the bubble content change without the
          portrait itself remounting (which would restart her idle-animation timers on every reaction). */}
      <span className="cath-strip">
        <p className="cath-companion-line voice" key={line}>
          {line}
        </p>
      </span>
    </section>
  )
}

// Plan item 171: on an upright phone her line docks above the hand, beside a 64 px bust, so nothing of hers lies on
// the board (the table is the hero). A new line slides in over 200 ms; a tap folds it away until she next speaks
// (the dock keeps its height, so the board never jumps), and a tap on the folded dock brings it back.
export function CathDock({ expression, line, children }: { expression: CathExpression; line: string; children?: ReactNode }) {
  const [folded, setFolded] = useState<string | null>(null)
  const isFolded = folded === line
  return (
    <section className="cath-dock" data-expression={expression} data-folded={isFolded ? '' : undefined} aria-label="Cath">
      <button
        type="button"
        className="cath-dock-btn"
        aria-label={isFolded ? 'Show Cath’s line' : 'Fold Cath’s line away'}
        aria-pressed={isFolded}
        onClick={() => setFolded(isFolded ? null : line)}
      >
        <span className="cath-dock-bust" aria-hidden="true">
          <CathArt framing="bust" expression={expression} animate width={64} height={64} />
        </span>
      </button>
      <p className="cath-dock-line voice" role="status" aria-live="polite" key={line} onClick={() => setFolded(line)}>
        {line}
      </p>
      {children}
    </section>
  )
}
