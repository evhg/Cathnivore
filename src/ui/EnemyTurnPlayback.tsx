import { useEffect, useState } from 'react'
import { captionFor, eventRegion } from './enemyTurnLog'
import type { GameEvent, RegionId } from '../engine/types'

const STEP_MS = 1000

// SPEC 10.2: "the enemy turn plays back as a short series of steps, at most 1 second each ... Tapping
// skips ahead." Renders one caption at a time over the map, advancing on a timer or on tap. With `hold`
// (the guided tutorial), it waits on each caption until tapped, so a first-time player can read it.
export default function EnemyTurnPlayback({ events, onDone, onStep, hold }: { events: GameEvent[]; onDone(): void; onStep?(region: RegionId | undefined): void; hold?: boolean }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    onStep?.(step < events.length ? eventRegion(events[step]!) : undefined)
    if (step >= events.length) {
      onDone()
      return
    }
    if (hold) return
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, events.length, hold])

  if (step >= events.length) return null

  return (
    <div className="enemy-turn-playback" data-tutorial="enemy-turn" onClick={() => setStep(hold ? (s) => s + 1 : events.length)}>
      <p>{captionFor(events[step]!)}</p>
      <span className="enemy-turn-playback-hint">
        Enemy turn — {step + 1}/{events.length} · {hold ? 'tap to carry on' : 'tap to skip'}
      </span>
    </div>
  )
}
