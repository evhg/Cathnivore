import { useEffect, useMemo, useState } from 'react'
import { captionFor, eventRegion } from './enemyTurnLog'
import { boardroomBeat, cathReply, EXECS, MOOD_EXPRESSION, type Exec } from './boardroom'
import Figure from './portraits/Figure'
import type { GameEvent, RegionId } from '../engine/types'

const STEP_MS = 1000

// SPEC 10.2: "the enemy turn plays back as a short series of steps, at most 1 second each ... Tapping
// skips ahead." Plan item 11: each step is played in the boardroom strip by the executive behind it (Graham
// Pell for Hollowell, Octavia Vane for Candor) with a face and a bark over the step's card and caption; after
// the last step Cath answers whoever spoke last. A tap anywhere skips the whole turn.
export default function EnemyTurnPlayback({ events, onDone, onStep }: { events: GameEvent[]; onDone(): void; onStep?(region: RegionId | undefined): void }) {
  const [step, setStep] = useState(0)
  const beats = useMemo(() => events.map((e, i) => boardroomBeat(e, i)), [events])
  const lastExec = useMemo<Exec | undefined>(() => [...beats].reverse().find((b) => b)?.exec, [beats])
  // One beat more than the steps when someone spoke: Cath's reply.
  const total = events.length + (lastExec ? 1 : 0)

  useEffect(() => {
    onStep?.(step < events.length ? eventRegion(events[step]!) : undefined)
    if (step >= total) {
      onDone()
      return
    }
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, events.length])

  if (step >= total) return null

  const replying = step >= events.length
  const beat = replying ? undefined : beats[step]
  const exec = beat?.exec
  return (
    <div
      className={`enemy-turn-playback boardroom${exec ? ` boardroom-${EXECS[exec].faction}` : ''}${replying ? ' boardroom-reply' : ''}`}
      onClick={() => setStep(total)}
    >
      {exec && beat ? (
        <div className="boardroom-row" key={step}>
          <div className="boardroom-face" aria-hidden="true">
            <Figure character={exec} expression={MOOD_EXPRESSION[beat.mood]} />
          </div>
          <div className="boardroom-words">
            <span className="boardroom-who">
              {EXECS[exec].name}
              <small>{EXECS[exec].title}</small>
            </span>
            <q className="boardroom-bark">{beat.bark}</q>
            <span className="boardroom-card">{beat.card}</span>
          </div>
        </div>
      ) : null}
      {replying && lastExec ? (
        <p className="boardroom-cath" key="reply">
          <b>Cath</b> {cathReply(lastExec, `${events.length}:${lastExec}`)}
        </p>
      ) : (
        <p>{captionFor(events[step]!)}</p>
      )}
      <span className="enemy-turn-playback-hint">
        Enemy turn — {Math.min(step + 1, events.length)}/{events.length} · tap to skip
      </span>
    </div>
  )
}
