import { useState } from 'react'
import { ALL_PRODUCER_IDS, PRODUCERS, RECOMMENDED_PAIR } from '../content/producers'
import { ALL_REGION_IDS } from '../content/map'
import type { GameConfig, ProducerId } from '../engine/types'
import { earnedPins, pinForEvent } from '../../shared/cath/pins'
import { marketEventFor } from '../engine/marketEvent'
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
  const [marketEvent] = useState(() => marketEventFor(new Date()))

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
    onStart({ producers, difficulty, activeRegions: ALL_REGION_IDS, marketEvent: marketEvent.id }, seed, mode)
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

      <section className="settings-card market-event" data-event={marketEvent.id}>
        <p className="market-event-eyebrow" aria-hidden="true">This week at the market</p>
        <h2>Market event: {marketEvent.name}</h2>
        <p className="market-event-line">“{marketEvent.banner}”</p>
        <p className="market-event-deal">{marketEvent.cheap.join(' and ')} Improvements cost 1 Mark less this week. Win during it to earn Cath's pin: {marketEvent.cosmetic}{earnedPins().includes(pinForEvent(marketEvent.id)!) ? ' (earned)' : ''}.</p>
      </section>

      <section className="settings-card setup-mode">
        <h2>Mode</h2>
        <div className="segmented mode-picker">
          <label>
            <span>
              <input type="radio" checked={mode === 'solo'} onChange={() => setMode('solo')} /> Solo (with an AI teammate)
            </span>
            {/* Plan item 8: the desktop spread draws each mode as a tile (hidden on phones, whose layout stays). */}
            <span className="mode-art" aria-hidden="true">
              <span className="mode-who">
                <Portrait character={producers[0] ?? 'mara'} size={52} />
                <i className="mode-tag is-you">You</i>
              </span>
              <span className="mode-who">
                <Portrait character={producers[1] ?? 'tomas'} size={52} />
                <i className="mode-tag is-ai">AI</i>
              </span>
            </span>
          </label>
          <label>
            <span>
              <input type="radio" checked={mode === 'hotseat'} onChange={() => setMode('hotseat')} /> Hot-seat (two humans)
            </span>
            <span className="mode-art" aria-hidden="true">
              <span className="mode-who">
                <Portrait character={producers[0] ?? 'mara'} size={52} />
                <i className="mode-tag is-you">P1</i>
              </span>
              <span className="mode-who">
                <Portrait character={producers[1] ?? 'tomas'} size={52} />
                <i className="mode-tag is-you">P2</i>
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-card setup-producers">
        <h2>Producers (pick 2)</h2>
        <button type="button" className="setup-recommend" onClick={() => setProducers([...RECOMMENDED_PAIR])}>
          Use recommended pair
        </button>
        <div className="producer-grid">
          {ALL_PRODUCER_IDS.map((id) => (
            <label key={id} className="producer-card" data-producer={id}>
              <input type="checkbox" checked={producers.includes(id)} onChange={() => toggleProducer(id)} />
              <span className="pc-portrait" aria-hidden="true">
                <Portrait character={id} size={112} />
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

      <section className="settings-card setup-difficulty">
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

      <section className="settings-card setup-seed">
        <h2>Seed (optional)</h2>
        <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="random" inputMode="numeric" />
      </section>

      <button className="primary" disabled={!canStart} onClick={start}>
        Start
      </button>
    </main>
  )
}
