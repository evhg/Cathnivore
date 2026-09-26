import { logCaption } from './gameLog'
import type { GameEvent } from '../engine/types'

// SPEC 10.2 "Sheets ... Log (turn history with AI reasons and enemy events)." Covers the turn history and
// enemy events, which `state.log` already fully records. The AI-teammate "one-line reason" half of SPEC
// 9.2 is still open (see DECISIONS.md) — the real MCTSBot-in-Worker teammate now exists, but no bot yet
// produces a reason string for this to render.
export default function LogSheet({ log, onClose, inline }: { log: GameEvent[]; onClose(): void; inline?: boolean }) {
  const lines = log.map(logCaption).filter((line): line is string => line !== null)
  const entries = (
    <ol reversed>
      {lines
        .slice()
        .reverse()
        .map((line, i) => (
          <li key={lines.length - i}>{line}</li>
        ))}
    </ol>
  )

  // SPEC 10.3 desktop 3-column layout: the same log, without the phone-sized modal overlay. This panel is
  // given its own internally-scrolling max-height on desktop (global.css's 1024px+ block) since the Log
  // grows unboundedly over a game's rounds and no fixed-height column could otherwise guarantee SPEC 10.3's
  // "no scrolling" for the page as a whole — `tabIndex`/`role`/`aria-label` are required the moment a
  // container can scroll its own overflow, so a keyboard user can actually reach and scroll it (axe's
  // "focusable-content"/"focusable-element" rules; found failing this exact way when the max-height was
  // first added, see DECISIONS.md).
  if (inline) {
    return (
      <div className="sheet-panel log-sheet" tabIndex={0} role="region" aria-label="Turn log">
        <h2>Log</h2>
        {entries}
      </div>
    )
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet log-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Log</h2>
          <button onClick={onClose}>Close</button>
        </header>
        {entries}
      </div>
    </div>
  )
}
