import { useState } from 'react'
import { ALL_PRODUCER_IDS, PRODUCERS, RECOMMENDED_PAIR } from '../content/producers'
import { ALL_REGION_IDS } from '../content/map'
import type { GameConfig, ProducerId } from '../engine/types'

export type Mode = 'solo' | 'hotseat'

interface Props {
  onStart(config: GameConfig, seed: number, mode: Mode): void
}

// SPEC 10.1/10.2 Setup screen: mode, producers, difficulty and an optional seed. Plain controls for now
// (no visual design pass yet — see PROGRESS.md M3).
export default function Setup({ onStart }: Props) {
  const [mode, setMode] = useState<Mode>('solo')
  const [producers, setProducers] = useState<ProducerId[]>(['mara', 'tomas'])
  const [difficulty, setDifficulty] = useState<GameConfig['difficulty']>('normal')
  const [seedInput, setSeedInput] = useState('')

  function toggleProducer(id: ProducerId): void {
    setProducers((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 2) return [prev[1]!, id]
      return [...prev, id]
    })
  }

  const canStart = producers.length === 2

  function start(): void {
    const parsed = seedInput.trim() ? Number.parseInt(seedInput, 10) : NaN
    // A non-numeric seed (e.g. a pasted non-digit string) must not silently coerce to a real seed (0)
    // indistinguishable from actually typing "0" — fall back to a fresh random seed instead.
    const seed = Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31)
    onStart({ producers, difficulty, activeRegions: ALL_REGION_IDS }, seed, mode)
  }

  return (
    <main className="setup">
      <h1>Quick Game</h1>

      <section>
        <h2>Mode</h2>
        <label>
          <input type="radio" checked={mode === 'solo'} onChange={() => setMode('solo')} /> Solo (with an AI teammate)
        </label>
        <label>
          <input type="radio" checked={mode === 'hotseat'} onChange={() => setMode('hotseat')} /> Hot-seat (two humans)
        </label>
      </section>

      <section>
        <h2>Producers (pick 2)</h2>
        <button type="button" onClick={() => setProducers([...RECOMMENDED_PAIR])}>
          Use recommended pair
        </button>
        {ALL_PRODUCER_IDS.map((id) => (
          <label key={id}>
            <input type="checkbox" checked={producers.includes(id)} onChange={() => toggleProducer(id)} />
            {PRODUCERS[id].name} — {PRODUCERS[id].roleName}
            {RECOMMENDED_PAIR.includes(id) && <span className="recommended-badge">Recommended</span>}
          </label>
        ))}
      </section>

      <section>
        <h2>Difficulty</h2>
        {(['easy', 'normal', 'hard'] as const).map((d) => (
          <label key={d}>
            <input type="radio" checked={difficulty === d} onChange={() => setDifficulty(d)} /> {d}
          </label>
        ))}
      </section>

      <section>
        <h2>Seed (optional)</h2>
        <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="random" inputMode="numeric" />
      </section>

      <button disabled={!canStart} onClick={start}>
        Start
      </button>
    </main>
  )
}
