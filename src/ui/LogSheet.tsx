import { logCaption } from './gameLog'
import type { GameEvent } from '../engine/types'

// SPEC 10.2 "Sheets ... Log (turn history with AI reasons and enemy events)." Covers the turn history and
// enemy events, which `state.log` already fully records, plus the AI teammate's one-line reasons (SPEC
// 9.2), keyed by `state.log` index from `Game.tsx`'s `aiReasons` (narration, not engine state — see there).
export default function LogSheet({
  log,
  aiReasons,
  onClose,
  inline,
}: {
  log: GameEvent[]
  aiReasons?: Record<number, string>
  onClose(): void
  inline?: boolean
}) {
  // ROADMAP 178: each Agenda card opens the opposition's turn, so it closes a round; entries are grouped
  // under an "R<n>" marker at the oldest line of each round.
  let round = 1
  const lines = log
    .map((event, i) => {
      const caption = logCaption(event)
      const r = round
      if (event.type === 'agenda') round += 1
      if (caption === null) return null
      const reason = aiReasons?.[i]
      return { text: reason ? `${caption} ${reason}` : caption, round: r }
    })
    .filter((line): line is { text: string; round: number } => line !== null)
  const entries = (
    <ol reversed>
      {lines
        .slice()
        .reverse()
        .flatMap((line, i, arr) => {
          const item = <li key={lines.length - i}>{line.text}</li>
          const older = arr[i + 1]
          if (older && older.round === line.round) return [item]
          return [
            item,
            <li key={`r${line.round}`} className="log-round" aria-label={`Round ${line.round}`}>
              R{line.round}
            </li>,
          ]
        })}
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
