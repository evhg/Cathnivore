import { useEffect, useState } from 'react'
import { captionFor } from './enemyTurnLog'
import type { GameEvent, RegionId } from '../engine/types'

// The region an enemy-turn step happens in, if it has one (agenda steps are global).
export function eventRegion(event: GameEvent): RegionId | undefined {
  return 'region' in event ? (event.region as RegionId) : undefined
}

const STEP_MS = 1000

// SPEC 10.2: "the enemy turn plays back as a short series of steps, at most 1 second each ... Tapping
// skips ahead." Renders one caption at a time over the map, advancing on a timer or on tap.
export default function EnemyTurnPlayback({ events, onDone, onStep }: { events: GameEvent[]; onDone(): void; onStep?(region: RegionId | undefined): void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    onStep?.(step < events.length ? eventRegion(events[step]!) : undefined)
    if (step >= events.length) {
      onDone()
      return
    }
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, events.length])

  if (step >= events.length) return null

  return (
    <div className="enemy-turn-playback" onClick={() => setStep(events.length)}>
      <p>{captionFor(events[step]!)}</p>
      <span className="enemy-turn-playback-hint">
        Enemy turn — {step + 1}/{events.length} · tap to skip
      </span>
    </div>
  )
}
