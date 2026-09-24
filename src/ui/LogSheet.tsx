import { logCaption } from './gameLog'
import type { GameEvent } from '../engine/types'

// SPEC 10.2 "Sheets ... Log (turn history with AI reasons and enemy events)." AI-teammate reasons are
// separate M6 work (they need the MCTSBot-in-Worker teammate, see DECISIONS.md); this covers the turn
// history and enemy events, which `state.log` already fully records.
export default function LogSheet({ log, onClose }: { log: GameEvent[]; onClose(): void }) {
  const lines = log.map(logCaption).filter((line): line is string => line !== null)

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet log-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Log</h2>
          <button onClick={onClose}>Close</button>
        </header>
        <ol reversed>
          {lines
            .slice()
            .reverse()
            .map((line, i) => (
              <li key={lines.length - i}>{line}</li>
            ))}
        </ol>
      </div>
    </div>
  )
}
