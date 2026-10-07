import { useState } from 'react'
import { ALL_PRODUCER_IDS, PRODUCERS, RECOMMENDED_PAIR } from '../content/producers'
import { ALL_REGION_IDS } from '../content/map'
import type { GameConfig, ProducerId } from '../engine/types'
import CathArt from './CathArt'
import Portrait from './portraits/Portrait'

export type Mode = 'solo' | 'hotseat'

interface Props {
  onStart(config: GameConfig, seed: number, mode: Mode): void
}

// SPEC 10.1/10.2 Setup screen: mode, producers, difficulty and an optional seed. Plain controls for now

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
      <header className="setup-header">
        <div className="setup-header-text">
          <h1>Quick Game</h1>
          <p className="setup-cath-line">“Pick two producers who'll cover each other, love.”</p>
        </div>
        {/* ROADMAP "Cath on the title, Campaign, setup and end screens": her default warm smirk, since
            no game state exists yet to react to here. */}
        <CathArt className="setup-header-cath" framing="bust" expression="smirk" animate width={80} height={80} title="Cath" />
      </header>

      <section className="settings-card">
        <h2>Mode</h2>
        <div className="segmented mode-picker">
          <label>
            <span>
              <input type="radio" checked={mode === 'solo'} onChange={() => setMode('solo')} /> Solo (with an AI teammate)
            </span>
          </label>
          <label>
            <span>
              <input type="radio" checked={mode === 'hotseat'} onChange={() => setMode('hotseat')} /> Hot-seat (two humans)
            </span>
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2>Producers (pick 2)</h2>
        <button type="button" onClick={() => setProducers([...RECOMMENDED_PAIR])}>
          Use recommended pair
        </button>
        <div className="producer-grid">
          {ALL_PRODUCER_IDS.map((id) => (
            <label key={id} className="producer-card" data-producer={id}>
              <input type="checkbox" checked={producers.includes(id)} onChange={() => toggleProducer(id)} />
              <span className="pc-portrait" aria-hidden="true">
                <Portrait character={id} size={72} />
              </span>
              <span className="pc-name">{PRODUCERS[id].name}</span>
              <span className="pc-role">{PRODUCERS[id].roleName}</span>
              <span className="pc-ability">{PRODUCERS[id].roleAbility}</span>
              {RECOMMENDED_PAIR.includes(id) && <span className="recommended-badge">Recommended</span>}
              <span className="pc-pick" aria-hidden="true">✓ Picked</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2>Difficulty</h2>
        <div className="segmented">
          {(['easy', 'normal', 'hard'] as const).map((d) => (
            <label key={d}>
              <span>
                <input type="radio" checked={difficulty === d} onChange={() => setDifficulty(d)} />
                {d}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2>Seed (optional)</h2>
        <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="random" inputMode="numeric" />
      </section>

      <button className="primary" disabled={!canStart} onClick={start}>
        Start
      </button>
    </main>
  )
}
